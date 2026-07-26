import { NextResponse } from "next/server";

import { CREDIT_PACKAGES } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/request-user";

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data: wallet }, { data: profile }] = await Promise.all([
    admin
      .from("credit_wallets")
      .select("balance_seconds, purchased_seconds, used_seconds")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("profiles").select("id").eq("id", user.id).maybeSingle(),
  ]);

  if (!wallet) {
    const { data: createdWallet, error } = await admin
      .from("credit_wallets")
      .insert({ user_id: user.id })
      .select("balance_seconds, purchased_seconds, used_seconds")
      .single();
    if (error || !createdWallet) {
      return NextResponse.json(
        { error: "Translation balance is unavailable." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      balanceSeconds: Number(createdWallet.balance_seconds),
      purchasedSeconds: Number(createdWallet.purchased_seconds),
      usedSeconds: Number(createdWallet.used_seconds),
      schoolFunded: Boolean(profile),
      packages: CREDIT_PACKAGES,
    });
  }

  return NextResponse.json({
    balanceSeconds: Number(wallet.balance_seconds),
    purchasedSeconds: Number(wallet.purchased_seconds),
    usedSeconds: Number(wallet.used_seconds),
    schoolFunded: Boolean(profile),
    packages: CREDIT_PACKAGES,
  });
}
