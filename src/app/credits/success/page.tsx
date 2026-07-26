import Link from "next/link";

export const metadata = {
  title: "Translation credits added",
};

export default function CreditSuccessPage() {
  return (
    <main className="room-state-page">
      <div className="waiting-logo ended-logo">✓</div>
      <h1>Translation credits added</h1>
      <p>Return to Isfaham and refresh your balance.</p>
      <a className="button" href="isfaham://credits">
        Return to the app
      </a>
      <Link href="/">Isfaham home</Link>
    </main>
  );
}
