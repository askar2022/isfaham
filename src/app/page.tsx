import {
  Apple,
  ArrowRight,
  Check,
  Languages,
  LockKeyhole,
  Mic,
  Play,
  School,
  Sparkles,
  Volume2,
  Waves,
} from "lucide-react";

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
          <p>Sidee ayuu dugsiga uga socdaa ilmahayga?</p>
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
          <p>How is my child doing at school?</p>
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
          <a href="#for-schools">For schools</a>
          <a href="#download">Get the app</a>
          <a href="#about">Why Isfaham</a>
        </nav>
        <a className="button button-small" href="#pilot">
          Join the pilot
          <ArrowRight size={16} />
        </a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="eyebrow-icon">
              <School size={15} />
            </span>
            Built for schools and families
          </div>
          <h1>
            Every family deserves to be <em>understood.</em>
          </h1>
          <p className="hero-lead">
            Isfaham translates Somali and English conversations in real time,
            helping teachers and families connect without a language barrier.
          </p>
          <div className="hero-actions">
            <a className="button" href="#pilot">
              Bring Isfaham to your school
              <ArrowRight size={18} />
            </a>
            <a className="text-link" href="#how-it-works">
              See how it works
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
              <strong>Made with our community</strong>
              <span>For real conversations that matter</span>
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
            Designed for school communities
          </span>
        </div>
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
          <h2>Keep understanding close at hand.</h2>
          <p>
            Isfaham is being prepared for iPhone and Android. Join the pilot now
            and we’ll let you know when school testing begins.
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
          never stand between a family and their child’s education.
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
        <p>Understand each other.</p>
        <div>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
          <a href="/contact">Contact</a>
          <span>© 2026 Isfaham</span>
        </div>
      </footer>
    </main>
  );
}
