import type { Metadata } from "next";

import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Isfaham for support, privacy, or school inquiries.",
};

export default function ContactPage() {
  return (
    <PolicyPage
      description="Reach the Isfaham team for product support, privacy requests, and school inquiries."
      eyebrow="Contact"
      title="We’re here to help"
    >
      <section className="contact-card">
        <h2>Support and general questions</h2>
        <p>
          Email us at{" "}
          <a href="mailto:support@isfaham.org">support@isfaham.org</a>. We
          recommend including your device type, a short description of the
          issue, and any error message you saw.
        </p>
        <a className="button" href="mailto:support@isfaham.org">
          Email support@isfaham.org
        </a>
      </section>

      <section>
        <h2>Privacy and account requests</h2>
        <p>
          To request access, correction, or deletion of account information,
          email us from the address associated with your Isfaham account. Use
          “Privacy Request” in the subject line.
        </p>
      </section>

      <section>
        <h2>School inquiries</h2>
        <p>
          Schools interested in Isfaham can contact the same address with
          “School Inquiry” in the subject line. Tell us about your school,
          expected users, and translation needs.
        </p>
      </section>

      <section>
        <h2>Before sending sensitive information</h2>
        <p>
          Please do not include passwords, verification codes, payment card
          numbers, voice recordings, or confidential conversation content in
          your email.
        </p>
      </section>
    </PolicyPage>
  );
}
