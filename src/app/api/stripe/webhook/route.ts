import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { Resend } from "resend";

import {
  provisionSchoolSubscription,
  syncSchoolSubscriptionStatus,
} from "@/lib/school-billing";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Stripe webhook signature failed:", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.metadata?.checkout_type === "school") {
        await handleSchoolCheckoutCompleted(session);
      } else {
        await handleCreditCheckoutCompleted(session);
      }
    }

    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object;
      if (subscription.metadata?.checkout_type === "school") {
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id;
        await syncSchoolSubscriptionStatus({
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: customerId,
          status: subscription.status,
        });
      }
    }
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

async function handleCreditCheckoutCompleted(
  session: Stripe.Checkout.Session,
) {
  const userId = session.metadata?.user_id;
  const creditSeconds = Number(session.metadata?.credit_seconds);

  if (
    session.payment_status !== "paid" ||
    !userId ||
    !Number.isSafeInteger(creditSeconds) ||
    creditSeconds <= 0
  ) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("apply_credit_purchase", {
    account_user_id: userId,
    purchased_credit_seconds: creditSeconds,
    stripe_transaction_id: session.id,
    paid_amount_cents: session.amount_total ?? 0,
    purchase_metadata: {
      package_id: session.metadata?.package_id,
      payment_intent: session.payment_intent,
    },
  });
  if (error) {
    throw error;
  }
}

async function handleSchoolCheckoutCompleted(
  session: Stripe.Checkout.Session,
) {
  const schoolName = session.metadata?.school_name?.trim();
  const adminName = session.metadata?.admin_name?.trim();
  const adminEmail = session.metadata?.admin_email?.trim().toLowerCase();
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (!schoolName || !adminName || !adminEmail || !subscriptionId || !customerId) {
    throw new Error("School checkout session is missing required fields.");
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await provisionSchoolSubscription({
    schoolName,
    adminName,
    adminEmail,
    role: session.metadata?.role,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    checkoutSessionId: session.id,
    subscriptionStatus: subscription.status,
  });

  await notifySchoolSubscriptionStarted({
    schoolName,
    adminName,
    adminEmail,
    role: session.metadata?.role,
    subscriptionStatus: subscription.status,
  });
}

async function notifySchoolSubscriptionStarted(input: {
  schoolName: string;
  adminName: string;
  adminEmail: string;
  role?: string | null;
  subscriptionStatus: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("School subscription email skipped: RESEND_API_KEY missing.");
    return;
  }

  const from =
    process.env.RESEND_FROM_EMAIL ?? "Isfaham <hello@isfaham.org>";
  const notificationEmail =
    process.env.PILOT_NOTIFICATION_EMAIL ?? "hello@isfaham.org";
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://isfaham.org";
  const loginUrl = `${siteUrl}/teacher/login`;
  const resend = new Resend(apiKey);

  const safeSchool = escapeHtml(input.schoolName);
  const safeName = escapeHtml(input.adminName);
  const safeEmail = escapeHtml(input.adminEmail);
  const safeRole = escapeHtml(input.role || "Not provided");
  const safeStatus = escapeHtml(input.subscriptionStatus);

  const results = await Promise.allSettled([
    resend.emails.send({
      from,
      to: notificationEmail,
      replyTo: input.adminEmail,
      subject: `New Isfaham school subscription — ${input.schoolName}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#201a2e">
          <h1 style="color:#5b38d2">School subscription started</h1>
          <p><strong>School:</strong> ${safeSchool}</p>
          <p><strong>Admin:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Role:</strong> ${safeRole}</p>
          <p><strong>Status:</strong> ${safeStatus}</p>
          <p>Plan: $499/month</p>
        </div>
      `,
    }),
    resend.emails.send({
      from,
      to: input.adminEmail,
      subject: "Your Isfaham school plan is ready",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#201a2e">
          <h1 style="color:#5b38d2">Welcome to Isfaham for Schools</h1>
          <p>Hi ${safeName},</p>
          <p>
            ${safeSchool} is now on the Isfaham school plan ($499/month).
            Sign in with this email to open the school portal and add teachers.
          </p>
          <p>
            <a href="${loginUrl}" style="color:#5b38d2">Open school sign in</a>
          </p>
          <p>Teachers use the Isfaham app → School, with their approved work email.</p>
        </div>
      `,
    }),
  ]);

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("School subscription email failed:", result.reason);
    } else if (result.value.error) {
      console.error("School subscription email failed:", result.value.error);
    }
  }
}
