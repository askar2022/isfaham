"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { FormEvent, useState } from "react";

type FormStatus = "idle" | "submitting" | "success" | "error";

export function PilotForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState("");

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/pilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Please try again.");
      }

      form.reset();
      setStatus("success");
    } catch (submissionError) {
      setStatus("error");
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Please try again.",
      );
    }
  }

  if (status === "success") {
    return (
      <div className="form-success" role="status">
        <CheckCircle2 size={32} />
        <div>
          <strong>Thank you for joining us.</strong>
          <span>We’ll contact you about the Isfaham school pilot.</span>
        </div>
      </div>
    );
  }

  return (
    <form className="pilot-form" onSubmit={submitForm}>
      <div className="form-row">
        <label>
          Your name
          <input
            autoComplete="name"
            maxLength={100}
            name="name"
            placeholder="Amina Hassan"
            required
          />
        </label>
        <label>
          School or district
          <input
            autoComplete="organization"
            maxLength={150}
            name="school"
            placeholder="Your school"
            required
          />
        </label>
      </div>
      <div className="form-row">
        <label>
          Work email
          <input
            autoComplete="email"
            maxLength={200}
            name="email"
            placeholder="you@school.org"
            required
            type="email"
          />
        </label>
        <label>
          Your role <span>(optional)</span>
          <input
            autoComplete="organization-title"
            maxLength={100}
            name="role"
            placeholder="Teacher, family liaison…"
          />
        </label>
      </div>
      <label className="website-field" aria-hidden="true">
        Website
        <input autoComplete="off" name="website" tabIndex={-1} />
      </label>
      <button className="button form-button" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending…" : "Request pilot access"}
        {status !== "submitting" && <ArrowRight size={18} />}
      </button>
      {status === "error" && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="form-note">
        We’ll only use your information to contact you about Isfaham.
      </p>
    </form>
  );
}
