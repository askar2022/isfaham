import Stripe from "stripe";

export const CREDIT_PACKAGES = [
  {
    id: "starter",
    name: "1 Translation Hour",
    hours: 1,
    seconds: 3_600,
    amountCents: 800,
  },
  {
    id: "standard",
    name: "5 Translation Hours",
    hours: 5,
    seconds: 18_000,
    amountCents: 3_500,
  },
  {
    id: "premium",
    name: "10 Translation Hours",
    hours: 10,
    seconds: 36_000,
    amountCents: 6_500,
  },
] as const;

export const SCHOOL_MONTHLY_PLAN = {
  id: "school_monthly",
  name: "Isfaham School Plan",
  amountCents: 49_900,
  interval: "month",
} as const;

export function getCreditPriceId(packageId: string) {
  const priceIds: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_1_HOUR,
    standard: process.env.STRIPE_PRICE_5_HOURS,
    premium: process.env.STRIPE_PRICE_10_HOURS,
  };
  return priceIds[packageId];
}

export function getSchoolMonthlyPriceId() {
  return process.env.STRIPE_PRICE_SCHOOL_MONTHLY;
}

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Stripe is not configured.");
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL_ENV === "production" &&
    secretKey.startsWith("sk_test_")
  ) {
    throw new Error("Stripe test keys are not allowed in production.");
  }
  return new Stripe(secretKey);
}
