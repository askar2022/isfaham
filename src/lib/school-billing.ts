import { createAdminClient } from "@/lib/supabase/admin";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

export function isSchoolSubscriptionUsable(status: string | null | undefined) {
  // Legacy pilot schools have no Stripe status and stay usable.
  if (!status) {
    return true;
  }
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

export async function assertSchoolSubscriptionActive(schoolId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("schools")
    .select("subscription_status")
    .eq("id", schoolId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return { ok: false as const, reason: "School not found." };
  }
  if (!isSchoolSubscriptionUsable(data.subscription_status)) {
    return {
      ok: false as const,
      reason: "This school subscription is inactive. Update billing to continue.",
    };
  }
  return { ok: true as const };
}

export async function provisionSchoolSubscription(input: {
  schoolName: string;
  adminName: string;
  adminEmail: string;
  role?: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  checkoutSessionId: string;
  subscriptionStatus: string;
}) {
  const admin = createAdminClient();
  const email = input.adminEmail.trim().toLowerCase();
  const schoolName = input.schoolName.trim();
  const adminName = input.adminName.trim();

  const { data: existingBySession } = await admin
    .from("schools")
    .select("id")
    .eq("stripe_checkout_session_id", input.checkoutSessionId)
    .maybeSingle();
  if (existingBySession) {
    return existingBySession.id as string;
  }

  const { data: existingBySubscription } = await admin
    .from("schools")
    .select("id")
    .eq("stripe_subscription_id", input.stripeSubscriptionId)
    .maybeSingle();
  if (existingBySubscription) {
    await admin
      .from("schools")
      .update({
        billing_email: email,
        stripe_customer_id: input.stripeCustomerId,
        stripe_checkout_session_id: input.checkoutSessionId,
        subscription_status: input.subscriptionStatus,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", existingBySubscription.id);
    return existingBySubscription.id as string;
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({
      name: schoolName,
      billing_email: email,
      stripe_customer_id: input.stripeCustomerId,
      stripe_subscription_id: input.stripeSubscriptionId,
      stripe_checkout_session_id: input.checkoutSessionId,
      subscription_status: input.subscriptionStatus,
      subscription_updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (schoolError || !school) {
    throw schoolError ?? new Error("School provisioning failed.");
  }

  const { error: teacherError } = await admin.from("approved_teachers").upsert(
    {
      email,
      school_id: school.id,
      full_name: adminName,
      is_admin: true,
      is_active: true,
    },
    { onConflict: "email" },
  );

  if (teacherError) {
    throw teacherError;
  }

  return school.id as string;
}

export async function syncSchoolSubscriptionStatus(input: {
  stripeSubscriptionId: string;
  stripeCustomerId?: string | null;
  status: string;
}) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("schools")
    .update({
      subscription_status: input.status,
      stripe_customer_id: input.stripeCustomerId || undefined,
      subscription_updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", input.stripeSubscriptionId);

  if (error) {
    throw error;
  }
}
