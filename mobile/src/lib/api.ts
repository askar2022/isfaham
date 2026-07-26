export type LanguageCode = "so" | "en";

export type TranslationResult = {
  originalText: string;
  translatedText: string;
  audioBase64: string;
  audioMimeType: string;
  source: LanguageCode;
  target: LanguageCode;
};

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export async function translateRecording(
  uri: string,
  source: LanguageCode,
  target: LanguageCode,
): Promise<TranslationResult> {
  if (!apiUrl) {
    throw new Error(
      "The app is not connected yet. Add EXPO_PUBLIC_API_URL to mobile/.env.",
    );
  }

  const form = new FormData();
  form.append("source", source);
  form.append("target", target);
  form.append(
    "audio",
    {
      uri,
      name: `isfaham-${Date.now()}.m4a`,
      type: "audio/mp4",
    } as unknown as Blob,
  );

  const response = await fetch(`${apiUrl}/api/translate`, {
    method: "POST",
    body: form,
  });

  const body = (await response.json()) as TranslationResult & { error?: string };

  if (!response.ok) {
    throw new Error(body.error || "Translation failed. Please try again.");
  }

  return body;
}
