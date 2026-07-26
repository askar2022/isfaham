import { ConversationRoom } from "@/components/ConversationRoom";

export const metadata = {
  title: "Private conversation",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ConversationRoom token={token} />;
}
