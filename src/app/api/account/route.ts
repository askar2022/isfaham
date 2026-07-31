import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/request-user";

export async function DELETE(request: Request) {
  const user = await getRequestUser(request, { allowBlocked: true });
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  if (user.is_anonymous) {
    return NextResponse.json(
      { error: "Guest sessions do not have an account to delete." },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const email = user.email?.trim().toLowerCase();
    const [{ data: profile }, { data: platformAdmin }, { data: schoolAccess }] =
      await Promise.all([
        admin.from("profiles").select("id").eq("id", user.id).maybeSingle(),
        email
          ? admin
              .from("platform_administrators")
              .select("email")
              .eq("email", email)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        email
          ? admin
              .from("approved_teachers")
              .select("email")
              .eq("email", email)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
    if (profile || platformAdmin || schoolAccess) {
      return NextResponse.json(
        {
          error:
            "School and administrator accounts must be removed through the organization offboarding process.",
        },
        { status: 403 },
      );
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return NextResponse.json(
      { deleted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Account deletion failed:", error);
    return NextResponse.json(
      {
        error:
          "We could not delete your account. Please try again or contact support@isfaham.org.",
      },
      { status: 500 },
    );
  }
}
