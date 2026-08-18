import { NextResponse } from "next/server";

import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { getRequestUser } from "@/lib/supabase/request-user";
import { normalizeUsPhone } from "@/lib/twilio-sms";
import { requireSchoolSender } from "@/lib/voice-messages";

export async function GET(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const sender = await requireSchoolSender(user.id, user.email);
    if (!sender.ok) {
      return NextResponse.json({ error: sender.reason }, { status: 403 });
    }

    const { data, error } = await sender.admin
      .from("voice_messages")
      .select(
        "id, parent_phone_last_four, status, delivery_status, delivery_channel, english_text, somali_text, link_opened_at, audio_played_at, sent_at, expires_at, created_at, sender_email",
      )
      .eq("school_id", sender.profile.school_id)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({ messages: data ?? [] });
  } catch (error) {
    console.error("Voice message history failed:", error);
    return NextResponse.json(
      { error: "Unable to load message history." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const allowed = await consumeRateLimit({
      scope: "voice-message-create",
      identifier: user.id,
      maximumRequests: 40,
      windowSeconds: 3_600,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many messages. Please try again later." },
        { status: 429 },
      );
    }

    const sender = await requireSchoolSender(user.id, user.email);
    if (!sender.ok) {
      return NextResponse.json({ error: sender.reason }, { status: 403 });
    }

    const body = (await request.json()) as { parentPhone?: string };
    const parentPhone = normalizeUsPhone(body.parentPhone);
    if (!parentPhone) {
      return NextResponse.json(
        { error: "Enter a valid U.S. parent phone number." },
        { status: 400 },
      );
    }

    const ipAllowed = await consumeRateLimit({
      scope: "voice-message-create-ip",
      identifier: getClientIp(request),
      maximumRequests: 80,
      windowSeconds: 3_600,
    });
    if (!ipAllowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }

    const { data, error } = await sender.admin
      .from("voice_messages")
      .insert({
        school_id: sender.profile.school_id,
        sender_user_id: user.id,
        sender_email: sender.profile.email,
        parent_phone_e164: parentPhone,
        parent_phone_last_four: parentPhone.slice(-4),
        status: "draft",
      })
      .select("id, public_token, parent_phone_last_four, status, expires_at")
      .single();

    if (error || !data) {
      throw error ?? new Error("Message create failed.");
    }

    return NextResponse.json({ message: data });
  } catch (error) {
    console.error("Voice message create failed:", error);
    return NextResponse.json(
      { error: "Unable to start this message." },
      { status: 500 },
    );
  }
}
