import { redirect } from "next/navigation";

import { AdminTeacherPortal } from "@/components/AdminTeacherPortal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Manage school staff",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/teacher/login");
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("school_id, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect("/teacher");
  }

  const [{ data: school }, { data: teachers }] = await Promise.all([
    admin.from("schools").select("name").eq("id", profile.school_id).single(),
    admin
      .from("approved_teachers")
      .select("email, full_name, is_active, is_admin, created_at")
      .eq("school_id", profile.school_id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <AdminTeacherPortal
      initialTeachers={teachers ?? []}
      schoolName={school?.name ?? "Your school"}
    />
  );
}
