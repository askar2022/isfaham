"use client";

import { useEffect, useState } from "react";

type ListenPayload = {
  schoolName?: string;
  somaliText?: string;
  error?: string;
};

export function ParentListenPlayer({ token }: { token: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schoolName, setSchoolName] = useState("Your child’s school");
  const [somaliText, setSomaliText] = useState("");
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch(`/api/m/${token}`)
      .then(async (response) => {
        const body = (await response.json()) as ListenPayload;
        if (!response.ok) {
          throw new Error(body.error || "Unable to open this message.");
        }
        if (!active) return;
        setSchoolName(body.schoolName || "Your child’s school");
        setSomaliText(body.somaliText || "");
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to open this message.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function playAudio() {
    try {
      setPlaying(true);
      setError("");
      const response = await fetch(`/api/m/${token}/play`, { method: "POST" });
      const body = (await response.json()) as {
        error?: string;
        audioBase64?: string;
        audioMimeType?: string;
      };
      if (!response.ok || !body.audioBase64) {
        throw new Error(body.error || "Unable to play this message.");
      }
      const audio = new Audio(
        `data:${body.audioMimeType || "audio/mpeg"};base64,${body.audioBase64}`,
      );
      await audio.play();
      audio.onended = () => setPlaying(false);
    } catch (playError) {
      setPlaying(false);
      setError(
        playError instanceof Error
          ? playError.message
          : "Unable to play this message.",
      );
    }
  }

  if (loading) {
    return (
      <main className="room-state-page">
        <p>Opening your message…</p>
      </main>
    );
  }

  if (error && !somaliText) {
    return (
      <main className="room-state-page">
        <h1>Message unavailable</h1>
        <p>{error}</p>
      </main>
    );
  }

  return (
    <main className="parent-listen-page">
      <div className="parent-listen-card">
        <p className="parent-listen-kicker">Message from</p>
        <h1>{schoolName}</h1>
        <button
          className="button parent-listen-button"
          disabled={playing}
          onClick={() => void playAudio()}
          type="button"
        >
          {playing ? "Playing…" : "Listen in Somali"}
        </button>
        <button
          className="button button-light parent-listen-replay"
          disabled={playing}
          onClick={() => void playAudio()}
          type="button"
        >
          Replay
        </button>
        {somaliText ? (
          <div className="parent-listen-text">
            <h2>Somali text</h2>
            <p>{somaliText}</p>
          </div>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        <p className="parent-listen-contact">
          If you have questions, please contact the school directly.
        </p>
        <p className="parent-listen-notice">
          This message was translated using artificial intelligence, not a
          human interpreter. The translation may contain errors. If anything is
          unclear, please contact the school.
        </p>
      </div>
    </main>
  );
}
