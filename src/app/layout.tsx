import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";

const display = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://isfaham.org"),
  title: {
    default: "Isfaham — Understand each other",
    template: "%s | Isfaham",
  },
  description:
    "School-to-family Somali voice messages. Staff record in English; parents receive a secure Somali listening link by SMS.",
  openGraph: {
    title: "Isfaham — School-to-family Somali voice messages",
    description:
      "Staff record in English. Parents receive Somali audio through a secure SMS link.",
    url: "https://isfaham.org",
    siteName: "Isfaham",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>{children}</body>
    </html>
  );
}
