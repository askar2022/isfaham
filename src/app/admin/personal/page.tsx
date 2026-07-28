import { redirect } from "next/navigation";

import { AdminPersonalUsers } from "@/components/AdminPersonalUsers";
import { getPlatformAdminContext } from "@/lib/platform-admin";

export const metadata = {
  title: "Manage Personal users",
};

export const dynamic = "force-dynamic";

export default async function PersonalUsersPage() {
  const context = await getPlatformAdminContext();
  if (!context) redirect("/admin");

  return <AdminPersonalUsers />;
}
