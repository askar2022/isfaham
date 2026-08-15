import { NextResponse } from "next/server";

import {
  SCHOOL_MONTHLY_PLAN,
  getSchoolMonthlyPriceId,
  getStripeClient,
} from "@/lib/stripe";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      school?: string;
      role?: string;
      website?: string;
    };

    if (body.website) {
      return NextResponse.json({ ok: true });
    }

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const school = body.school?.trim();
    const role = body.role?.trim() || "";

    if (!name || !email || !school || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "Please enter your name, school, and a valid email." },
        { status: 400 },
      );
    }

    if (name.length > 100 || email.length > 200 || school.length > 150) {
      return NextResponse.json(
        { error: "One or more fields are too long." },
        { status: 400 },
      );
    }

    const [emailAllowed, ipAllowed] = await Promise.all([
      consumeRateLimit({
        scope: "school-checkout-email",
        identifier: email,
        maximumRequests: 5,
        windowSeconds: 86_400,
      }),
      consumeRateLimit({
        scope: "school-checkout-ip",
        identifier: getClientIp(request),
        maximumRequests: 15,
        windowSeconds: 3_600,
      }),
    ]);
    if (!emailAllowed || !ipAllowed) {
      return NextResponse.json(
        { error: "Too many checkout requests. Please try again later." },
        { status: 429 },
      );
    }

    const stripePriceId = getSchoolMonthlyPriceId();
    if (!stripePriceId) {
      return NextResponse.json(
        { error: "School billing is not configured yet." },
        { status: 503 },
      );
    }

    const admin = createAdminClient();
    const [{ data: existingTeacher }, { data: platformAdmin }] =
      await Promise.all([
        admin
          .from("approved_teachers")
          .select("email")
          .eq("email", email)
          .maybeSingle(),
        admin
          .from("platform_administrators")
          .select("email")
          .eq("email", email)
          .maybeSingle(),
      ]);
    if (existingTeacher || platformAdmin) {
      return NextResponse.json(
        {
          error:
            "This email is already registered. Use school sign in, or contact support to change schools.",
        },
        { status: 409 },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      new URL(request.url).origin;
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price: stripePriceId,
        },
      ],
      metadata: {
        checkout_type: "school",
        school_name: school,
        admin_name: name,
        admin_email: email,
        role,
        plan_id: SCHOOL_MONTHLY_PLAN.id,
      },
      subscription_data: {
        metadata: {
          checkout_type: "school",
          school_name: school,
          admin_name: name,
          admin_email: email,
          role,
          plan_id: SCHOOL_MONTHLY_PLAN.id,
        },
      },
      success_url: `${siteUrl}/schools/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/schools/cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("School checkout creation failed:", error);
    return NextResponse.json(
      { error: "Checkout is unavailable. Please try again." },
      { status: 500 },
    );
  }
}
