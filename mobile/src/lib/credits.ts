import { fetch } from "expo/fetch";

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export type CreditPackage = {
  id: string;
  name: string;
  hours: number;
  seconds: number;
  amountCents: number;
};

export type CreditBalance = {
  balanceSeconds: number;
  purchasedSeconds: number;
  usedSeconds: number;
  schoolFunded: boolean;
  packages: CreditPackage[];
};

function requireApiUrl() {
  if (!apiUrl) throw new Error("The app is not connected to Isfaham.");
  return apiUrl;
}

export async function getCreditBalance(accessToken: string) {
  const response = await fetch(`${requireApiUrl()}/api/credits`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as CreditBalance & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "Translation balance is unavailable.");
  }
  return body;
}

export async function createCreditCheckout(
  packageId: string,
  accessToken: string,
) {
  const response = await fetch(`${requireApiUrl()}/api/credits/checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ packageId }),
  });
  const body = (await response.json()) as {
    checkoutUrl?: string;
    error?: string;
  };
  if (!response.ok || !body.checkoutUrl) {
    throw new Error(body.error || "Checkout is unavailable.");
  }
  return body.checkoutUrl;
}
