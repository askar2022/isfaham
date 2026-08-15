import { fetch } from "expo/fetch";
import { File } from "expo-file-system";

import { requireApiUrl } from "./config";

export type VoiceMessageDraft = {
  id: string;
  public_token?: string;
  parent_phone_last_four?: string;
  status: string;
  english_text?: string | null;
  somali_text?: string | null;
  expires_at?: string;
};

export type VoiceMessageHistoryItem = {
  id: string;
  parent_phone_last_four: string;
  status: string;
  delivery_status: string | null;
  english_text: string | null;
  somali_text: string | null;
  link_opened_at: string | null;
  audio_played_at: string | null;
  sent_at: string | null;
  expires_at: string;
  created_at: string;
  sender_email: string;
};

async function responseBody<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(body.error || "Please try again.");
  }
  return body;
}

function authHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function createVoiceMessage(
  parentPhone: string,
  accessToken: string,
) {
  const response = await fetch(`${requireApiUrl()}/api/voice-messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({ parentPhone }),
  });
  return responseBody<{ message: VoiceMessageDraft }>(response);
}

export async function transcribeVoiceMessage(
  messageId: string,
  uri: string,
  accessToken: string,
) {
  const form = new FormData();
  form.append("audio", new File(uri));
  const response = await fetch(
    `${requireApiUrl()}/api/voice-messages/${messageId}/transcribe`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: form,
    },
  );
  return responseBody<{ message: VoiceMessageDraft }>(response);
}

export async function updateVoiceMessageEnglish(
  messageId: string,
  englishText: string,
  accessToken: string,
) {
  const response = await fetch(
    `${requireApiUrl()}/api/voice-messages/${messageId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(accessToken),
      },
      body: JSON.stringify({ englishText }),
    },
  );
  return responseBody<{ message: VoiceMessageDraft }>(response);
}

export async function translateVoiceMessage(
  messageId: string,
  accessToken: string,
) {
  const response = await fetch(
    `${requireApiUrl()}/api/voice-messages/${messageId}/translate`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
    },
  );
  return responseBody<{
    message: VoiceMessageDraft;
    audioBase64: string;
    audioMimeType: string;
  }>(response);
}

export async function sendVoiceMessage(
  messageId: string,
  accessToken: string,
) {
  const response = await fetch(
    `${requireApiUrl()}/api/voice-messages/${messageId}/send`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
    },
  );
  return responseBody<{
    message: VoiceMessageDraft;
    listenUrl: string;
    smsSent: boolean;
    warning?: string;
  }>(response);
}

export async function listVoiceMessages(accessToken: string) {
  const response = await fetch(`${requireApiUrl()}/api/voice-messages`, {
    headers: authHeaders(accessToken),
  });
  return responseBody<{ messages: VoiceMessageHistoryItem[] }>(response);
}
