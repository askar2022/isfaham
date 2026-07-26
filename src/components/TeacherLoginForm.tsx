"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { FormEvent, useState } from "react";
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
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "We could not send your code.");
      }

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", verification.user?.id ?? "")
        .maybeSingle();

      router.replace(profile?.is_admin ? "/admin" : "/teacher");
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
        <label>
          Six-digit code
          <input
            autoComplete="one-time-code"
            autoFocus
            inputMode="numeric"
            maxLength={6}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            pattern="[0-9]{6}"
            placeholder="000000"
            required
            value={code}
          />
        </label>
        <button className="button auth-submit" disabled={loading || code.length !== 6}>
          {loading ? <Loader2 className="spin" size={19} /> : "Sign in securely"}
          {!loading && <ArrowRight size={18} />}
        </button>
        <button
          className="auth-back"
          onClick={() => {
            setStep("email");
            setCode("");
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
        School email
        <input
          autoComplete="email"
          autoFocus
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@school.org"
          required
          type="email"
          value={email}
        />
      </label>
      <button className="button auth-submit" disabled={loading}>
        {loading ? <Loader2 className="spin" size={19} /> : "Email my code"}
        {!loading && <ArrowRight size={18} />}
      </button>
      {error && <p className="auth-error">{error}</p>}
    </form>
  );
}
