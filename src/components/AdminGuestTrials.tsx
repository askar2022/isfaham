"use client";

import { Clock3, Loader2, School, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { PlatformAdminHeader } from "@/components/PlatformAdminHeader";

type Overview = {
  personalUsers: number;
  schoolStaff: number;
  guestTrials: number;
  guestTrialsLast30Days: number;
};

export function AdminGuestTrials() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  const loadOverview = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(
        "/api/admin/personal-users?page=1&perPage=10",
      );
      const body = (await response.json()) as {
        overview?: Overview;
        error?: string;
      };
      if (!response.ok || !body.overview) {
        throw new Error(body.error || "Guest metrics could not be loaded.");
      }
      setOverview(body.overview);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Please try again.",
      );
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => void loadOverview(), 0);
    return () => clearTimeout(initialLoad);
  }, [loadOverview]);

  return (
    <main className="admin-page">
      <PlatformAdminHeader />
      <div className="admin-main">
        <section className="admin-title">
          <div>
            <span className="section-kicker">Privacy-safe overview</span>
            <h1>Guest trial activity</h1>
            <p>
              Monitor adoption without mixing temporary guests with registered
              Personal users or school staff.
            </p>
          </div>
        </section>

        {error && <p className="admin-message admin-error">{error}</p>}
        {!overview && !error ? (
          <div className="guest-loading">
            <Loader2 className="spin" size={28} />
            Loading guest activity…
          </div>
        ) : (
          <section className="platform-metrics guest-metrics">
            <article>
              <Clock3 size={22} />
              <strong>{overview?.guestTrials ?? 0}</strong>
              <span>All guest trials</span>
            </article>
            <article>
              <Clock3 size={22} />
              <strong>{overview?.guestTrialsLast30Days ?? 0}</strong>
              <span>New guests in 30 days</span>
            </article>
            <article>
              <UserRound size={22} />
              <strong>{overview?.personalUsers ?? 0}</strong>
              <span>Registered Personal users</span>
            </article>
            <article>
              <School size={22} />
              <strong>{overview?.schoolStaff ?? 0}</strong>
              <span>School staff accounts</span>
            </article>
          </section>
        )}

        <section className="guest-privacy-card">
          <span>
            <ShieldCheck size={24} />
          </span>
          <div>
            <h2>Guests remain separate</h2>
            <p>
              Guest sessions appear here only as aggregate counts. They are not
              shown in the Personal user directory and do not receive staff
              access. When a guest verifies an email, the account moves into
              Personal Users while preserving its translation balance.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
