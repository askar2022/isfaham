import { fetch } from "expo/fetch";
import { File } from "expo-file-system";

import { requireApiUrl } from "./config";
import { getInstallId } from "./install";

export type LanguageCode = "so" | "en";

export type TranslationResult = {
  originalText: string;
  translatedText: string;
  audioBase64: string;
  audioMimeType: string;
  source: LanguageCode;
  target: LanguageCode;
};

export async function translateRecording(
  uri: string,
  source: LanguageCode,
  target: LanguageCode,
  accessToken: string,
): Promise<TranslationResult> {
  const apiUrl = requireApiUrl();

  const form = new FormData();
  form.append("source", source);
  form.append("target", target);
  form.append(
    "audio",
    new File(uri),
  );

  const response = await fetch(`${apiUrl}/api/translate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Isfaham-Install-Id": await getInstallId(),
    },
    body: form,
  });

  const body = (await response.json()) as TranslationResult & { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Translation failed. Please try again.");
  }

  return body;
}
