import type { Metadata } from "next";

import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Delete Your Account",
  description:
    "Learn how to permanently delete an Isfaham account and associated data.",
};

export default function DeleteAccountPage() {
  return (
    <PolicyPage
      description="You can permanently delete your Isfaham account from the app or request help from our support team."
      eyebrow="Account controls"
      title="Delete Your Account"
    >
      <section>
        <h2>Delete your account in the app</h2>
        <ol>
          <li>Open Isfaham and sign in to the account you want to delete.</li>
          <li>Open the Account tab.</li>
          <li>Select Delete Account.</li>
          <li>Review the warning and confirm deletion.</li>
        </ol>
        <p>
          Deletion is permanent. Any remaining free or purchased translation
          balance is lost and cannot be restored or refunded through account
          deletion.
        </p>
      </section>

      <section>
        <h2>Request deletion without the app</h2>
        <p>
          Email <a href="mailto:support@isfaham.org">support@isfaham.org</a>{" "}
          from the address connected to your account with “Delete My Account”
          in the subject line. We may ask you to verify account ownership. We
          aim to complete verified requests within 30 days, unless a shorter
          period is required by law.
        </p>
        <a
          className="button"
          href="mailto:support@isfaham.org?subject=Delete%20My%20Account"
        >
          Request Account Deletion
        </a>
      </section>

      <section>
        <h2>Data removed</h2>
        <p>Deleting your account removes data associated with it, including:</p>
        <ul>
          <li>Your Isfaham authentication account and profile.</li>
          <li>Your translation-credit wallet and transaction ledger.</li>
          <li>Consumer remote conversations hosted by your account.</li>
          <li>
            School conversations and messages directly owned by a deleted
            staff profile, subject to the school’s legal obligations.
          </li>
        </ul>
      </section>

      <section>
        <h2>Information that may remain</h2>
        <p>
          Payment providers may retain purchase records under their own legal
          obligations. Isfaham may retain limited security, fraud-prevention,
          support, or legal records when required by law. A school may also
          retain its staff approval list and records it independently controls.
        </p>
      </section>

      <section>
        <h2>Need help?</h2>
        <p>
          Contact <a href="mailto:support@isfaham.org">support@isfaham.org</a>{" "}
          with questions. Never send passwords or one-time verification codes.
        </p>
      </section>
    </PolicyPage>
  );
}
