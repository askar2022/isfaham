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
    "Real-time Somali and English voice translation for Personal conversations, families, and schools. Try two minutes free without an account.",
  openGraph: {
    title: "Isfaham — Understand each other",
    description:
      "Real-time Somali and English voice translation for everyday conversations, families, and schools.",
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
