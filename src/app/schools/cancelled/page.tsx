import Link from "next/link";

export const metadata = {
  title: "School checkout cancelled",
};

export default function SchoolCancelledPage() {
  return (
    <main className="room-state-page">
      <div className="waiting-logo ended-logo">!</div>
      <h1>Checkout cancelled</h1>
      <p>No charge was made. You can restart school checkout anytime.</p>
      <Link className="button" href="/#pilot">
        Back to school signup
      </Link>
      <Link href="/">Isfaham home</Link>
    </main>
  );
}
