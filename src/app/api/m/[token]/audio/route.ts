import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isVoiceMessageExpired } from "@/lib/voice-messages";

/** Public audio URL for Twilio WhatsApp media and parent playback. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("voice_messages")
      .select("id, status, expires_at, somali_audio_base64")
      .eq("public_token", token)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!data || data.status === "deleted") {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    if (isVoiceMessageExpired(data.expires_at) || data.status === "expired") {
      return NextResponse.json(
        { error: "This message link has expired." },
        { status: 410 },
      );
    }
    if (!data.somali_audio_base64) {
      return NextResponse.json(
        { error: "Audio is not available." },
        { status: 404 },
      );
    }

    const audio = Buffer.from(data.somali_audio_base64, "base64");
    return new NextResponse(audio, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    console.error("Voice message audio fetch failed:", error);
    return NextResponse.json(
      { error: "Unable to load this audio." },
      { status: 500 },
    );
  }
}
