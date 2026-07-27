import { NextResponse } from "next/server";
import twilio from "twilio";

import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/request-user";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { token } = await context.params;
    const admin = createAdminClient();
    const { data: conversation } = await admin
      .from("conversations")
      .select(
        "id, teacher_id, host_user_id, conversation_type, school_id, status, parent_language, expires_at, created_at",
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
      conversation.school_id
        ? admin
            .from("schools")
            .select("name")
            .eq("id", conversation.school_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("conversation_messages")
        .select(
          "id, speaker, source_language, target_language, original_text, translated_text, created_at",
        )
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true }),
      getRequestUser(request).then((user) => user?.id ?? null),
    ]);

    const hostId = conversation.host_user_id ?? conversation.teacher_id;
    const role = userId === hostId ? "teacher" : "parent";

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
      conversationType: conversation.conversation_type,
      expiresAt: conversation.expires_at,
      schoolName:
        conversation.conversation_type === "consumer"
          ? "Isfaham conversation"
          : school?.name ?? "Your school",
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

    const userId = (await getRequestUser(request))?.id ?? null;
    if (!userId) {
      return NextResponse.json({ error: "Teacher sign-in required." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: conversation } = await admin
      .from("conversations")
      .select(
        "id, teacher_id, host_user_id, conversation_type, twilio_session_sid",
      )
      .eq("public_token", token)
      .maybeSingle();

    const hostId = conversation?.host_user_id ?? conversation?.teacher_id;
    if (!conversation || hostId !== userId) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    if (
      status === "active" &&
      conversation.conversation_type === "consumer" &&
      conversation.host_user_id
    ) {
      const { data: wallet } = await admin
        .from("credit_wallets")
        .select("balance_seconds")
        .eq("user_id", conversation.host_user_id)
        .maybeSingle();
      if (!wallet || wallet.balance_seconds < 60) {
        return NextResponse.json(
          { error: "Add Translation Credits before starting this conversation." },
          { status: 402 },
        );
      }
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
