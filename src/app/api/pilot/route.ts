import { NextResponse } from "next/server";
import { Resend } from "resend";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      school?: string;
      role?: string;
      website?: string;
    };

    // Hidden honeypot field. Return success without sending if a bot fills it.
    if (body.website) {
      return NextResponse.json({ ok: true });
    }

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const school = body.school?.trim();
    const role = body.role?.trim();

    if (!name || !email || !school || !EMAIL_PATTERN.test(email)) {
      return NextResponse.json(
        { error: "Please enter your name, school, and a valid email." },
        { status: 400 },
      );
    }

    if (name.length > 100 || email.length > 200 || school.length > 150) {
      return NextResponse.json(
        { error: "One or more fields are too long." },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.RESEND_FROM_EMAIL ?? "Isfaham <hello@isfaham.org>";
    const notificationEmail =
      process.env.PILOT_NOTIFICATION_EMAIL ?? "hello@isfaham.org";

    if (!apiKey) {
      return NextResponse.json(
        { error: "Pilot signup email is not configured yet." },
        { status: 503 },
      );
    }

    const resend = new Resend(apiKey);
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSchool = escapeHtml(school);
    const safeRole = escapeHtml(role || "Not provided");

    const { error } = await resend.emails.send({
      from,
      to: notificationEmail,
      replyTo: email,
      subject: `New Isfaham pilot request — ${school}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#201a2e">
          <h1 style="color:#5b38d2">New pilot request</h1>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>School:</strong> ${safeSchool}</p>
          <p><strong>Role:</strong> ${safeRole}</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend pilot email failed:", error);
      return NextResponse.json(
        { error: "We could not send your request. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Pilot signup failed:", error);
    return NextResponse.json(
      { error: "We could not send your request. Please try again." },
      { status: 500 },
    );
  }
}
