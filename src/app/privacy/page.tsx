import type { Metadata } from "next";

import { PolicyPage } from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how Isfaham collects, uses, protects, and shares information.",
};

export default function PrivacyPage() {
  return (
    <PolicyPage
      description="This policy explains what information Isfaham handles and the choices available to you."
      eyebrow="Legal"
      title="Privacy Policy"
    >
      <p className="policy-updated">Effective date: July 27, 2026</p>

      <section>
        <h2>1. Information we collect</h2>
        <p>Depending on how you use Isfaham, we may process:</p>
        <ul>
          <li>Your email address and account identifiers.</li>
          <li>
            Speech audio, transcripts, and translations needed to provide the
            translation service.
          </li>
          <li>Your selected languages and app preferences.</li>
          <li>
            Device, diagnostic, and usage information, such as feature use,
            conversation duration, and error data.
          </li>
          <li>
            Purchase and entitlement information supplied by Apple,
            RevenueCat, or Stripe.
          </li>
          <li>
            School and staff account information when you use school features.
          </li>
        </ul>
        <p>
          We do not receive or store your full payment card or App Store
          payment credentials.
        </p>
      </section>

      <section>
        <h2>2. Voice translation and conversation data</h2>
        <p>
          Audio is transmitted securely to our translation providers for
          processing. Isfaham does not permanently store one-phone voice
          recordings by default. Remote conversations may retain translated
          messages and limited conversation metadata so participants can
          synchronize the conversation and schools can administer the service.
        </p>
        <p>
          Please do not share sensitive information that is not necessary for
          your conversation.
        </p>
      </section>

      <section>
        <h2>3. How we use information</h2>
        <ul>
          <li>Provide speech recognition, translation, and translated audio.</li>
          <li>Create and maintain accounts and translation balances.</li>
          <li>Enable secure remote and school conversations.</li>
          <li>Process purchases and prevent duplicate credit grants.</li>
          <li>Maintain security, prevent misuse, and troubleshoot errors.</li>
          <li>Measure and improve service performance.</li>
          <li>Respond to support and privacy requests.</li>
        </ul>
      </section>

      <section>
        <h2>4. Service providers</h2>
        <p>
          We use providers that process information on our behalf, including
          Microsoft Azure for speech and translation, Supabase for
          authentication and data storage, Vercel for hosting, Apple and
          RevenueCat for iOS purchases, Stripe for eligible web purchases,
          Twilio for certain school invitations, and Resend for email delivery.
          Their handling of information is also governed by their own terms and
          privacy policies.
        </p>
        <p>
          We may also disclose information when required by law, to protect the
          safety and integrity of Isfaham, or as part of a business transaction
          subject to appropriate safeguards. We do not sell personal
          information.
        </p>
      </section>

      <section>
        <h2>5. Data retention</h2>
        <p>
          We retain account, purchase, security, and conversation information
          only for as long as reasonably necessary to provide the service,
          satisfy legal obligations, resolve disputes, and prevent fraud.
          Retention may differ for school-managed data based on the school’s
          agreement and instructions.
        </p>
      </section>

      <section>
        <h2>6. Schools and children</h2>
        <p>
          Isfaham supports communication involving schools and families, but
          children are not asked to create consumer accounts. Schools,
          educators, parents, and guardians are responsible for supervising
          use by minors and for providing any notices or permissions required
          by applicable law. Contact us if you believe a child’s information
          was provided improperly.
        </p>
      </section>

      <section>
        <h2>7. Your choices and rights</h2>
        <p>
          Depending on your location, you may request access, correction,
          deletion, or a copy of your personal information. You may also ask us
          to close your account. Send requests from your account email to{" "}
          <a href="mailto:support@isfaham.org">support@isfaham.org</a>. We may
          need to verify your identity before completing a request.
        </p>
      </section>

      <section>
        <h2>8. Security and international processing</h2>
        <p>
          We use administrative, technical, and organizational safeguards
          designed to protect information. No system is completely secure.
          Isfaham and its providers may process information in the United
          States and other countries where they operate.
        </p>
      </section>

      <section>
        <h2>9. Policy changes</h2>
        <p>
          We may update this policy as Isfaham changes. We will post the
          revised policy here and update its effective date. Material changes
          may also be communicated in the app or by email when appropriate.
        </p>
      </section>

      <section>
        <h2>10. Contact us</h2>
        <p>
          Questions or privacy requests can be sent to{" "}
          <a href="mailto:support@isfaham.org">support@isfaham.org</a>.
        </p>
      </section>
    </PolicyPage>
  );
}
