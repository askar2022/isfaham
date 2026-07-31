const LANGUAGES = {
  so: {
    locale: "so-SO",
    voice: "so-SO-UbaxNeural",
  },
  en: {
    locale: "en-US",
    voice: "en-US-AvaMultilingualNeural",
  },
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

type TranscriptionResponse = {
  durationMilliseconds?: number;
  combinedPhrases?: Array<{ text?: string }>;
};

type TranslationResponse = Array<{
  translations?: Array<{ text?: string }>;
}>;

export function isLanguage(value: string): value is LanguageCode {
  return value in LANGUAGES;
}

function getSpeechCredentials() {
  const endpoint = process.env.AZURE_SPEECH_ENDPOINT?.replace(/\/$/, "");
  const key = process.env.AZURE_SPEECH_KEY;

  if (!endpoint || !key) {
    throw new Error("Azure Speech has not been configured.");
  }

  return { endpoint, key };
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function requireOk(response: Response, service: string) {
  if (!response.ok) {
    console.error(`${service} failed with status ${response.status}.`);
    throw new Error(`${service} could not process this conversation.`);
  }

  return response;
}

export async function transcribeAudio(
  audio: File,
  source: LanguageCode,
): Promise<{ text: string; durationMs: number | null }> {
  const { endpoint, key } = getSpeechCredentials();
  const body = new FormData();
  body.append("audio", audio, audio.name || "conversation.m4a");
  body.append(
    "definition",
    JSON.stringify({ locales: [LANGUAGES[source].locale] }),
  );

  const response = await requireOk(
    await fetch(
      `${endpoint}/speechtotext/transcriptions:transcribe?api-version=2025-10-15`,
      {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": key },
        body,
        cache: "no-store",
      },
    ),
    "Azure speech recognition",
  );
  const result = (await response.json()) as TranscriptionResponse;
  const text = result.combinedPhrases?.[0]?.text?.trim();

  if (!text) {
    throw new Error("We could not hear that clearly. Please try again.");
  }

  return {
    text,
    durationMs:
      typeof result.durationMilliseconds === "number"
        ? result.durationMilliseconds
        : null,
  };
}

export async function translateText(
  text: string,
  source: LanguageCode,
  target: LanguageCode,
): Promise<string> {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;

  if (!key || !region) {
    throw new Error("Azure Translator has not been configured.");
  }

  const response = await requireOk(
    await fetch(
      `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=${source}&to=${target}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": key,
          "Ocp-Apim-Subscription-Region": region,
        },
        body: JSON.stringify([{ text }]),
        cache: "no-store",
      },
    ),
    "Azure Translator",
  );
  const result = (await response.json()) as TranslationResponse;
  const translatedText = result[0]?.translations?.[0]?.text?.trim();

  if (!translatedText) {
    throw new Error("Azure Translator returned an empty translation.");
  }

  return translatedText;
}

export async function synthesizeSpeech(
  text: string,
  language: LanguageCode,
): Promise<{ audioBase64: string; audioMimeType: "audio/mpeg" }> {
  const { endpoint, key } = getSpeechCredentials();
  const config = LANGUAGES[language];
  const ssml = [
    `<speak version="1.0" xml:lang="${config.locale}">`,
    `<voice name="${config.voice}">`,
    escapeXml(text),
    "</voice>",
    "</speak>",
  ].join("");

  const response = await requireOk(
    await fetch(`${endpoint}/tts/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/ssml+xml",
        "Ocp-Apim-Subscription-Key": key,
        "X-Microsoft-OutputFormat": "audio-16khz-64kbitrate-mono-mp3",
        "User-Agent": "Isfaham",
      },
      body: ssml,
      cache: "no-store",
    }),
    "Azure speech synthesis",
  );

  return {
    audioBase64: Buffer.from(await response.arrayBuffer()).toString("base64"),
    audioMimeType: "audio/mpeg",
  };
}

export async function translateAudio(
  audio: File,
  source: LanguageCode,
  target: LanguageCode,
) {
  const transcription = await transcribeAudio(audio, source);
  const originalText = transcription.text;
  const translatedText = await translateText(originalText, source, target);
  const speech = await synthesizeSpeech(translatedText, target);

  return {
    originalText,
    translatedText,
    speechDurationMs: transcription.durationMs,
    source,
    target,
    ...speech,
  };
}
