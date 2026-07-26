import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireSchoolAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, school_id, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) return null;
  return { admin, profile };
}

export async function GET() {
  try {
    const context = await requireSchoolAdmin();
    if (!context) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const { data, error } = await context.admin
      .from("approved_teachers")
      .select("email, full_name, is_active, is_admin, created_at")
      .eq("school_id", context.profile.school_id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json({ teachers: data ?? [] });
  } catch (error) {
    console.error("Teacher list failed:", error);
    return NextResponse.json(
      { error: "Teachers could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireSchoolAdmin();
    if (!context) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const body = (await request.json()) as {
      email?: string;
      fullName?: string;
    };
    const email = body.email?.trim().toLowerCase();
    const fullName = body.fullName?.trim();

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid school email." },
        { status: 400 },
      );
    }

    if (email.length > 200 || (fullName?.length ?? 0) > 100) {
      return NextResponse.json(
        { error: "The name or email is too long." },
        { status: 400 },
      );
    }

    const { data: existing } = await context.admin
      .from("approved_teachers")
      .select("school_id, is_admin")
      .eq("email", email)
      .maybeSingle();

    if (existing && existing.school_id !== context.profile.school_id) {
      return NextResponse.json(
        { error: "That email is already managed by another school." },
        { status: 409 },
      );
    }

    const { data, error } = await context.admin
      .from("approved_teachers")
      .upsert(
        {
          email,
          full_name: fullName || null,
          school_id: context.profile.school_id,
          is_active: true,
          is_admin: existing?.is_admin ?? false,
        },
        { onConflict: "email" },
      )
      .select("email, full_name, is_active, is_admin, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ teacher: data });
  } catch (error) {
    console.error("Teacher approval failed:", error);
    return NextResponse.json(
      { error: "The teacher could not be added." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requireSchoolAdmin();
    if (!context) {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const body = (await request.json()) as {
      email?: string;
      isActive?: boolean;
    };
    const email = body.email?.trim().toLowerCase();

    if (!email || typeof body.isActive !== "boolean") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    if (email === context.profile.email) {
      return NextResponse.json(
        { error: "You cannot deactivate your own administrator access." },
        { status: 400 },
      );
    }

    const { data: target } = await context.admin
      .from("approved_teachers")
      .select("email, is_admin")
      .eq("email", email)
      .eq("school_id", context.profile.school_id)
      .maybeSingle();

    if (!target) {
      return NextResponse.json({ error: "Teacher not found." }, { status: 404 });
    }

    if (target.is_admin && !body.isActive) {
      return NextResponse.json(
        { error: "Administrator accounts cannot be deactivated here." },
        { status: 400 },
      );
    }

    const { data, error } = await context.admin
      .from("approved_teachers")
      .update({ is_active: body.isActive })
      .eq("email", email)
      .eq("school_id", context.profile.school_id)
      .select("email, full_name, is_active, is_admin, created_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ teacher: data });
  } catch (error) {
    console.error("Teacher access update failed:", error);
    return NextResponse.json(
      { error: "Teacher access could not be updated." },
      { status: 500 },
    );
  }
}
