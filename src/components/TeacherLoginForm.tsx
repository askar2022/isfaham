"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import appLogo from "@/app/app_logo.png";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Step = "email" | "code";

function LoginLogo() {
  return (
    <Link
      aria-label="Isfaham home"
      className="auth-full-brand"
      href="/"
    >
      <Image alt="Isfaham" priority src={appLogo} />
    </Link>
  );
}

export function TeacherLoginForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState(() => Array(6).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [destination, setDestination] = useState("/teacher");
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const code = codeDigits.join("");

  function updateCodeDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCodeDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });

    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  }

  function handleCodeKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace" && !codeDigits[index] && index > 0) {
      setCodeDigits((current) => {
        const next = [...current];
        next[index - 1] = "";
        return next;
      });
      codeInputRefs.current[index - 1]?.focus();
    }
  }

  function handleCodePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedDigits = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pastedDigits) return;
    event.preventDefault();
    setCodeDigits(
      Array.from({ length: 6 }, (_, index) => pastedDigits[index] ?? ""),
    );
    codeInputRefs.current[Math.min(pastedDigits.length, 6) - 1]?.focus();
  }

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json()) as {
        destination?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "We could not send your code.");
      }

      setDestination(body.destination ?? "/teacher");
      setStep("code");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createBrowserSupabaseClient();
      const { data: verification, error: verifyError } =
        await supabase.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: code.trim(),
          type: "email",
        });

      if (verifyError) {
        throw new Error("That code is incorrect or has expired.");
      }

      router.replace(destination);
      router.refresh();
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <form className="teacher-login-form" onSubmit={verifyCode}>
        <LoginLogo />
        <h1>Check your email</h1>
        <p>
          Enter the six-digit code sent to <strong>{email}</strong>.
        </p>
        <div aria-label="Six-digit verification code" className="otp-fields" role="group">
          {codeDigits.map((digit, index) => (
            <input
              aria-label={`Digit ${index + 1}`}
              autoComplete={index === 0 ? "one-time-code" : "off"}
              autoFocus={index === 0}
              className="otp-input"
              inputMode="numeric"
              key={index}
              maxLength={1}
              onChange={(event) => updateCodeDigit(index, event.target.value)}
              onKeyDown={(event) => handleCodeKeyDown(index, event)}
              onPaste={handleCodePaste}
              placeholder="0"
              ref={(element) => {
                codeInputRefs.current[index] = element;
              }}
              required
              value={digit}
            />
          ))}
        </div>
        <button className="button auth-submit" disabled={loading || code.length !== 6}>
          {loading ? <Loader2 className="spin" size={19} /> : "Sign in securely"}
          {!loading && <ArrowRight size={18} />}
        </button>
        <button
          className="auth-back"
          onClick={() => {
            setStep("email");
            setCodeDigits(Array(6).fill(""));
            setError("");
          }}
          type="button"
        >
          Use a different email
        </button>
        {error && <p className="auth-error">{error}</p>}
      </form>
    );
  }

  return (
    <form className="teacher-login-form" onSubmit={requestCode}>
      <LoginLogo />
      <label>
        School or platform email
        <input
          autoComplete="email"
          autoFocus
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@organization.org"
          required
          type="email"
          value={email}
        />
      </label>
      <button className="button auth-submit" disabled={loading}>
        {loading ? <Loader2 className="spin" size={19} /> : "Send Code"}
        {!loading && <ArrowRight size={18} />}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}
