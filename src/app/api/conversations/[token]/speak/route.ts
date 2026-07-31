import { NextResponse } from "next/server";

import { isLanguage, synthesizeSpeech } from "@/lib/azure";
import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const clientIp = getClientIp(request);
    const limits = await Promise.all([
      consumeRateLimit({
        scope: "room-speak-token",
        identifier: token,
        maximumRequests: 60,
        windowSeconds: 3_600,
      }),
      consumeRateLimit({
        scope: "room-speak-ip",
        identifier: clientIp,
        maximumRequests: 120,
        windowSeconds: 3_600,
      }),
    ]);
    if (limits.some((allowed) => !allowed)) {
      return NextResponse.json(
        { error: "Audio playback limit reached. Please try again later." },
        { status: 429 },
      );
    }

    const { messageId } = (await request.json()) as { messageId?: string };

    if (!messageId) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: conversation } = await admin
      .from("conversations")
      .select("id, status, expires_at")
      .eq("public_token", token)
      .maybeSingle();

    if (
      !conversation ||
      conversation.status !== "active" ||
      new Date(conversation.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "This conversation is no longer available." },
        { status: 404 },
      );
    }

    const { data: message } = await admin
      .from("conversation_messages")
      .select("translated_text, target_language")
      .eq("id", messageId)
      .eq("conversation_id", conversation.id)
      .maybeSingle();

    if (!message || !isLanguage(message.target_language)) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    return NextResponse.json(
      await synthesizeSpeech(message.translated_text, message.target_language),
    );
  } catch (error) {
    console.error("Conversation playback failed:", error);
    return NextResponse.json(
      { error: "Audio playback is unavailable." },
      { status: 500 },
    );
  }
}
