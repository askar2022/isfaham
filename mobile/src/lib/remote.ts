import { fetch } from "expo/fetch";
import { File } from "expo-file-system";

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export type RemoteMessage = {
  id: string;
  speaker: "teacher" | "parent";
  source_language: "so" | "en";
  target_language: "so" | "en";
  original_text: string;
  translated_text: string;
  created_at: string;
};

export type RemoteRoom = {
  id: string;
  status: "waiting" | "active" | "ended";
  expiresAt: string;
  schoolName: string;
  role: "teacher" | "parent";
  messages: RemoteMessage[];
};

function requireApiUrl() {
  if (!apiUrl) {
    throw new Error("The app is not connected to Isfaham.");
  }
  return apiUrl;
}

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

export async function requestStaffCode(email: string) {
  const response = await fetch(`${requireApiUrl()}/api/auth/request-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  await responseBody<{ ok: boolean }>(response);
}

export async function createRemoteConversation(
  teacherPhone: string,
  parentPhone: string,
  accessToken: string,
) {
  const response = await fetch(`${requireApiUrl()}/api/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(accessToken),
    },
    body: JSON.stringify({ teacherPhone, parentPhone }),
  });
  return responseBody<{
    conversationUrl: string;
    publicToken: string;
    smsSent: boolean;
    warning?: string;
  }>(response);
}

export async function getRemoteRoom(token: string, accessToken: string) {
  const response = await fetch(
    `${requireApiUrl()}/api/conversations/${token}`,
    {
      headers: authHeaders(accessToken),
    },
  );
  return responseBody<RemoteRoom>(response);
}

export async function updateRemoteRoom(
  token: string,
  status: "active" | "ended",
  accessToken: string,
) {
  const response = await fetch(
    `${requireApiUrl()}/api/conversations/${token}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(accessToken),
      },
      body: JSON.stringify({ status }),
    },
  );
  await responseBody<{ ok: boolean }>(response);
}

export async function translateRemoteTurn(
  token: string,
  uri: string,
  durationMs: number,
  accessToken: string,
) {
  const form = new FormData();
  form.append("audio", new File(uri));
  form.append("durationMs", String(durationMs));
  const response = await fetch(
    `${requireApiUrl()}/api/conversations/${token}/translate`,
    {
      method: "POST",
      headers: authHeaders(accessToken),
      body: form,
    },
  );
  return responseBody<{
    audioBase64: string;
    audioMimeType: string;
  }>(response);
}

export async function speakRemoteMessage(token: string, messageId: string) {
  const response = await fetch(
    `${requireApiUrl()}/api/conversations/${token}/speak`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    },
  );
  return responseBody<{ audioBase64: string; audioMimeType: string }>(response);
}
