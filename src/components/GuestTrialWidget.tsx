"use client";

import {
  Languages,
  Loader2,
  LockKeyhole,
  Mic,
  RefreshCw,
  RotateCcw,
  Square,
  Volume2,
  Waves,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type LanguageCode = "so" | "en";

type TranslationResult = {
  originalText: string;
  translatedText: string;
  audioBase64: string;
  audioMimeType?: string;
};

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  so: "Somali",
  en: "English",
};

function formatBalance(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function audioDataUrl(base64: string, mimeType = "audio/mpeg") {
  return `data:${mimeType};base64,${base64}`;
}

function microphonePermissionInstructions() {
  const userAgent = navigator.userAgent;

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return "Tap aA in the address bar, choose Website Settings, set Microphone to Allow, then reload this page.";
  }
  if (/Firefox/i.test(userAgent)) {
    return "Tap the lock icon beside isfaham.org, open Permissions, and allow Microphone. Then reload this page.";
  }
  if (/Edg/i.test(userAgent)) {
    return "Tap the lock icon beside isfaham.org, open Permissions or Site settings, and set Microphone to Allow. Then reload this page.";
  }
  if (/Chrome/i.test(userAgent)) {
    return "Tap the icon beside isfaham.org, open Permissions, and set Microphone to Allow. Then reload this page.";
  }
  return "Open this website’s settings from the address bar, set Microphone to Allow, then reload this page.";
}

export function GuestTrialWidget() {
  const [source, setSource] = useState<LanguageCode>("so");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [balance, setBalance] = useState(120);
  const [error, setError] = useState("");
  const [microphoneBlocked, setMicrophoneBlocked] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const accessTokenRef = useRef("");
  const timerRef = useRef<number | null>(null);
  const autoStopRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);

  const target: LanguageCode = source === "so" ? "en" : "so";

  function clearRecordingTimers() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (autoStopRef.current) window.clearTimeout(autoStopRef.current);
    timerRef.current = null;
    autoStopRef.current = null;
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(
    () => () => {
      clearRecordingTimers();
      stopStream();
    },
    [],
  );

  async function ensureAccessToken() {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { session: existingSession },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    if (existingSession) return existingSession.access_token;

    const {
      data: { session },
      error: signInError,
    } = await supabase.auth.signInAnonymously();
    if (signInError || !session) {
      throw signInError ?? new Error("The free trial could not be started.");
    }
    return session.access_token;
  }

  async function refreshBalance(accessToken: string) {
    const response = await fetch("/api/credits", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const body = (await response.json()) as {
      balanceSeconds?: number;
      error?: string;
    };
    if (response.ok && typeof body.balanceSeconds === "number") {
      setBalance(body.balanceSeconds);
    }
  }

  async function processRecording(audioBlob: Blob) {
    setProcessing(true);
    setError("");

    try {
      if (audioBlob.size < 500) {
        throw new Error("Speak for a moment before stopping the recording.");
      }

      const extension = audioBlob.type.includes("mp4") ? "m4a" : "webm";
      const form = new FormData();
      form.append("audio", audioBlob, `isfaham-trial.${extension}`);
      form.append("source", source);
      form.append("target", target);

      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessTokenRef.current}`,
        },
        body: form,
      });
      const body = (await response.json()) as Partial<TranslationResult> & {
        error?: string;
      };

      if (
        !response.ok ||
        !body.originalText ||
        !body.translatedText ||
        !body.audioBase64
      ) {
        if (response.status === 402) setBalance(0);
        throw new Error(
          response.status === 402
            ? "Your free trial has ended. The mobile apps are coming soon."
            : body.error || "Translation failed. Please try again.",
        );
      }

      const translation: TranslationResult = {
        originalText: body.originalText,
        translatedText: body.translatedText,
        audioBase64: body.audioBase64,
        audioMimeType: body.audioMimeType,
      };
      setResult(translation);
      await refreshBalance(accessTokenRef.current);

      try {
        await new Audio(
          audioDataUrl(translation.audioBase64, translation.audioMimeType),
        ).play();
      } catch {
        // Browsers can block autoplay; the Listen button remains available.
      }
    } catch (recordingError) {
      setError(
        recordingError instanceof Error
          ? recordingError.message
          : "Translation failed. Please try again.",
      );
    } finally {
      setProcessing(false);
      recorderRef.current = null;
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    clearRecordingTimers();
    setRecording(false);
    recorder.stop();
  }

  async function startRecording() {
    if (recording || processing || balance <= 0) return;
    setError("");
    setMicrophoneBlocked(false);
    setResult(null);

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      accessTokenRef.current = await ensureAccessToken();
      void refreshBalance(accessTokenRef.current);

      const preferredType = MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus",
      )
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = new MediaRecorder(
        stream,
        preferredType ? { mimeType: preferredType } : undefined,
      );

      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        stopStream();
        void processRecording(audioBlob);
      };
      recorder.start();
      recordingStartedAtRef.current = Date.now();
      setDuration(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setDuration(
          Math.min(
            60,
            Math.floor((Date.now() - recordingStartedAtRef.current) / 1000),
          ),
        );
      }, 250);
      autoStopRef.current = window.setTimeout(stopRecording, 60_000);
    } catch (recordingError) {
      stopStream();
      if (
        recordingError instanceof Error &&
        (recordingError.name === "NotAllowedError" ||
          recordingError.name === "SecurityError")
      ) {
        setMicrophoneBlocked(true);
        return;
      }
      setError("The microphone could not start. Reload the page and try again.");
    }
  }

  async function playTranslation() {
    if (!result) return;
    try {
      await new Audio(
        audioDataUrl(result.audioBase64, result.audioMimeType),
      ).play();
    } catch {
      setError("Audio playback is unavailable. Please try again.");
    }
  }

  function switchSpeaker() {
    if (recording || processing) return;
    setSource(target);
    setResult(null);
    setError("");
  }

  return (
    <div className="guest-trial-card">
      <div className="guest-trial-topline">
        <span>
          <Waves size={17} />
          Live browser trial
        </span>
        <strong>{formatBalance(balance)} free</strong>
      </div>

      <div className="guest-language-choice" aria-label="Choose who is speaking">
        {(["so", "en"] as const).map((language) => (
          <button
            type="button"
            className={source === language ? "active" : ""}
            disabled={recording || processing}
            onClick={() => {
              setSource(language);
              setResult(null);
              setError("");
            }}
            key={language}
          >
            <span>{language.toUpperCase()}</span>
            <strong>{LANGUAGE_NAMES[language]}</strong>
            <small>{source === language ? "Speaking now" : "Select speaker"}</small>
          </button>
        ))}
      </div>

      <div className="guest-translation-direction">
        <Languages size={17} />
        {LANGUAGE_NAMES[source]} to {LANGUAGE_NAMES[target]}
      </div>

      {result ? (
        <div className="guest-trial-result" aria-live="polite">
          <div>
            <small>You said in {LANGUAGE_NAMES[source]}</small>
            <p>{result.originalText}</p>
          </div>
          <div className="guest-translated-text">
            <small>{LANGUAGE_NAMES[target]} translation</small>
            <p>{result.translatedText}</p>
            <button type="button" onClick={playTranslation}>
              <Volume2 size={16} />
              Listen
            </button>
          </div>
        </div>
      ) : (
        <div className="guest-trial-empty">
          <Mic size={24} />
          <p>
            Choose the language you will speak, then tap the microphone. Tap
            again when you finish.
          </p>
        </div>
      )}

      <div className="guest-mic-area">
        <button
          type="button"
          className={`guest-mic${recording ? " guest-mic-recording" : ""}`}
          disabled={processing || balance <= 0}
          onClick={recording ? stopRecording : startRecording}
          aria-label={recording ? "Stop recording" : "Start recording"}
        >
          {processing ? (
            <Loader2 className="spin" size={30} />
          ) : recording ? (
            <Square size={27} fill="currentColor" />
          ) : (
            <Mic size={32} />
          )}
        </button>
        <strong>
          {processing
            ? "Translating…"
            : recording
              ? `Listening… ${duration}s`
              : balance <= 0
                ? "Free trial ended"
                : "Tap to speak"}
        </strong>
      </div>

      {result && !recording && !processing ? (
        <button
          type="button"
          className="guest-switch-speaker"
          onClick={switchSpeaker}
        >
          <RotateCcw size={16} />
          Now let the {LANGUAGE_NAMES[target]} speaker respond
        </button>
      ) : null}

      {microphoneBlocked ? (
        <div className="guest-permission-help" role="alert">
          <span>
            <LockKeyhole size={23} />
          </span>
          <div>
            <h3>Microphone is blocked</h3>
            <p>{microphonePermissionInstructions()}</p>
            <div className="guest-permission-actions">
              <button type="button" onClick={startRecording}>
                <Mic size={15} />
                Try again
              </button>
              <button type="button" onClick={() => window.location.reload()}>
                <RefreshCw size={15} />
                Reload page
              </button>
            </div>
          </div>
        </div>
      ) : error ? (
        <p className="guest-trial-error" role="alert">
          {error}
        </p>
      ) : null}
      <p className="guest-trial-privacy">
        No account or payment information required. Audio is processed only to
        provide the translation.
      </p>
    </div>
  );
}
