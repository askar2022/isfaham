import { redirect } from "next/navigation";

import { TeacherLoginForm } from "@/components/TeacherLoginForm";
import { isPlatformAdministrator } from "@/lib/platform-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Platform administrator sign in",
};

export const dynamic = "force-dynamic";

export default async function PlatformAdminLoginPage() {
  let hasPlatformSession = false;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasPlatformSession = Boolean(
      user && (await isPlatformAdministrator(user.email)),
    );
  } catch {
    // The form displays configuration errors when credentials are unavailable.
  }

  if (hasPlatformSession) redirect("/admin/personal");

  return (
    <main className="auth-page">
      <TeacherLoginForm portal="platform" />
    </main>
  );
}
