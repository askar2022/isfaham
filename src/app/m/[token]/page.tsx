import type { Metadata } from "next";

import { ParentListenPlayer } from "@/components/ParentListenPlayer";

export const metadata: Metadata = {
  title: "Somali voice message from school",
  description:
    "Open this page to listen to the Somali voice message and read the text from your child's school.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Somali voice message from school",
    description:
      "Listen to the Somali audio and read the message text from your child's school.",
    type: "website",
  },
};

export default async function ParentListenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ParentListenPlayer token={token} />;
}
