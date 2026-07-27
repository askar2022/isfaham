import type { Metadata } from "next";

import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Support",
  description:
    "Get help with Isfaham translation, accounts, purchases, and school access.",
};

const questions = [
  {
    title: "How do I translate a conversation?",
    answer:
      "Choose the language you are speaking, tap the microphone, speak naturally, and tap again when you are finished. Isfaham displays and plays the translation.",
  },
  {
    title: "Do I need an account?",
    answer:
      "No account is required for the limited guest trial. A free Personal account is required to preserve your balance, purchase more translation time, or host a remote conversation.",
  },
  {
    title: "How do I invite another phone?",
    answer:
      "Sign in to a Personal account, open Personal, and choose Invite another phone. Your guest can join through the private link or QR code without creating an account. Translation time is charged to the host.",
  },
  {
    title: "How do school staff sign in?",
    answer:
      "Open Schools and enter an email address approved by your school. Isfaham sends a one-time verification code. Contact your school administrator if your verified address is not approved.",
  },
  {
    title: "How do translation credits work?",
    answer:
      "Translation time is deducted as you use speech translation. iOS purchases are completed through Apple. Personal translation credits are consumable and can be purchased again when needed.",
  },
  {
    title: "Why is my microphone not working?",
    answer:
      "Open your device settings and confirm that Isfaham has microphone permission. Also check your internet connection, then close and reopen the app.",
  },
  {
    title: "Does Isfaham save my audio?",
    answer:
      "One-phone voice recordings are processed for translation and are not permanently stored by default. See the Privacy Policy for details about remote conversation messages and service data.",
  },
  {
    title: "How do I request account deletion?",
    answer:
      "Email support@isfaham.org from the address connected to your account. We may ask you to verify ownership before deleting account data.",
  },
];

export default function SupportPage() {
  return (
    <PolicyPage
      description="Find quick answers or contact our team for help with Isfaham."
      eyebrow="Help center"
      title="How can we help?"
    >
      <section className="support-callout">
        <h2>Contact support</h2>
        <p>
          Email <a href="mailto:support@isfaham.org">support@isfaham.org</a> and
          include the device you use, what you were trying to do, and any error
          message you received. Please do not email voice recordings or
          sensitive conversation details.
        </p>
        <a className="button" href="mailto:support@isfaham.org">
          Email Isfaham Support
        </a>
      </section>

      <section>
        <h2>Frequently asked questions</h2>
        <div className="support-grid">
          {questions.map((question) => (
            <article className="support-card" key={question.title}>
              <h3>{question.title}</h3>
              <p>{question.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2>Policies</h2>
        <p>
          Review our <a href="/privacy">Privacy Policy</a> and{" "}
          <a href="/terms">Terms and Conditions</a>.
        </p>
      </section>
    </PolicyPage>
  );
}
