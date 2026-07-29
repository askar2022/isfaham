import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const PRODUCT_SECONDS: Record<string, number> = {
  isfaham_1_hour: 3_600,
  isfaham_5_hours: 18_000,
  isfaham_10_hours: 36_000,
};

type RevenueCatEvent = {
  id?: string;
  type?: string;
  app_id?: string;
  app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  transaction_id?: string;
  store?: string;
  environment?: string;
  currency?: string;
  price_in_purchased_currency?: number;
  price?: number;
};

function matchesSecret(received: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(received ?? "");
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

function findUserId(event: RevenueCatEvent) {
  const candidates = [event.app_user_id, ...(event.aliases ?? [])];
  return candidates.find((candidate) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate ?? "",
    ),
  );
}

export async function POST(request: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH_TOKEN;
  if (!secret) {
    return NextResponse.json(
      { error: "RevenueCat webhook is not configured." },
      { status: 503 },
    );
  }
  if (!matchesSecret(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let event: RevenueCatEvent;
  try {
    const body = (await request.json()) as { event?: RevenueCatEvent };
    event = body.event ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (event.type !== "NON_RENEWING_PURCHASE") {
    return NextResponse.json({ received: true });
  }

  const creditSeconds = PRODUCT_SECONDS[event.product_id ?? ""];
  const userId = findUserId(event);
  const supportedStore =
    event.store === "APP_STORE" || event.store === "PLAY_STORE";
  if (
    !supportedStore ||
    !creditSeconds ||
    !userId ||
    !event.transaction_id
  ) {
    console.error("Rejected RevenueCat credit event:", {
      eventId: event.id,
      productId: event.product_id,
      store: event.store,
    });
    return NextResponse.json(
      { error: "Unsupported purchase event." },
      { status: 400 },
    );
  }

  const price =
    event.price_in_purchased_currency ??
    event.price ??
    0;
  const { error } = await createAdminClient().rpc(
    "apply_revenuecat_credit_purchase",
    {
      account_user_id: userId,
      purchased_credit_seconds: creditSeconds,
      revenuecat_transaction_id: event.transaction_id,
      paid_amount_cents: Math.max(0, Math.round(price * 100)),
      purchase_metadata: {
        event_id: event.id,
        product_id: event.product_id,
        app_id: event.app_id,
        store: event.store,
        environment: event.environment,
        currency: event.currency,
      },
    },
  );

  if (error) {
    console.error("RevenueCat credit application failed:", error);
    return NextResponse.json(
      { error: "Credit application failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
