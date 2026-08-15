import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isVoiceMessageExpired } from "@/lib/voice-messages";

export async function POST(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("voice_messages")
      .select(
        "id, status, expires_at, somali_audio_base64, audio_played_at, link_opened_at",
      )
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

    const updates: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };
    if (!data.link_opened_at) {
      updates.link_opened_at = new Date().toISOString();
    }
    if (!data.audio_played_at) {
      updates.audio_played_at = new Date().toISOString();
    }
    await admin.from("voice_messages").update(updates).eq("id", data.id);

    return NextResponse.json({
      audioBase64: data.somali_audio_base64,
      audioMimeType: "audio/mpeg",
    });
  } catch (error) {
    console.error("Voice message play failed:", error);
    return NextResponse.json(
      { error: "Unable to play this message." },
      { status: 500 },
    );
  }
}
