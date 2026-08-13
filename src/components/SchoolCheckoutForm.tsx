"use client";

import { ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";

type FormStatus = "idle" | "submitting" | "error";

export function SchoolCheckoutForm() {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState("");

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/schools/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await response.json()) as {
        error?: string;
        checkoutUrl?: string;
      };

      if (!response.ok || !body.checkoutUrl) {
        throw new Error(body.error || "Please try again.");
      }

      window.location.href = body.checkoutUrl;
    } catch (submissionError) {
      setStatus("error");
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Please try again.",
      );
    }
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
            placeholder="Principal, family liaison…"
          />
        </label>
      </div>
      <label className="website-field" aria-hidden="true">
        Website
        <input autoComplete="off" name="website" tabIndex={-1} />
      </label>
      <button className="button form-button" disabled={status === "submitting"}>
        {status === "submitting"
          ? "Opening secure checkout…"
          : "Subscribe — $499/month"}
        {status !== "submitting" && <ArrowRight size={18} />}
      </button>
      {status === "error" && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="form-note">
        Secure Stripe checkout. Your school administrator account is created
        after payment.
      </p>
    </form>
  );
}
