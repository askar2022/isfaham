import { redirect } from "next/navigation";

import { TeacherLoginForm } from "@/components/TeacherLoginForm";
import { isPlatformAdministrator } from "@/lib/platform-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Staff sign in",
};

export default async function TeacherLoginPage() {
  let hasSession = false;
  let hasSchoolProfile = false;
  let platformAdmin = false;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = Boolean(user);
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      hasSchoolProfile = Boolean(profile);
    }
    platformAdmin = await isPlatformAdministrator(user?.email);
  } catch {
    // The form displays configuration errors when credentials are unavailable.
  }

  if (hasSession) {
    redirect(
      hasSchoolProfile
        ? "/teacher"
        : platformAdmin
          ? "/admin/personal"
          : "/teacher",
    );
  }

  return (
    <main className="auth-page">
      <TeacherLoginForm />
    </main>
  );
}
