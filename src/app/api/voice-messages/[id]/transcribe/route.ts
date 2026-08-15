import { NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/rate-limit";
import { transcribeAudio } from "@/lib/azure";
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
      scope: "voice-message-transcribe",
      identifier: user.id,
      maximumRequests: 60,
      windowSeconds: 3_600,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many recordings. Please try again later." },
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
      .select("id, sender_user_id, status")
      .eq("id", id)
      .eq("school_id", sender.profile.school_id)
      .maybeSingle();

    if (!existing || existing.sender_user_id !== user.id) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }
    if (existing.status === "sent") {
      return NextResponse.json(
        { error: "Sent messages cannot be re-recorded." },
        { status: 409 },
      );
    }

    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "Audio recording is required." },
        { status: 400 },
      );
    }

    const transcription = await transcribeAudio(audio, "en");
    if (!transcription.text) {
      return NextResponse.json(
        { error: "We could not hear that clearly. Please try again." },
        { status: 422 },
      );
    }

    const { data, error } = await sender.admin
      .from("voice_messages")
      .update({
        english_text: transcription.text,
        somali_text: null,
        somali_audio_base64: null,
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, english_text, status")
      .single();

    if (error || !data) {
      throw error ?? new Error("Transcribe save failed.");
    }

    return NextResponse.json({ message: data });
  } catch (error) {
    console.error("Voice message transcribe failed:", error);
    return NextResponse.json(
      { error: "Unable to transcribe this recording." },
      { status: 500 },
    );
  }
}
