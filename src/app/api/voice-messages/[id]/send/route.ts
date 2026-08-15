import { NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestUser } from "@/lib/supabase/request-user";
import { sendParentSms } from "@/lib/twilio-sms";
import { requireSchoolSender } from "@/lib/voice-messages";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const allowed = await consumeRateLimit({
      scope: "voice-message-send",
      identifier: user.id,
      maximumRequests: 40,
      windowSeconds: 3_600,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many sends. Please try again later." },
        { status: 429 },
      );
    }

    const sender = await requireSchoolSender(user.id, user.email);
    if (!sender.ok) {
      return NextResponse.json({ error: sender.reason }, { status: 403 });
    }

    const { id } = await context.params;
    const { data: existing } = await sender.admin
      .from("voice_messages")
      .select(
        "id, sender_user_id, status, english_text, somali_text, somali_audio_base64, parent_phone_e164, public_token",
      )
      .eq("id", id)
      .eq("school_id", sender.profile.school_id)
      .maybeSingle();

    if (!existing || existing.sender_user_id !== user.id) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    if (existing.status === "sent") {
      return NextResponse.json({
        ok: true,
        alreadySent: true,
      });
    }
    if (
      !existing.english_text?.trim() ||
      !existing.somali_text?.trim() ||
      !existing.somali_audio_base64
    ) {
      return NextResponse.json(
        { error: "Preview the Somali message before sending." },
        { status: 400 },
      );
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      new URL(request.url).origin;
    const listenUrl = `${siteUrl}/m/${existing.public_token}`;
    const smsBody = `Isfaham: You received a Somali voice message from your child's school. Listen here: ${listenUrl}`;

    const sms = await sendParentSms({
      toE164: existing.parent_phone_e164,
      body: smsBody,
    });

    const { data, error } = await sender.admin
      .from("voice_messages")
      .update({
        status: sms.ok ? "sent" : "failed",
        delivery_status: sms.ok ? "sent" : sms.warning ? "manual" : "failed",
        sms_sid: sms.sid,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, delivery_status, public_token, sent_at")
      .single();

    if (error || !data) {
      throw error ?? new Error("Send update failed.");
    }

    return NextResponse.json({
      message: data,
      listenUrl,
      smsSent: sms.ok,
      warning: sms.warning,
    });
  } catch (error) {
    console.error("Voice message send failed:", error);
    return NextResponse.json(
      { error: "Unable to send this message." },
      { status: 500 },
    );
  }
}
