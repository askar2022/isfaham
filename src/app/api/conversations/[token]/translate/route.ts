import { NextResponse } from "next/server";

import { translateAudio } from "@/lib/azure";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/request-user";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function estimateCostMicrousd(
  durationMs: number,
  sourceCharacters: number,
  translatedCharacters: number,
) {
  const speechToTextPerHour = Number(
    process.env.AZURE_STT_USD_PER_HOUR ?? "1",
  );
  const translationPerMillionCharacters = Number(
    process.env.AZURE_TRANSLATION_USD_PER_MILLION_CHARACTERS ?? "10",
  );
  const speechPerMillionCharacters = Number(
    process.env.AZURE_TTS_USD_PER_MILLION_CHARACTERS ?? "15",
  );

  return Math.max(
    0,
    Math.round(
      (durationMs * speechToTextPerHour) / 3.6 +
        sourceCharacters * translationPerMillionCharacters +
        translatedCharacters * speechPerMillionCharacters,
    ),
  );
}

export async function POST(request: Request, context: RouteContext) {
  let conversationId: string | null = null;

  try {
    const { token } = await context.params;
    const form = await request.formData();
    const audio = form.get("audio");
    const durationMs = Number(form.get("durationMs"));

    if (!(audio instanceof File)) {
      return NextResponse.json({ error: "Audio is required." }, { status: 400 });
    }

    if (!Number.isFinite(durationMs) || durationMs < 500 || durationMs > 60_000) {
      return NextResponse.json(
        { error: "Recording duration is invalid." },
        { status: 400 },
      );
    }

    if (audio.size > 4_000_000) {
      return NextResponse.json(
        { error: "Recording is too large. Keep each turn under one minute." },
        { status: 413 },
      );
    }

    const admin = createAdminClient();
    const { data: conversation } = await admin
      .from("conversations")
      .select("id, teacher_id, status, expires_at")
      .eq("public_token", token)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json(
        { error: "This conversation link is invalid." },
        { status: 404 },
      );
    }
    conversationId = conversation.id;

    if (
      conversation.status !== "active" ||
      new Date(conversation.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "This conversation is not active." },
        { status: 409 },
      );
    }

    const { count: turnCount } = await admin
      .from("conversation_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id);

    if ((turnCount ?? 0) >= 120) {
      return NextResponse.json(
        { error: "This conversation has reached its turn limit." },
        { status: 429 },
      );
    }

    const userId = (await getRequestUser(request))?.id ?? null;
    const speaker = userId === conversation.teacher_id ? "teacher" : "parent";
    const source = speaker === "teacher" ? "en" : "so";
    const target = source === "en" ? "so" : "en";
    const result = await translateAudio(audio, source, target);

    const { data: message, error: messageError } = await admin
      .from("conversation_messages")
      .insert({
        conversation_id: conversation.id,
        speaker,
        source_language: source,
        target_language: target,
        original_text: result.originalText,
        translated_text: result.translatedText,
      })
      .select("id, created_at")
      .single();

    if (messageError || !message) {
      throw messageError ?? new Error("Translation could not be shared.");
    }

    const measuredDurationMs = Math.min(
      60_000,
      Math.max(500, result.speechDurationMs ?? durationMs),
    );
    const estimatedCostMicrousd = estimateCostMicrousd(
      measuredDurationMs,
      result.originalText.length,
      result.translatedText.length,
    );
    const { error: metricError } = await admin.rpc("record_conversation_turn", {
      conversation_uuid: conversation.id,
      duration_ms: Math.round(measuredDurationMs),
      source_characters: result.originalText.length,
      translated_characters: result.translatedText.length,
      cost_microusd: estimatedCostMicrousd,
    });

    if (metricError) {
      console.error("Conversation usage metric failed:", metricError);
    }

    return NextResponse.json({
      ...result,
      id: message.id,
      speaker,
      created_at: message.created_at,
    });
  } catch (error) {
    console.error("Shared conversation translation failed:", error);
    if (conversationId) {
      try {
        await createAdminClient().rpc("record_translation_failure", {
          conversation_uuid: conversationId,
        });
      } catch (metricError) {
        console.error("Translation failure metric failed:", metricError);
      }
    }
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The conversation could not be translated.",
      },
      { status: 500 },
    );
  }
}
