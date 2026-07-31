import { NextResponse } from "next/server";

import {
  CREDIT_PACKAGES,
  getCreditPriceId,
  getStripeClient,
} from "@/lib/stripe";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestUser } from "@/lib/supabase/request-user";

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const allowed = await consumeRateLimit({
      scope: "credit-checkout-user",
      identifier: user.id,
      maximumRequests: 10,
      windowSeconds: 3_600,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many checkout requests. Please try again later." },
        { status: 429 },
      );
    }

    const { packageId } = (await request.json()) as { packageId?: string };
    const creditPackage = CREDIT_PACKAGES.find(
      (candidate) => candidate.id === packageId,
    );
    if (!creditPackage) {
      return NextResponse.json(
        { error: "Select a valid credit package." },
        { status: 400 },
      );
    }
    const stripePriceId = getCreditPriceId(creditPackage.id);
    if (!stripePriceId) {
      throw new Error(`Stripe price is missing for ${creditPackage.id}.`);
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      new URL(request.url).origin;
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      customer_email: user.email || undefined,
      line_items: [
        {
          quantity: 1,
          price: stripePriceId,
        },
      ],
      metadata: {
        user_id: user.id,
        package_id: creditPackage.id,
        credit_seconds: String(creditPackage.seconds),
      },
      payment_intent_data: {
        metadata: {
          user_id: user.id,
          package_id: creditPackage.id,
          credit_seconds: String(creditPackage.seconds),
        },
      },
      success_url: `${siteUrl}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/credits/cancelled`,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("Credit checkout creation failed:", error);
    return NextResponse.json(
      { error: "Checkout is unavailable. Please try again." },
      { status: 500 },
    );
  }
}
