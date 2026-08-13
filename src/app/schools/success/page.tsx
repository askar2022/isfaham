import Link from "next/link";

export const metadata = {
  title: "School subscription started",
};

export default function SchoolSuccessPage() {
  return (
    <main className="room-state-page">
      <div className="waiting-logo ended-logo">✓</div>
      <h1>School subscription started</h1>
      <p>
        Your school plan is active. Sign in with the work email you used at
        checkout to open the school portal.
      </p>
      <Link className="button" href="/teacher/login">
        Open school sign in
      </Link>
      <Link href="/">Isfaham home</Link>
    </main>
  );
}
