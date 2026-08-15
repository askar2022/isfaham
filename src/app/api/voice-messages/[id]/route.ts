import { NextResponse } from "next/server";

import { getRequestUser } from "@/lib/supabase/request-user";
import { requireSchoolSender } from "@/lib/voice-messages";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const sender = await requireSchoolSender(user.id, user.email);
    if (!sender.ok) {
      return NextResponse.json({ error: sender.reason }, { status: 403 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as { englishText?: string };
    const englishText = body.englishText?.trim();
    if (!englishText || englishText.length > 4000) {
      return NextResponse.json(
        { error: "Enter an English message to review." },
        { status: 400 },
      );
    }

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
        { error: "Sent messages cannot be edited." },
        { status: 409 },
      );
    }

    const { data, error } = await sender.admin
      .from("voice_messages")
      .update({
        english_text: englishText,
        somali_text: null,
        somali_audio_base64: null,
        status: "draft",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, english_text, status")
      .single();

    if (error || !data) {
      throw error ?? new Error("Update failed.");
    }

    return NextResponse.json({ message: data });
  } catch (error) {
    console.error("Voice message update failed:", error);
    return NextResponse.json(
      { error: "Unable to update this message." },
      { status: 500 },
    );
  }
}
