import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isVoiceMessageExpired } from "@/lib/voice-messages";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("voice_messages")
      .select(
        "id, public_token, status, somali_text, expires_at, link_opened_at, school_id, schools(name)",
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
      if (data.status !== "expired") {
        await admin
          .from("voice_messages")
          .update({ status: "expired", updated_at: new Date().toISOString() })
          .eq("id", data.id);
      }
      return NextResponse.json(
        { error: "This message link has expired." },
        { status: 410 },
      );
    }
    if (data.status !== "sent" && data.status !== "failed") {
      return NextResponse.json(
        { error: "This message is not available yet." },
        { status: 404 },
      );
    }

    if (!data.link_opened_at) {
      await admin
        .from("voice_messages")
        .update({
          link_opened_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    }

    const schoolRelation = data.schools as
      | { name?: string }
      | { name?: string }[]
      | null;
    const schoolName = Array.isArray(schoolRelation)
      ? schoolRelation[0]?.name
      : schoolRelation?.name;

    return NextResponse.json({
      schoolName: schoolName || "Your child’s school",
      somaliText: data.somali_text,
      expiresAt: data.expires_at,
    });
  } catch (error) {
    console.error("Voice message listen metadata failed:", error);
    return NextResponse.json(
      { error: "Unable to open this message." },
      { status: 500 },
    );
  }
}
