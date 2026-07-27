import type { Metadata } from "next";

import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms governing access to and use of Isfaham.",
};

export default function TermsPage() {
  return (
    <PolicyPage
      description="These terms govern your access to Isfaham’s voice translation services."
      eyebrow="Legal"
      title="Terms and Conditions"
    >
      <p className="policy-updated">Effective date: July 27, 2026</p>

      <section>
        <h2>1. Agreement to these terms</h2>
        <p>
          By downloading, accessing, or using Isfaham, you agree to these Terms
          and Conditions and our <a href="/privacy">Privacy Policy</a>. If you
          use Isfaham for an organization, you represent that you are
          authorized to accept these terms on its behalf.
        </p>
      </section>

      <section>
        <h2>2. The service</h2>
        <p>
          Isfaham provides automated voice recognition, text translation, and
          translated audio for conversations, including personal, remote, and
          school-supported use. Features may change as we improve the service.
        </p>
      </section>

      <section>
        <h2>3. Accounts and access</h2>
        <p>
          Some features require an account verified through your email. You
          are responsible for providing accurate information, protecting
          access to your email and device, and notifying us of unauthorized
          use. School features are available only to approved staff and may be
          controlled by the participating school.
        </p>
      </section>

      <section>
        <h2>4. Free trials and translation credits</h2>
        <p>
          Eligible users may receive limited free translation time. Free and
          purchased credits have no cash value, cannot be transferred unless
          Isfaham expressly permits it, and may be subject to reasonable usage
          and expiration rules disclosed at the time they are offered.
        </p>
      </section>

      <section>
        <h2>5. Purchases and school plans</h2>
        <p>
          Personal translation credits are consumable purchases rather than
          recurring subscriptions. Purchases made in the iOS app are processed
          by Apple and may be supported by RevenueCat. Eligible website
          purchases and school plans may be processed by Stripe. Prices, taxes,
          refunds, and payment disputes are governed by the applicable
          storefront or payment provider and applicable law.
        </p>
        <p>
          If a school purchases a recurring plan, its renewal and cancellation
          terms will be shown in the school’s order or service agreement.
        </p>
      </section>

      <section>
        <h2>6. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use Isfaham unlawfully or to harm, threaten, or exploit others.</li>
          <li>Interfere with, overload, probe, or bypass service security.</li>
          <li>Access another person’s account or conversation without permission.</li>
          <li>Copy, reverse engineer, or resell the app except where law permits.</li>
          <li>Use automated methods to abuse free trials or translation credits.</li>
          <li>Upload content that infringes another person’s rights.</li>
        </ul>
      </section>

      <section>
        <h2>7. Translation accuracy and important decisions</h2>
        <p>
          Isfaham uses automated technology. Translations may contain mistakes,
          omissions, delays, or differences in meaning. Do not rely on Isfaham
          as the sole source for emergencies or for medical, legal, financial,
          safety-critical, or other high-stakes decisions. Use a qualified
          human interpreter and verify important information when appropriate.
          Isfaham does not provide emergency services.
        </p>
      </section>

      <section>
        <h2>8. School and organizational use</h2>
        <p>
          Schools and organizations are responsible for authorizing their
          users, supervising use, obtaining required notices or permissions,
          and complying with laws and policies that apply to their
          communications and records.
        </p>
      </section>

      <section>
        <h2>9. Intellectual property</h2>
        <p>
          Isfaham and its software, branding, designs, and original content are
          owned by Isfaham or its licensors and are protected by applicable
          intellectual-property laws. These terms grant you a limited,
          revocable, non-transferable right to use the service for its intended
          purpose.
        </p>
      </section>

      <section>
        <h2>10. Suspension and termination</h2>
        <p>
          You may stop using Isfaham at any time. We may restrict or terminate
          access when reasonably necessary to protect users, enforce these
          terms, comply with law, prevent fraud, or maintain the service.
        </p>
      </section>

      <section>
        <h2>11. Disclaimers and limitation of liability</h2>
        <p>
          To the extent permitted by law, Isfaham is provided “as is” and “as
          available,” without warranties of uninterrupted availability or
          error-free translation. Isfaham and its operators will not be liable
          for indirect, incidental, special, consequential, or punitive
          damages, or loss resulting from reliance on a translation. Nothing in
          these terms limits rights or liability that cannot legally be
          limited.
        </p>
      </section>

      <section>
        <h2>12. Changes to these terms</h2>
        <p>
          We may update these terms as the service changes. We will post the
          revised version and update the effective date. Continuing to use
          Isfaham after revised terms become effective means you accept them.
        </p>
      </section>

      <section>
        <h2>13. Contact us</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a href="mailto:support@isfaham.org">support@isfaham.org</a>.
        </p>
      </section>
    </PolicyPage>
  );
}
