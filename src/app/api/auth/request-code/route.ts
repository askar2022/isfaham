import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { email: rawEmail } = (await request.json()) as { email?: string };
    const email = rawEmail?.trim().toLowerCase();

    if (!email || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid school email address." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const [
      { data: approvedTeacher, error: approvalError },
      { data: platformAdmin, error: platformAdminError },
    ] = await Promise.all([
      admin
        .from("approved_teachers")
        .select("email, full_name, school_id")
        .eq("email", email)
        .eq("is_active", true)
        .maybeSingle(),
      admin
        .from("platform_administrators")
        .select("email, full_name")
        .eq("email", email)
        .maybeSingle(),
    ]);

    if (approvalError || platformAdminError) {
      throw approvalError ?? platformAdminError;
    }

    if (!approvedTeacher && !platformAdmin) {
      return NextResponse.json(
        {
          error:
            "Sign-in is unavailable. Contact your school or Isfaham administrator.",
        },
        { status: 403 },
      );
    }

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name: approvedTeacher?.full_name ?? platformAdmin?.full_name,
        school_id: approvedTeacher?.school_id,
      },
    });

    const userAlreadyExists =
      createError?.status === 422 ||
      createError?.message.toLowerCase().includes("already") ||
      createError?.message.toLowerCase().includes("registered");

    if (createError && !userAlreadyExists) {
      throw createError;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const publishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !publishableKey) {
      throw new Error("Supabase public credentials are not configured.");
    }

    const supabase = createClient(url, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      throw otpError;
    }

    return NextResponse.json({
      ok: true,
      destination: platformAdmin ? "/admin/personal" : "/teacher",
    });
  } catch (error) {
    console.error("Teacher OTP request failed:", error);
    return NextResponse.json(
      { error: "We could not send a sign-in code. Please try again." },
      { status: 500 },
    );
  }
}
