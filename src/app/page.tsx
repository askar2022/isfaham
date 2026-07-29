import {
  Apple,
  ArrowRight,
  Check,
  Clock3,
  Languages,
  LockKeyhole,
  Mic,
  Play,
  School,
  Sparkles,
  UserRound,
  Volume2,
  Waves,
} from "lucide-react";

import { GuestTrialWidget } from "@/components/GuestTrialWidget";
import { PilotForm } from "@/components/PilotForm";

const steps = [
  {
    number: "01",
    icon: Mic,
    title: "Tap and speak",
    text: "Choose Somali or English, then speak naturally—one person at a time.",
  },
  {
    number: "02",
    icon: Languages,
    title: "Translate instantly",
    text: "Isfaham turns your words into clear text in the listener’s language.",
  },
  {
    number: "03",
    icon: Volume2,
    title: "Listen and respond",
    text: "Hear the translation aloud, then switch languages and continue.",
  },
];

const benefits = [
  "Designed for Somali and English conversations",
  "Simple enough for anyone to use",
  "Built around school and family communication",
  "Conversations stay private by default",
];

const audiences = [
  {
    icon: Clock3,
    label: "No account required",
    title: "Start as a guest",
    text: "Try two minutes of live Somali–English translation before deciding whether to create an account.",
    points: ["Use one phone together", "No payment information", "Private by default"],
    href: "#try",
    action: "Try 2 minutes free",
  },
  {
    icon: UserRound,
    label: "Free Personal account",
    title: "Keep translating",
    text: "Save your translation balance, use Isfaham across devices, and add more time only when you need it.",
    points: ["Save your remaining minutes", "Invite another phone", "Guest joins free"],
    href: "#download",
    action: "Get the app",
  },
  {
    icon: School,
    label: "For schools",
    title: "Support every family",
    text: "Give approved staff secure translation tools for conversations with Somali-speaking students and families.",
    points: ["Approved staff access", "Remote family invitations", "School usage overview"],
    href: "#for-schools",
    action: "Explore school access",
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

function ConversationPreview() {
  return (
    <div className="preview-wrap">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="phone" aria-label="Preview of the Isfaham conversation app">
        <div className="phone-top">
          <span>9:41</span>
          <div className="phone-status">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="app-brand">
          <BrandMark />
          <strong>Isfaham</strong>
        </div>
        <div className="live-label">
          <span className="live-dot" />
          Live conversation
        </div>
        <div className="message message-somali">
          <small>Somali</small>
          <p>Ma ku hadli karnaa Af-Soomaali?</p>
          <div className="message-meta">
            <Waves size={16} />
            <span>Just now</span>
          </div>
        </div>
        <div className="translation-line">
          <Sparkles size={16} />
          <span>Translated to English</span>
        </div>
        <div className="message message-english">
          <small>English</small>
          <p>Can we speak in Somali?</p>
          <button type="button" aria-label="Play English translation">
            <Play size={16} fill="currentColor" />
            Listen
          </button>
        </div>
        <div className="speaker-switch">
          <button type="button" className="language-pill">
            <span>SO</span>
            Somali
          </button>
          <button type="button" className="mic-button" aria-label="Start speaking">
            <Mic size={27} />
          </button>
          <button type="button" className="language-pill">
            <span>EN</span>
            English
          </button>
        </div>
        <p className="tap-hint">Tap the microphone to speak</p>
      </div>
      <div className="floating-note note-top">
        <Volume2 size={19} />
        <span>Clear voice playback</span>
      </div>
      <div className="floating-note note-bottom">
        <LockKeyhole size={19} />
        <span>Private by default</span>
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
          <a href="#ways-to-use">Personal & guest</a>
          <a href="#for-schools">For schools</a>
          <a href="#download">Get the app</a>
        </nav>
        <a className="button button-small" href="#try">
          Try it free
          <ArrowRight size={16} />
        </a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-icon">
              <Languages size={15} />
            </span>
            Live Somali ↔ English translation
          </div>
          <h1>
            Speak freely. <em>Understand each other.</em>
          </h1>
          <p className="hero-lead">
            Isfaham translates Somali and English conversations in real time,
            whether you are talking with family, helping a customer, or
            connecting a school with parents.
          </p>
          <div className="hero-actions">
            <a className="button" href="#try">
              Try 2 minutes free
              <ArrowRight size={18} />
            </a>
            <a className="text-link" href="#for-schools">
              Isfaham for schools
              <span>↓</span>
            </a>
          </div>
          <div className="hero-proof">
            <div className="avatar-stack" aria-hidden="true">
              <span>F</span>
              <span>T</span>
              <span>P</span>
            </div>
            <p>
              <strong>No account required to try</strong>
              <span>Create a free account when you are ready</span>
            </p>
          </div>
        </div>
        <ConversationPreview />
      </section>

      <section className="trust-strip" aria-label="Core product values">
        <div>
          <Waves size={23} />
          <span>
            <strong>Natural conversation</strong>
            One person speaks at a time
          </span>
        </div>
        <div>
          <Languages size={23} />
          <span>
            <strong>Somali ↔ English</strong>
            Voice and text translation
          </span>
        </div>
        <div>
          <LockKeyhole size={23} />
          <span>
            <strong>Privacy first</strong>
            Designed for real conversations
          </span>
        </div>
      </section>

      <section className="guest-trial-section section" id="try">
        <div className="guest-trial-copy">
          <span className="section-kicker">Try Isfaham in your browser</span>
          <h2>Choose a language, then start speaking.</h2>
          <p>
            Test two minutes of live Somali–English translation here—no app,
            account, or payment information needed.
          </p>
          <ul>
            <li>
              <Check size={15} strokeWidth={3} />
              Allow microphone access when your browser asks
            </li>
            <li>
              <Check size={15} strokeWidth={3} />
              One person speaks at a time
            </li>
            <li>
              <Check size={15} strokeWidth={3} />
              Tap again when you finish speaking
            </li>
          </ul>
        </div>
        <GuestTrialWidget />
      </section>

      <section className="section how" id="how-it-works">
        <div className="section-heading">
          <span className="section-kicker">How it works</span>
          <h2>A conversation, not a complicated tool.</h2>
          <p>
            No training and no confusing menus. Just choose a language, speak,
            and understand each other.
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
          <span className="section-kicker">One translator, your choice</span>
          <h2>Start the way that works for you.</h2>
          <p>
            Try Isfaham without an account, create a Personal account when you
            want more, or bring secure translation access to your school.
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
          <div className="school-card">
            <div className="school-icon">
              <School size={34} />
            </div>
            <span>Family–teacher conversation</span>
            <div className="conversation-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="connected-people">
              <span>SO</span>
              <div>
                <i />
                <Languages size={18} />
                <i />
              </div>
              <span>EN</span>
            </div>
          </div>
        </div>
        <div className="school-copy">
          <span className="section-kicker">Made for meaningful moments</span>
          <h2>Help every parent take part in their child’s education.</h2>
          <p>
            From quick front-office questions to parent-teacher conferences,
            Isfaham helps schools communicate more clearly with Somali-speaking
            families.
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
            Request a school pilot
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <section className="download-section section" id="download">
        <div className="download-copy">
          <span className="section-kicker">One app, two platforms</span>
          <h2>Start free. Create an account when you are ready.</h2>
          <p>
            Begin with two free translation minutes and no account. A free
            Personal account lets you keep your balance, invite another phone,
            and purchase more time when needed.
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
          <div className="mini-phone">
            <div className="mini-phone-brand">
              <BrandMark />
              <strong>Isfaham</strong>
            </div>
            <span className="mini-ready">Ready to listen</span>
            <div className="mini-language">
              <span>SO</span>
              <i />
              <Languages size={17} />
              <i />
              <span>EN</span>
            </div>
            <div className="mini-mic">
              <Mic size={27} />
            </div>
            <small>Hold to speak</small>
          </div>
        </div>
      </section>

      <section className="mission section" id="about">
        <span className="section-kicker">Our reason</span>
        <blockquote>
          “Isfaham” means <em>understand each other.</em>
        </blockquote>
        <p>
          We are building technology around a simple belief: language should
          never stand between people who need to understand each other.
        </p>
      </section>

      <section className="final-cta" id="pilot">
        <div className="cta-mark">
          <BrandMark />
        </div>
        <h2>Start a better conversation.</h2>
        <p>
          Join the Isfaham pilot and help shape a translation experience made
          for your school community.
        </p>
        <PilotForm />
      </section>

      <footer>
        <a className="logo footer-logo" href="#">
          <BrandMark />
          <span>Isfaham</span>
        </a>
        <p>
          <span>Understand each other.</span>
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
