import {
  Apple,
  ArrowRight,
  Check,
  Languages,
  LockKeyhole,
  Mic,
  Phone,
  Play,
  School,
  ShieldCheck,
  Volume2,
} from "lucide-react";

import { PilotForm } from "@/components/PilotForm";
import { SchoolCheckoutForm } from "@/components/SchoolCheckoutForm";

const steps = [
  {
    number: "01",
    icon: Mic,
    title: "Record in English",
    text: "School staff enter a parent phone number, then record a short English message.",
  },
  {
    number: "02",
    icon: Languages,
    title: "Preview in Somali",
    text: "Isfaham shows the English transcript, then creates Somali text and audio for review.",
  },
  {
    number: "03",
    icon: Volume2,
    title: "Send a secure link",
    text: "Parents receive an SMS with a private link to listen in Somali—no app required.",
  },
];

const benefits = [
  "English → Somali school voice messages",
  "Staff review before sending",
  "Parents listen from a secure SMS link",
  "Staff phone numbers stay private",
];

const audiences = [
  {
    icon: School,
    label: "For schools",
    title: "Reach families in Somali",
    text: "Counselors, nurses, transportation, and office staff can send clear Somali voice messages when English → Somali is what works reliably.",
    points: [
      "$499/month school plan",
      "One-way English → Somali messages",
      "Private staff phone numbers",
    ],
    href: "#pilot",
    action: "Start school plan",
  },
];

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

function AppPreview() {
  return (
    <div className="preview-wrap">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div
        className="phone phone-messenger"
        aria-label="Preview of the Isfaham school messaging app"
      >
        <div className="phone-top">
          <span>9:41</span>
          <div className="phone-status">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="messenger-brand">
          <BrandMark />
          <div>
            <strong>Isfaham</strong>
            <small>School-to-Family Voice Messages</small>
          </div>
        </div>
        <h3 className="messenger-heading">Send a Somali Voice Message</h3>
        <p className="messenger-support">
          Record in English. Parents receive Somali audio.
        </p>
        <div className="messenger-phone-field">
          <Phone size={14} />
          <span>Parent phone number</span>
        </div>
        <button
          type="button"
          className="messenger-mic"
          aria-label="Tap to record in English"
        >
          <Mic size={42} />
        </button>
        <p className="messenger-mic-label">Tap to Record in English</p>
        <div className="messenger-steps">
          <div className="messenger-step active">
            <span>1</span>
            Record
          </div>
          <div className="messenger-step">
            <span>2</span>
            Preview
          </div>
          <div className="messenger-step">
            <span>3</span>
            Send
          </div>
        </div>
        <p className="messenger-privacy">
          <ShieldCheck size={13} />
          Your personal phone number stays private.
        </p>
        <div className="messenger-nav">
          <span className="active">
            <Mic size={16} />
            New Message
          </span>
          <span>
            <Languages size={14} />
            History
          </span>
          <span>
            <School size={14} />
            Account
          </span>
        </div>
      </div>
      <div className="floating-note note-top">
        <Mic size={19} />
        <span>Large English record button</span>
      </div>
      <div className="floating-note note-bottom">
        <LockKeyhole size={19} />
        <span>Private staff numbers</span>
      </div>
    </div>
  );
}

export default function Home() {
  const iosAppUrl = process.env.NEXT_PUBLIC_IOS_APP_URL;
  const androidAppUrl = process.env.NEXT_PUBLIC_ANDROID_APP_URL;

  return (
    <main>
      <header className="site-header">
        <a className="logo" href="#" aria-label="Isfaham home">
          <BrandMark />
          <span>Isfaham</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#for-schools">For schools</a>
          <a href="#pilot">Pricing</a>
          <a href="#download">Get the app</a>
        </nav>
        <a className="button button-small" href="#pilot">
          Start school plan
          <ArrowRight size={16} />
        </a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-icon">
              <School size={15} />
            </span>
            School-to-family Somali voice messages
          </div>
          <h1>
            Record in English. <em>Parents hear Somali.</em>
          </h1>
          <p className="hero-lead">
            Isfaham helps schools send clear Somali voice messages to families.
            Staff record in English, review the message, and parents open a
            secure SMS link—no two-way live translation required.
          </p>
          <div className="hero-actions">
            <a className="button" href="#pilot">
              Start school plan
              <ArrowRight size={18} />
            </a>
            <a className="text-link" href="#how-it-works">
              See how it works
              <span>↓</span>
            </a>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span>S</span>
              <span>N</span>
              <span>T</span>
            </div>
            <p>
              <strong>Built for school staff</strong>
              <span>Counselors, nurses, transportation, and office teams</span>
            </p>
          </div>
        </div>
        <AppPreview />
      </section>

      <section className="trust-strip" aria-label="Core product values">
        <div>
          <Mic size={23} />
          <span>
            <strong>English → Somali</strong>
            Reliable one-way voice messages
          </span>
        </div>
        <div>
          <Languages size={23} />
          <span>
            <strong>Secure SMS link</strong>
            Parents listen without an app
          </span>
        </div>
        <div>
          <LockKeyhole size={23} />
          <span>
            <strong>Private staff numbers</strong>
            School messages, not personal phones
          </span>
        </div>
      </section>

      <section className="section how" id="how-it-works">
        <div className="section-heading">
          <span className="section-kicker">How it works</span>
          <h2>Record. Preview. Send.</h2>
          <p>
            Designed for school routines where staff need to notify families in
            Somali, and parents can call the school back when needed.
          </p>
        </div>
        <div className="steps-grid">
          {steps.map(({ number, icon: Icon, title, text }) => (
            <article className="step-card" key={number}>
              <span className="step-number">{number}</span>
              <div className="step-icon">
                <Icon size={25} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="audience-section section" id="ways-to-use">
        <div className="section-heading">
          <span className="section-kicker">Built for schools</span>
          <h2>One clear way to reach Somali-speaking families.</h2>
          <p>
            Isfaham focuses on the reliable direction: school staff speak
            English, families receive Somali audio.
          </p>
        </div>
        <div className="audience-grid">
          {audiences.map(
            ({ icon: Icon, label, title, text, points, href, action }) => (
              <article className="audience-card" key={title}>
                <div className="audience-card-top">
                  <span className="audience-icon">
                    <Icon size={24} />
                  </span>
                  <span className="audience-label">{label}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <ul>
                  {points.map((point) => (
                    <li key={point}>
                      <Check size={14} strokeWidth={3} />
                      {point}
                    </li>
                  ))}
                </ul>
                <a className="audience-link" href={href}>
                  {action}
                  <ArrowRight size={16} />
                </a>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="school-section" id="for-schools">
        <div className="school-visual">
          <div className="school-card school-card-messenger">
            <div className="school-icon">
              <Mic size={34} />
            </div>
            <span>School voice message</span>
            <button type="button" className="school-big-mic" aria-hidden="true">
              <Mic size={36} />
            </button>
            <small>Tap to Record in English</small>
            <div className="school-mini-steps">
              <span className="active">1 Record</span>
              <span>2 Preview</span>
              <span>3 Send</span>
            </div>
          </div>
        </div>
        <div className="school-copy">
          <span className="section-kicker">Made for school routines</span>
          <h2>Help every parent take part in their child’s education.</h2>
          <p>
            Staff leave a clear Somali voice message. Parents listen from a
            secure link, then call the school back when they need to talk.
          </p>
          <ul>
            {benefits.map((benefit) => (
              <li key={benefit}>
                <span>
                  <Check size={15} strokeWidth={3} />
                </span>
                {benefit}
              </li>
            ))}
          </ul>
          <a className="button button-light" href="#pilot">
            Start school plan
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <section className="download-section section" id="download">
        <div className="download-copy">
          <span className="section-kicker">School staff app</span>
          <h2>Send Somali voice messages from your phone.</h2>
          <p>
            Authorized school staff sign in, record in English, preview Somali,
            and send parents a secure listening link by SMS.
          </p>
          <div className="store-buttons">
            {iosAppUrl ? (
              <a className="store-button" href={iosAppUrl}>
                <Apple size={28} fill="currentColor" />
                <span>
                  <small>Download on the</small>
                  App Store
                </span>
              </a>
            ) : (
              <span className="store-button store-button-disabled">
                <Apple size={28} fill="currentColor" />
                <span>
                  <small>Coming soon to the</small>
                  App Store
                </span>
              </span>
            )}
            {androidAppUrl ? (
              <a className="store-button" href={androidAppUrl}>
                <Play size={25} fill="currentColor" />
                <span>
                  <small>Get it on</small>
                  Google Play
                </span>
              </a>
            ) : (
              <span className="store-button store-button-disabled">
                <Play size={25} fill="currentColor" />
                <span>
                  <small>Coming soon to</small>
                  Google Play
                </span>
              </span>
            )}
          </div>
        </div>
        <div className="download-device" aria-hidden="true">
          <div className="mini-phone mini-phone-messenger">
            <div className="mini-phone-brand">
              <BrandMark />
              <strong>Isfaham</strong>
            </div>
            <span className="mini-ready">New Message</span>
            <div className="mini-mic mini-mic-large">
              <Mic size={36} />
            </div>
            <small>Tap to Record in English</small>
          </div>
        </div>
      </section>

      <section className="mission section" id="about">
        <span className="section-kicker">Our reason</span>
        <blockquote>
          “Isfaham” means <em>understand each other.</em>
        </blockquote>
        <p>
          We help schools reach Somali-speaking families with clear voice
          messages, so language is not a barrier to staying connected.
        </p>
      </section>

      <section className="final-cta" id="pilot">
        <div className="cta-mark">
          <BrandMark />
        </div>
        <h2>Start sending Somali voice messages.</h2>
        <p>
          Schools subscribe for $499/month, or request a short pilot first.
          After payment, your administrator can sign in and invite staff.
        </p>
        <div className="school-signup-grid">
          <div className="school-signup-panel">
            <h3>School plan</h3>
            <p>$499 per month · school staff voice messaging</p>
            <SchoolCheckoutForm />
          </div>
          <div className="school-signup-panel school-signup-panel-secondary">
            <h3>Request a pilot</h3>
            <p>Prefer to talk first? Send a short request and we’ll follow up.</p>
            <PilotForm />
          </div>
        </div>
      </section>

      <footer>
        <a className="logo footer-logo" href="#">
          <BrandMark />
          <span>Isfaham</span>
        </a>
        <p>
          <span>School-to-family Somali voice messages.</span>
          <small>Designed and developed by Dr. Askar at Automation LLC.</small>
        </p>
        <div>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
          <a href="/contact">Contact</a>
          <a href="/delete-account">Delete account</a>
          <span>© 2026 Isfaham</span>
        </div>
      </footer>
    </main>
  );
}
