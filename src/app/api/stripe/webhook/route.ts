import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const creditSeconds = Number(session.metadata?.credit_seconds);

    if (
      session.payment_status === "paid" &&
      userId &&
      Number.isSafeInteger(creditSeconds) &&
      creditSeconds > 0
    ) {
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
        console.error("Stripe credit application failed:", error);
        return NextResponse.json(
          { error: "Credit application failed." },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json({ received: true });
}
