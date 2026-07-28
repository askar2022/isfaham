import { redirect } from "next/navigation";

import { TeacherLoginForm } from "@/components/TeacherLoginForm";
import { isPlatformAdministrator } from "@/lib/platform-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Staff sign in",
};

export default async function TeacherLoginPage() {
  let hasSession = false;
  let platformAdmin = false;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = Boolean(user);
    platformAdmin = await isPlatformAdministrator(user?.email);
  } catch {
    // The form displays configuration errors when credentials are unavailable.
  }

  if (hasSession) {
    redirect(platformAdmin ? "/admin/personal" : "/teacher");
  }

  return (
    <main className="auth-page">
      <TeacherLoginForm />
      <a className="auth-support" href="mailto:hello@isfaham.org">
        Contact developer and designer Dr. Askar
      </a>
    </main>
  );
}
