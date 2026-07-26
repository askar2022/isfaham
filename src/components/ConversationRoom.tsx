"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mic,
  PhoneOff,
  School,
  ShieldCheck,
  Sparkles,
  Square,
  Users,
  Volume2,
} from "lucide-react";
import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";

type Role = "teacher" | "parent";
type RoomStatus = "waiting" | "active" | "ended";

type Message = {
  id: string;
  speaker: Role;
  source_language: "so" | "en";
  target_language: "so" | "en";
  original_text: string;
  translated_text: string;
  created_at: string;
};

type Room = {
  id: string;
  status: RoomStatus;
  expiresAt: string;
  schoolName: string;
  role: Role;
  messages: Message[];
};

function audioDataUrl(base64: string, mimeType = "audio/mpeg") {
  return `data:${mimeType};base64,${base64}`;
}

export function ConversationRoom({ token }: { token: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const playedMessages = useRef(new Set<string>());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadRoom = useCallback(async () => {
    try {
      const response = await fetch(`/api/conversations/${token}`, {
        cache: "no-store",
      });
      const body = (await response.json()) as Room & { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Conversation unavailable.");
      }

      setRoom(body);
      setError("");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Conversation unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const firstLoad = window.setTimeout(loadRoom, 0);
    const poll = window.setInterval(loadRoom, 2000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(poll);
    };
  }, [loadRoom]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [room?.messages.length]);

  useEffect(() => {
    if (!room || room.status !== "active") return;
    const remoteMessages = room.messages.filter(
      (message) =>
        message.speaker !== room.role && !playedMessages.current.has(message.id),
    );
    const latest = remoteMessages.at(-1);

    if (!latest) return;
    room.messages.forEach((message) => playedMessages.current.add(message.id));

    fetch(`/api/conversations/${token}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: latest.id }),
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          audioBase64: string;
          audioMimeType: string;
        };
      })
      .then((audio) => {
        if (!audio) return;
        return new Audio(
          audioDataUrl(audio.audioBase64, audio.audioMimeType),
        ).play();
      })
      .catch(() => {
        // Browsers can block autoplay; the Listen button remains available.
      });
  }, [room, token]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (timerRef.current) window.clearInterval(timerRef.current);
    },
    [],
  );

  async function updateStatus(status: "active" | "ended") {
    setProcessing(true);
    setError("");
    try {
      const response = await fetch(`/api/conversations/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Please try again.");
      await loadRoom();
    } catch (statusError) {
      setError(
        statusError instanceof Error ? statusError.message : "Please try again.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function startRecording(event: PointerEvent<HTMLButtonElement>) {
    if (recording || processing || room?.status !== "active") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
      recorder.ondataavailable = (dataEvent) => {
        if (dataEvent.data.size) chunksRef.current.push(dataEvent.data);
      };
      recorder.start();
      recordingStartedAtRef.current = Date.now();
      setDuration(0);
      setRecording(true);
      timerRef.current = window.setInterval(
        () => setDuration((current) => current + 1),
        1000,
      );
    } catch {
      setError(
        "Microphone access is needed. Allow it in your browser and try again.",
      );
    }
  }

  async function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;

    setRecording(false);
    setProcessing(true);
    if (timerRef.current) window.clearInterval(timerRef.current);

    try {
      const audioBlob = await new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(
            new Blob(chunksRef.current, {
              type: recorder.mimeType || "audio/webm",
            }),
          );
        };
        recorder.stop();
      });
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (audioBlob.size < 500) {
        throw new Error("Hold the microphone and speak for a moment.");
      }

      const extension = audioBlob.type.includes("mp4") ? "m4a" : "webm";
      const form = new FormData();
      form.append("audio", audioBlob, `conversation.${extension}`);
      form.append(
        "durationMs",
        String(
          Math.min(
            60_000,
            Math.max(500, Date.now() - recordingStartedAtRef.current),
          ),
        ),
      );
      const response = await fetch(`/api/conversations/${token}/translate`, {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as {
        audioBase64?: string;
        audioMimeType?: string;
        error?: string;
      };

      if (!response.ok || !body.audioBase64) {
        throw new Error(body.error || "Translation failed. Please try again.");
      }

      await new Audio(
        audioDataUrl(body.audioBase64, body.audioMimeType),
      ).play();
      await loadRoom();
    } catch (recordingError) {
      setError(
        recordingError instanceof Error
          ? recordingError.message
          : "Translation failed. Please try again.",
      );
    } finally {
      setProcessing(false);
      recorderRef.current = null;
      streamRef.current = null;
    }
  }

  async function playMessage(message: Message) {
    try {
      const response = await fetch(`/api/conversations/${token}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: message.id }),
      });
      const body = (await response.json()) as {
        audioBase64?: string;
        audioMimeType?: string;
      };
      if (response.ok && body.audioBase64) {
        await new Audio(
          audioDataUrl(body.audioBase64, body.audioMimeType),
        ).play();
      }
    } catch {
      setError("Audio playback is unavailable. Please try again.");
    }
  }

  if (loading) {
    return (
      <main className="room-state-page">
        <Loader2 className="spin" size={34} />
        <p>Opening your private conversation…</p>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="room-state-page room-error-page">
        <LockKeyhole size={38} />
        <h1>Conversation unavailable</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (room.status === "waiting") {
    const isTeacher = room.role === "teacher";
    return (
      <main className="room-state-page waiting-page">
        <div className="waiting-logo">
          <Users size={31} />
        </div>
        <span className="room-school">
          <School size={15} />
          {room.schoolName}
        </span>
        <h1>
          {isTeacher ? "Your family has a private link." : "Sug macallinkaaga."}
        </h1>
        <p>
          {isTeacher
            ? "Start when you and the parent are both ready."
            : "Please wait for the teacher to begin. Fadlan sug inta macallinku bilaabayo."}
        </p>
        {isTeacher ? (
          <button
            className="button room-primary-action"
            disabled={processing}
            onClick={() => updateStatus("active")}
          >
            {processing ? <Loader2 className="spin" size={19} /> : <CheckCircle2 size={19} />}
            Start conversation
          </button>
        ) : (
          <div className="waiting-indicator">
            <Loader2 className="spin" size={18} />
            Waiting securely
          </div>
        )}
        <div className="room-security-note">
          <ShieldCheck size={17} />
          This private link expires automatically.
        </div>
        {error && <p className="room-error">{error}</p>}
      </main>
    );
  }

  if (room.status === "ended") {
    return (
      <main className="room-state-page">
        <div className="waiting-logo ended-logo">
          <CheckCircle2 size={31} />
        </div>
        <h1>Conversation ended</h1>
        <p>
          {room.role === "parent"
            ? "Wadahadalku wuu dhammaaday. Mahadsanid."
            : "This private link is now closed."}
        </p>
        {room.role === "teacher" && (
          <a className="button" href="/teacher">
            <ArrowLeft size={18} />
            Back to workspace
          </a>
        )}
      </main>
    );
  }

  const isTeacher = room.role === "teacher";
  const yourLanguage = isTeacher ? "English" : "Af-Soomaali";

  return (
    <main className="conversation-room">
      <header className="room-header">
        <div>
          <span className="room-live-dot" />
          <span>
            <strong>Live conversation</strong>
            <small>{room.schoolName}</small>
          </span>
        </div>
        {isTeacher ? (
          <button
            className="end-call-button"
            disabled={processing}
            onClick={() => updateStatus("ended")}
          >
            <PhoneOff size={16} />
            End
          </button>
        ) : (
          <span className="room-secure">
            <LockKeyhole size={14} />
            Private
          </span>
        )}
      </header>

      <section className="room-messages" aria-live="polite">
        {!room.messages.length && (
          <div className="room-empty">
            <Sparkles size={28} />
            <strong>{isTeacher ? "Begin when you’re ready" : "Bilow markaad diyaar tahay"}</strong>
            <span>
              {isTeacher
                ? "Hold the microphone and speak English."
                : "Qabo makarafoonka oo ku hadal Af-Soomaali."}
            </span>
          </div>
        )}
        {room.messages.map((message) => {
          const mine = message.speaker === room.role;
          return (
            <article
              className={`room-message ${mine ? "room-message-mine" : "room-message-theirs"}`}
              key={message.id}
            >
              <span>{message.speaker === "teacher" ? "Teacher" : "Parent"}</span>
              <p>{message.original_text}</p>
              <div className="room-translation">
                <Sparkles size={13} />
                <p>{message.translated_text}</p>
              </div>
              <button onClick={() => playMessage(message)}>
                <Volume2 size={16} />
                Listen
              </button>
            </article>
          );
        })}
        <div ref={messagesEndRef} />
      </section>

      <section className="room-controls">
        {error && <p className="room-error">{error}</p>}
        <span className="your-language">
          <strong>{yourLanguage}</strong>
          {isTeacher ? "You speak English" : "Waxaad ku hadlaysaa Af-Soomaali"}
        </span>
        <button
          className={`web-mic ${recording ? "web-mic-recording" : ""}`}
          disabled={processing}
          onPointerCancel={stopRecording}
          onPointerDown={startRecording}
          onPointerUp={stopRecording}
        >
          {processing ? (
            <Loader2 className="spin" size={32} />
          ) : recording ? (
            <Square fill="currentColor" size={29} />
          ) : (
            <Mic size={36} />
          )}
        </button>
        <strong className="web-mic-label">
          {processing
            ? "Translating…"
            : recording
              ? `Listening • 0:${String(duration).padStart(2, "0")}`
              : isTeacher
                ? "Hold to speak"
                : "Qabo si aad u hadasho"}
        </strong>
        <small>
          {isTeacher
            ? "Release to translate into Somali"
            : "Sii daa si loogu turjumo Ingiriisi"}
        </small>
      </section>
    </main>
  );
}
