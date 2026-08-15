import { createAdminClient } from "@/lib/supabase/admin";
import { assertSchoolSubscriptionActive } from "@/lib/school-billing";

export async function requireSchoolSender(userId: string, email?: string | null) {
  const admin = createAdminClient();
  const normalizedEmail = email?.trim().toLowerCase();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("school_id, email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }
  if (!profile) {
    return { ok: false as const, reason: "School sign in required." };
  }

  const { data: approval } = await admin
    .from("approved_teachers")
    .select("email, is_active, is_admin")
    .eq("email", (normalizedEmail || profile.email).toLowerCase())
    .eq("school_id", profile.school_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!approval) {
    return { ok: false as const, reason: "Your school access is no longer active." };
  }

  const subscription = await assertSchoolSubscriptionActive(profile.school_id);
  if (!subscription.ok) {
    return { ok: false as const, reason: subscription.reason };
  }

  const { data: school } = await admin
    .from("schools")
    .select("id, name")
    .eq("id", profile.school_id)
    .maybeSingle();

  return {
    ok: true as const,
    admin,
    profile,
    schoolName: school?.name ?? "Your school",
  };
}

export function isVoiceMessageExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() <= Date.now();
}
