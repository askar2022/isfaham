import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const { email: rawEmail, portal = "school" } = (await request.json()) as {
      email?: string;
      portal?: "platform" | "school";
    };
    const email = rawEmail?.trim().toLowerCase();

    if (
      !email ||
      !EMAIL_PATTERN.test(email) ||
      !["platform", "school"].includes(portal)
    ) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    }

    const [emailAllowed, ipAllowed] = await Promise.all([
      consumeRateLimit({
        scope: "otp-email",
        identifier: email,
        maximumRequests: 3,
        windowSeconds: 3_600,
      }),
      consumeRateLimit({
        scope: "otp-ip",
        identifier: getClientIp(request),
        maximumRequests: 15,
        windowSeconds: 3_600,
      }),
    ]);
    if (!emailAllowed || !ipAllowed) {
      return NextResponse.json(
        { error: "Too many sign-in requests. Please try again later." },
        { status: 429 },
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

    const authorized =
      portal === "platform" ? Boolean(platformAdmin) : Boolean(approvedTeacher);
    if (!authorized) {
      return NextResponse.json({ ok: true });
    }

    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        full_name:
          portal === "platform"
            ? platformAdmin?.full_name
            : approvedTeacher?.full_name,
        school_id: portal === "school" ? approvedTeacher?.school_id : undefined,
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
      destination: portal === "platform" ? "/admin/personal" : "/teacher",
    });
  } catch (error) {
    console.error("Teacher OTP request failed:", error);
    return NextResponse.json(
      { error: "We could not send a sign-in code. Please try again." },
      { status: 500 },
    );
  }
}
