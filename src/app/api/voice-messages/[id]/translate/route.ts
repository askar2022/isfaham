import { NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/rate-limit";
import { synthesizeSpeech, translateText } from "@/lib/azure";
import { getRequestUser } from "@/lib/supabase/request-user";
import { requireSchoolSender } from "@/lib/voice-messages";

export const runtime = "nodejs";

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
      scope: "voice-message-translate",
      identifier: user.id,
      maximumRequests: 60,
      windowSeconds: 3_600,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many translations. Please try again later." },
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
      .select("id, sender_user_id, status, english_text")
      .eq("id", id)
      .eq("school_id", sender.profile.school_id)
      .maybeSingle();

    if (!existing || existing.sender_user_id !== user.id) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    if (existing.status === "sent") {
      return NextResponse.json(
        { error: "Sent messages cannot be changed." },
        { status: 409 },
      );
    }
    if (!existing.english_text?.trim()) {
      return NextResponse.json(
        { error: "Record and review the English message first." },
        { status: 400 },
      );
    }

    const somaliText = await translateText(existing.english_text, "en", "so");
    const speech = await synthesizeSpeech(somaliText, "so");

    const { data, error } = await sender.admin
      .from("voice_messages")
      .update({
        somali_text: somaliText,
        somali_audio_base64: speech.audioBase64,
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, english_text, somali_text, status")
      .single();

    if (error || !data) {
      throw error ?? new Error("Translate save failed.");
    }

    return NextResponse.json({
      message: data,
      audioBase64: speech.audioBase64,
      audioMimeType: speech.audioMimeType,
    });
  } catch (error) {
    console.error("Voice message translate failed:", error);
    return NextResponse.json(
      { error: "Unable to create the Somali message." },
      { status: 500 },
    );
  }
}
