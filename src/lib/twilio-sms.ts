import twilio from "twilio";

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

export async function sendParentSms(input: {
  toE164: string;
  body: string;
}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();

  if (!accountSid || !authToken || !fromNumber) {
    return {
      ok: false as const,
      warning:
        "SMS is not fully configured. Share the listening link manually.",
      sid: null as string | null,
    };
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      from: fromNumber,
      to: input.toE164,
      body: input.body,
    });

    return {
      ok: true as const,
      warning: undefined as string | undefined,
      sid: message.sid,
    };
  } catch (error) {
    console.error("Twilio SMS send failed:", error);
    return {
      ok: false as const,
      warning:
        "SMS could not be sent. Share the listening link manually, then check Twilio.",
      sid: null as string | null,
    };
  }
}
