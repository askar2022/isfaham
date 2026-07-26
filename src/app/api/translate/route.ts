import { NextResponse } from "next/server";

import { isLanguage, translateAudio } from "@/lib/azure";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const audio = form.get("audio");
    const source = String(form.get("source") ?? "");
    const target = String(form.get("target") ?? "");

    if (!(audio instanceof File) || !isLanguage(source) || !isLanguage(target)) {
      return NextResponse.json(
        { error: "Audio, source language, and target language are required." },
        { status: 400 },
      );
    }

    if (source === target) {
      return NextResponse.json(
        { error: "Source and target languages must be different." },
        { status: 400 },
      );
    }

    if (audio.size > 4_000_000) {
      return NextResponse.json(
        { error: "Recording is too large. Keep each turn under one minute." },
        { status: 413 },
      );
    }

    return NextResponse.json(await translateAudio(audio, source, target));
  } catch (error) {
    console.error("Conversation translation failed:", error);
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
