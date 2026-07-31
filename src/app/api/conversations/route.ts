import { NextResponse } from "next/server";
import twilio from "twilio";

import { consumeRateLimit, getClientIp } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/request-user";

function normalizeUsPhone(phone?: string) {
  const digits = phone?.replace(/\D/g, "") ?? "";

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
}

type ConversationRecord = {
  id: string;
  public_token: string;
};

export async function POST(request: Request) {
  try {
    const { parentPhone, teacherPhone, conversationType } =
      (await request.json()) as {
      parentPhone?: string;
      teacherPhone?: string;
      conversationType?: "school" | "consumer";
    };
    const isConsumer = conversationType === "consumer";
    const normalizedParentPhone = normalizeUsPhone(parentPhone);
    const normalizedTeacherPhone = normalizeUsPhone(teacherPhone);

    if (
      !isConsumer &&
      (!normalizedParentPhone ||
        !normalizedTeacherPhone)
    ) {
      return NextResponse.json(
        {
          error:
            "Enter both 10-digit US phone numbers, including the area code.",
        },
        { status: 400 },
      );
    }

    if (
      !isConsumer &&
      normalizedParentPhone === normalizedTeacherPhone
    ) {
      return NextResponse.json(
        { error: "Teacher and parent phone numbers must be different." },
        { status: 400 },
      );
    }

    const user = await getRequestUser(request);

    if (!user) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const [userAllowed, ipAllowed] = await Promise.all([
      consumeRateLimit({
        scope: "conversation-create-user",
        identifier: user.id,
        maximumRequests: 10,
        windowSeconds: 3_600,
      }),
      consumeRateLimit({
        scope: "conversation-create-ip",
        identifier: getClientIp(request),
        maximumRequests: 20,
        windowSeconds: 3_600,
      }),
    ]);
    if (!userAllowed || !ipAllowed) {
      return NextResponse.json(
        { error: "Too many conversation requests. Please try again later." },
        { status: 429 },
      );
    }

    const supabase = createAdminClient();

    if (isConsumer && user.is_anonymous) {
      return NextResponse.json(
        { error: "Create an Individual account before inviting someone." },
        { status: 403 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("school_id, email")
      .eq("id", user.id)
      .maybeSingle();

    if (!isConsumer && (profileError || !profile)) {
      return NextResponse.json(
        { error: "Your teacher profile is not ready." },
        { status: 403 },
      );
    }
    if (!isConsumer && profile) {
      const { data: activeApproval } = await supabase
        .from("approved_teachers")
        .select("email")
        .eq("email", profile.email.toLowerCase())
        .eq("school_id", profile.school_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!activeApproval) {
        return NextResponse.json(
          { error: "Your school access is no longer active." },
          { status: 403 },
        );
      }
    }

    const { data, error: conversationError } = await supabase
      .from("conversations")
      .insert({
        teacher_id: isConsumer ? null : user.id,
        school_id: isConsumer ? null : profile?.school_id,
        host_user_id: isConsumer ? user.id : null,
        conversation_type: isConsumer ? "consumer" : "school",
        parent_phone_last_four:
          !isConsumer && normalizedParentPhone
            ? normalizedParentPhone.slice(-4)
            : null,
      })
      .select("id, public_token")
      .single<ConversationRecord>();

    if (conversationError || !data) {
      throw conversationError ?? new Error("Conversation was not created.");
    }

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      new URL(request.url).origin;
    const conversationUrl = `${siteUrl}/c/${data.public_token}`;

    if (isConsumer) {
      await supabase
        .from("conversations")
        .update({ invitation_status: "manual" })
        .eq("id", data.id);

      return NextResponse.json({
        conversationId: data.id,
        conversationUrl,
        publicToken: data.public_token,
        smsSent: false,
      });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const proxyServiceSid = process.env.TWILIO_PROXY_SERVICE_SID;
    let smsSent = false;
    let smsError: string | undefined;

    if (accountSid && authToken && proxyServiceSid) {
      try {
        const client = twilio(accountSid, authToken);
        const session = await client.proxy.v1
          .services(proxyServiceSid)
          .sessions.create({
            uniqueName: `isfaham-${data.id}`,
            mode: "message-only",
            ttl: 60,
          });

        const teacherParticipant = await client.proxy.v1
          .services(proxyServiceSid)
          .sessions(session.sid)
          .participants.create({
            identifier: normalizedTeacherPhone!,
            friendlyName: "Teacher",
          });

        await client.proxy.v1
          .services(proxyServiceSid)
          .sessions(session.sid)
          .participants.create({
            identifier: normalizedParentPhone!,
            friendlyName: "Parent",
          });

        await client.messages.create({
          from: teacherParticipant.proxyIdentifier,
          to: normalizedParentPhone!,
          body: `Your school invited you to an Isfaham Somali-English conversation. Open this private link: ${conversationUrl}\n\nThe link expires in 60 minutes.`,
        });

        await supabase
          .from("conversations")
          .update({
            twilio_session_sid: session.sid,
            invitation_status: "sent",
            invitation_sent_at: new Date().toISOString(),
          })
          .eq("id", data.id);
        smsSent = true;
      } catch (twilioError) {
        console.error("Twilio Proxy invitation failed:", twilioError);
        await supabase
          .from("conversations")
          .update({ invitation_status: "failed" })
          .eq("id", data.id);
        smsError =
          "The conversation was created, but the text message could not be sent.";
      }
    } else {
      await supabase
        .from("conversations")
        .update({ invitation_status: "manual" })
        .eq("id", data.id);
      smsError =
        "Twilio is not configured. Copy and share the private link manually.";
    }

    return NextResponse.json({
      conversationId: data.id,
      conversationUrl,
      publicToken: data.public_token,
      smsSent,
      warning: smsError,
    });
  } catch (error) {
    console.error("Conversation creation failed:", error);
    return NextResponse.json(
      { error: "We could not create the conversation. Please try again." },
      { status: 500 },
    );
  }
}
