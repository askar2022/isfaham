import twilio from "twilio";

export type DeliveryChannel = "sms" | "whatsapp";

export function normalizeUsPhone(phone?: string) {
  const digits = phone?.replace(/\D/g, "") ?? "";

  if (digits.length === 10) {
    return `+1${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  return null;
}

function asWhatsAppAddress(phone: string) {
  const e164 = phone.startsWith("+") ? phone : `+${phone}`;
  return e164.startsWith("whatsapp:") ? e164 : `whatsapp:${e164}`;
}

function resolveFromNumber(channel: DeliveryChannel) {
  if (channel === "whatsapp") {
    const dedicated = process.env.TWILIO_WHATSAPP_FROM_NUMBER?.trim();
    if (dedicated) {
      return asWhatsAppAddress(dedicated.replace(/^whatsapp:/, ""));
    }
  }

  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!fromNumber) return null;
  if (channel === "whatsapp") {
    return asWhatsAppAddress(fromNumber.replace(/^whatsapp:/, ""));
  }
  return fromNumber.replace(/^whatsapp:/, "");
}

export async function sendParentMessage(input: {
  channel: DeliveryChannel;
  toE164: string;
  body: string;
  listenUrl?: string;
  mediaUrl?: string;
}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim();
  const fromNumber = resolveFromNumber(input.channel);
  const channelLabel = input.channel === "whatsapp" ? "WhatsApp" : "SMS";

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return {
      ok: false as const,
      warning: `${channelLabel} is not fully configured. Share the listening link manually.`,
      sid: null as string | null,
    };
  }

  const to =
    input.channel === "whatsapp"
      ? asWhatsAppAddress(input.toE164)
      : input.toE164;

  try {
    const client = twilio(accountSid, authToken);
    const contentSid = process.env.TWILIO_WHATSAPP_CONTENT_SID?.trim();
    const createParams: {
      to: string;
      from?: string;
      messagingServiceSid?: string;
      body?: string;
      contentSid?: string;
      contentVariables?: string;
      mediaUrl?: string[];
    } = { to };

    if (messagingServiceSid) {
      createParams.messagingServiceSid = messagingServiceSid;
    } else if (fromNumber) {
      createParams.from = fromNumber;
    }

    if (input.channel === "whatsapp" && contentSid) {
      createParams.contentSid = contentSid;
      createParams.contentVariables = JSON.stringify({
        "1": input.listenUrl ?? input.body,
      });
    } else {
      createParams.body = input.body;
      if (input.channel === "whatsapp" && input.mediaUrl) {
        createParams.mediaUrl = [input.mediaUrl];
      }
    }

    const message = await client.messages.create(createParams);

    return {
      ok: true as const,
      warning: undefined as string | undefined,
      sid: message.sid,
    };
  } catch (error) {
    console.error(`Twilio ${channelLabel} send failed:`, error);
    return {
      ok: false as const,
      warning: `${channelLabel} could not be sent. Share the listening link manually, then check Twilio.`,
      sid: null as string | null,
    };
  }
}

/** @deprecated Prefer sendParentMessage({ channel: "sms", ... }) */
export async function sendParentSms(input: {
  toE164: string;
  body: string;
}) {
  return sendParentMessage({
    channel: "sms",
    toE164: input.toE164,
    body: input.body,
  });
}
