import Link from "next/link";
import type { ReactNode } from "react";

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

export function PolicyPage({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="policy-page">
      <header className="policy-header">
        <Link className="logo" href="/">
          <BrandMark />
          <span>Isfaham</span>
        </Link>
        <nav aria-label="Legal and support navigation">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/support">Support</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </header>

      <section className="policy-hero">
        <span className="section-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>

      <article className="policy-content">{children}</article>

      <footer className="policy-footer">
        <Link className="logo footer-logo" href="/">
          <BrandMark />
          <span>Isfaham</span>
        </Link>
        <p>Real-time voice translation.</p>
        <div>
          <a href="mailto:support@isfaham.org">support@isfaham.org</a>
          <span>© 2026 Isfaham</span>
        </div>
      </footer>
    </main>
  );
}
