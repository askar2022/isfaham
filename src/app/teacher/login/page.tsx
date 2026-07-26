import { redirect } from "next/navigation";

import { TeacherLoginForm } from "@/components/TeacherLoginForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Staff sign in",
};

export default async function TeacherLoginPage() {
  let hasSession = false;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSession = Boolean(user);
  } catch {
    // The form displays configuration errors when credentials are unavailable.
  }

  if (hasSession) {
    redirect("/teacher");
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
