import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getPlatformAdminContext() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.trim().toLowerCase();
  if (!user || !email) return null;

  const admin = createAdminClient();
  const { data: platformAdmin } = await admin
    .from("platform_administrators")
    .select("email, full_name")
    .eq("email", email)
    .maybeSingle();

  if (!platformAdmin) return null;
  return { admin, platformAdmin, user };
}

export async function isPlatformAdministrator(email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) return false;

  const { data } = await createAdminClient()
    .from("platform_administrators")
    .select("email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  return Boolean(data);
}
