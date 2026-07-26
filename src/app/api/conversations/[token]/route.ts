import { NextResponse } from "next/server";
import twilio from "twilio";

import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ token: string }>;
};

async function currentUserId() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const admin = createAdminClient();
    const { data: conversation } = await admin
      .from("conversations")
      .select(
        "id, teacher_id, school_id, status, parent_language, expires_at, created_at",
      )
      .eq("public_token", token)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json(
        { error: "This conversation link is invalid." },
        { status: 404 },
      );
    }

    const expired = new Date(conversation.expires_at).getTime() <= Date.now();
    let status = conversation.status as string;

    if (expired && status !== "ended") {
      status = "ended";
      await Promise.all([
        admin
          .from("conversations")
          .update({ status: "ended", ended_at: conversation.expires_at })
          .eq("id", conversation.id),
        admin
          .from("conversation_messages")
          .delete()
          .eq("conversation_id", conversation.id),
      ]);
    }

    const [{ data: school }, { data: messages }, userId] = await Promise.all([
      admin.from("schools").select("name").eq("id", conversation.school_id).single(),
      admin
        .from("conversation_messages")
        .select(
          "id, speaker, source_language, target_language, original_text, translated_text, created_at",
        )
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true }),
      currentUserId(),
    ]);

    const role = userId === conversation.teacher_id ? "teacher" : "parent";

    if (role === "parent" && status !== "ended") {
      await admin
        .from("conversations")
        .update({ parent_joined_at: new Date().toISOString() })
        .eq("id", conversation.id)
        .is("parent_joined_at", null);
    }

    return NextResponse.json({
      id: conversation.id,
      status,
      expiresAt: conversation.expires_at,
      schoolName: school?.name ?? "Your school",
      role,
      messages: messages ?? [],
    });
  } catch (error) {
    console.error("Conversation lookup failed:", error);
    return NextResponse.json(
      { error: "This conversation is unavailable." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const { status } = (await request.json()) as { status?: string };

    if (status !== "active" && status !== "ended") {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const userId = await currentUserId();
    if (!userId) {
      return NextResponse.json({ error: "Teacher sign-in required." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: conversation } = await admin
      .from("conversations")
      .select("id, teacher_id, twilio_session_sid")
      .eq("public_token", token)
      .maybeSingle();

    if (!conversation || conversation.teacher_id !== userId) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    await admin
      .from("conversations")
      .update({
        status,
        ...(status === "active"
          ? { started_at: new Date().toISOString() }
          : {}),
        ended_at: status === "ended" ? new Date().toISOString() : null,
      })
      .eq("id", conversation.id);

    if (status === "ended") {
      await admin
        .from("conversation_messages")
        .delete()
        .eq("conversation_id", conversation.id);
    }

    if (status === "ended" && conversation.twilio_session_sid) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const proxyServiceSid = process.env.TWILIO_PROXY_SERVICE_SID;

      if (accountSid && authToken && proxyServiceSid) {
        try {
          const client = twilio(accountSid, authToken);
          await client.proxy.v1
            .services(proxyServiceSid)
            .sessions(conversation.twilio_session_sid)
            .update({ status: "closed" });
        } catch (twilioError) {
          console.error("Twilio Proxy session close failed:", twilioError);
        }
      }
    }

    return NextResponse.json({ ok: true, status });
  } catch (error) {
    console.error("Conversation status update failed:", error);
    return NextResponse.json(
      { error: "The conversation could not be updated." },
      { status: 500 },
    );
  }
}
