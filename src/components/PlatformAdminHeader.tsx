"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const personalLinks = [
  { href: "/admin/personal", label: "Personal Users" },
  { href: "/admin/guests", label: "Guest Trials" },
];

const schoolLinks = [{ href: "/admin", label: "School Staff" }];

export function PlatformAdminHeader({
  workspace = "personal",
}: {
  workspace?: "personal" | "school";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const links = workspace === "school" ? schoolLinks : personalLinks;

  async function signOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.replace(
      workspace === "school" ? "/teacher/login" : "/admin/login",
    );
    router.refresh();
  }

  return (
    <header className="admin-header platform-admin-header">
      <nav aria-label="Platform administration">
        {links.map((link) => (
          <Link
            className={pathname === link.href ? "platform-nav-active" : ""}
            href={link.href}
            key={link.href}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="admin-header-actions">
        <span>
          <ShieldCheck size={17} />
          Platform administrator
        </span>
        <button onClick={signOut}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </header>
  );
}
