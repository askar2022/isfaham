import { NextResponse } from "next/server";

import { isLanguage, translateAudio } from "@/lib/azure";
import {
  claimAnonymousTrialDevice,
  consumeRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/request-user";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let reservedUserId: string | null = null;
  let reservationId: string | null = null;

  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    if (
      user.is_anonymous &&
      !(await claimAnonymousTrialDevice(request, user.id))
    ) {
      return NextResponse.json(
        { error: "The free trial has already been used on this device." },
        { status: 403 },
      );
    }

    const [userAllowed, ipAllowed] = await Promise.all([
      consumeRateLimit({
        scope: user.is_anonymous
          ? "translate-anonymous-user"
          : "translate-user",
        identifier: user.id,
        maximumRequests: user.is_anonymous ? 30 : 240,
        windowSeconds: 3_600,
      }),
      consumeRateLimit({
        scope: "translate-ip",
        identifier: getClientIp(request),
        maximumRequests: 120,
        windowSeconds: 3_600,
      }),
    ]);
    if (!userAllowed || !ipAllowed) {
      return NextResponse.json(
        { error: "Translation limit reached. Please try again later." },
        { status: 429 },
      );
    }

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

    const admin = createAdminClient();
    const { data: staffProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!staffProfile) {
      reservationId = `translation:${crypto.randomUUID()}`;
      const { data: reserved, error: reserveError } = await admin.rpc(
        "reserve_translation_credit",
        {
          account_user_id: user.id,
          reserved_seconds: 60,
          reservation_id: reservationId,
        },
      );
      if (reserveError) throw reserveError;
      if (!reserved) {
        return NextResponse.json(
          { error: "Add Translation Credits to continue." },
          { status: 402 },
        );
      }
      reservedUserId = user.id;
    }

    const result = await translateAudio(audio, source, target);

    if (reservedUserId && reservationId) {
      const usedSeconds = Math.min(
        60,
        Math.max(1, Math.ceil((result.speechDurationMs ?? 60_000) / 1000)),
      );
      const refundSeconds = 60 - usedSeconds;
      if (refundSeconds > 0) {
        const { error: refundError } = await admin.rpc(
          "refund_translation_credit",
          {
            account_user_id: reservedUserId,
            refunded_seconds: refundSeconds,
            reservation_id: reservationId,
          },
        );
        if (refundError) {
          console.error("Translation credit refund failed:", refundError);
        }
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    if (reservedUserId && reservationId) {
      try {
        await createAdminClient().rpc("refund_translation_credit", {
          account_user_id: reservedUserId,
          refunded_seconds: 60,
          reservation_id: reservationId,
        });
      } catch (refundError) {
        console.error("Failed translation credit refund failed:", refundError);
      }
    }
    console.error("Conversation translation failed:", error);
    return NextResponse.json(
      { error: "The conversation could not be translated. Please try again." },
      { status: 500 },
    );
  }
}
