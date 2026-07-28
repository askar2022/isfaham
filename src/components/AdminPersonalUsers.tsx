"use client";

import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Search,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { PlatformAdminHeader } from "@/components/PlatformAdminHeader";

type PersonalUser = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  disabled: boolean;
  balanceSeconds: number;
  purchasedSeconds: number;
  usedSeconds: number;
};

type Overview = {
  personalUsers: number;
  schoolStaff: number;
  guestTrials: number;
  guestTrialsLast30Days: number;
};

type Pagination = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

function formatMinutes(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h ${minutes % 60}m`
    : `${minutes} min`;
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function AdminPersonalUsers() {
  const [users, setUsers] = useState<PersonalUser[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadUsers = useCallback(async (page = 1, query = "") => {
    setLoading(true);
    setError("");
    try {
      const parameters = new URLSearchParams({
        page: String(page),
        perPage: "50",
      });
      if (query.trim()) parameters.set("search", query.trim());
      const response = await fetch(
        `/api/admin/personal-users?${parameters.toString()}`,
      );
      const body = (await response.json()) as {
        users?: PersonalUser[];
        overview?: Overview;
        pagination?: Pagination;
        error?: string;
      };
      if (!response.ok || !body.users || !body.overview || !body.pagination) {
        throw new Error(body.error || "Personal users could not be loaded.");
      }
      setUsers(body.users);
      setOverview(body.overview);
      setPagination(body.pagination);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => void loadUsers(), 0);
    return () => clearTimeout(initialLoad);
  }, [loadUsers]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadUsers(1, search);
  }

  async function updateAccess(user: PersonalUser) {
    setUpdatingId(user.id);
    setError("");
    try {
      const response = await fetch("/api/admin/personal-users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, disabled: !user.disabled }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "Access could not be updated.");
      }
      setUsers((current) =>
        current.map((candidate) =>
          candidate.id === user.id
            ? { ...candidate, disabled: !user.disabled }
            : candidate,
        ),
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Please try again.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeUser(user: PersonalUser) {
    const confirmed = window.confirm(
      `Permanently delete ${user.email}? Their remaining translation balance and hosted conversations will also be deleted. This cannot be undone.`,
    );
    if (!confirmed) return;

    setUpdatingId(user.id);
    setError("");
    try {
      const response = await fetch("/api/admin/personal-users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "The user could not be deleted.");
      }
      await loadUsers(pagination?.page ?? 1, search);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Please try again.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="admin-page">
      <PlatformAdminHeader />
      <div className="admin-main">
        <section className="admin-title">
          <div>
            <span className="section-kicker">Personal accounts</span>
            <h1>Manage Personal users</h1>
            <p>
              Review individual balances and access without mixing these users
              with school staff.
            </p>
          </div>
        </section>

        <section className="platform-metrics" aria-label="Account overview">
          <article>
            <UserRound size={20} />
            <strong>{overview?.personalUsers ?? "—"}</strong>
            <span>Personal users</span>
          </article>
          <article>
            <WalletCards size={20} />
            <strong>
              {users.length
                ? formatMinutes(
                    users.reduce(
                      (total, user) => total + user.balanceSeconds,
                      0,
                    ),
                  )
                : "—"}
            </strong>
            <span>Balance on this page</span>
          </article>
          <article>
            <Clock3 size={20} />
            <strong>{overview?.guestTrials ?? "—"}</strong>
            <span>Guest trials, separately</span>
          </article>
        </section>

        <section className="teacher-directory personal-directory">
          <div className="directory-heading">
            <div>
              <h2>Personal user directory</h2>
              <span>{pagination?.total ?? 0} registered Personal accounts</span>
            </div>
            <form className="admin-search" onSubmit={submitSearch}>
              <Search size={16} />
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by email"
                type="search"
                value={search}
              />
            </form>
          </div>

          {error && <p className="admin-message admin-error">{error}</p>}
          <div className="personal-user-table">
            <div className="personal-user-table-head">
              <span>User</span>
              <span>Translation balance</span>
              <span>Usage</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {loading ? (
              <div className="directory-empty">
                <Loader2 className="spin" size={24} />
                <span>Loading Personal users…</span>
              </div>
            ) : (
              users.map((user) => (
                <article className="personal-user-row" key={user.id}>
                  <span className="teacher-identity">
                    <i>{user.email.slice(0, 1).toUpperCase()}</i>
                    <span>
                      <strong>{user.email}</strong>
                      <small>Joined {formatDate(user.createdAt)}</small>
                    </span>
                  </span>
                  <span>
                    <strong>{formatMinutes(user.balanceSeconds)}</strong>
                    <small>{formatMinutes(user.purchasedSeconds)} purchased</small>
                  </span>
                  <span>
                    <strong>{formatMinutes(user.usedSeconds)}</strong>
                    <small>Last sign-in {formatDate(user.lastSignInAt)}</small>
                  </span>
                  <span
                    className={`teacher-access-status ${
                      user.disabled ? "access-inactive" : "access-active"
                    }`}
                  >
                    {user.disabled ? "Disabled" : "Active"}
                  </span>
                  <span className="personal-user-actions">
                    <button
                      disabled={updatingId === user.id}
                      onClick={() => updateAccess(user)}
                      title={user.disabled ? "Restore access" : "Disable access"}
                    >
                      {updatingId === user.id ? (
                        <Loader2 className="spin" size={15} />
                      ) : user.disabled ? (
                        <CheckCircle2 size={15} />
                      ) : (
                        <Ban size={15} />
                      )}
                      {user.disabled ? "Enable" : "Disable"}
                    </button>
                    <button
                      className="personal-delete-button"
                      disabled={updatingId === user.id}
                      onClick={() => removeUser(user)}
                      title="Permanently delete user"
                    >
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </span>
                </article>
              ))
            )}
            {!loading && !users.length && (
              <div className="directory-empty">
                <UserRound size={25} />
                <span>No Personal users match this search.</span>
              </div>
            )}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="admin-pagination">
              <button
                disabled={pagination.page <= 1 || loading}
                onClick={() => loadUsers(pagination.page - 1, search)}
              >
                <ChevronLeft size={15} />
                Previous
              </button>
              <span>
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => loadUsers(pagination.page + 1, search)}
              >
                Next
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
