import { ParentListenPlayer } from "@/components/ParentListenPlayer";

export const metadata = {
  title: "Somali voice message",
  robots: {
    index: false,
    follow: false,
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
