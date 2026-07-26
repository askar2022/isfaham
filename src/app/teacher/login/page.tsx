import { Languages } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

import { TeacherLoginForm } from "@/components/TeacherLoginForm";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Teacher sign in",
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
      <Link className="auth-brand" href="/">
        <span>
          <Languages size={22} />
        </span>
        <strong>Isfaham</strong>
      </Link>
      <TeacherLoginForm />
      <p className="auth-support">
        Need access? Contact your school administrator.
      </p>
    </main>
  );
}
