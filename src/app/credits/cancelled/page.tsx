export const metadata = {
  title: "Checkout cancelled",
};

export default function CreditCancelledPage() {
  return (
    <main className="room-state-page">
      <h1>Checkout cancelled</h1>
      <p>No payment was made. You can return to Isfaham whenever you’re ready.</p>
      <a className="button" href="isfaham://credits">
        Return to the app
      </a>
    </main>
  );
}
