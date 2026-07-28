import { redirect } from "next/navigation";

import { AdminGuestTrials } from "@/components/AdminGuestTrials";
import { getPlatformAdminContext } from "@/lib/platform-admin";

export const metadata = {
  title: "Guest trial activity",
};

export const dynamic = "force-dynamic";

export default async function GuestTrialsPage() {
  const context = await getPlatformAdminContext();
  if (!context) redirect("/admin");

  return <AdminGuestTrials />;
}
