"use client";

import {
  ArrowLeft,
  Check,
  Loader2,
  LogOut,
  Mail,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Teacher = {
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
};

export function AdminTeacherPortal({
  schoolName,
  initialTeachers,
}: {
  schoolName: string;
  initialTeachers: Teacher[];
}) {
  const router = useRouter();
  const [teachers, setTeachers] = useState(initialTeachers);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return teachers;
    return teachers.filter(
      (teacher) =>
        teacher.email.toLowerCase().includes(query) ||
        teacher.full_name?.toLowerCase().includes(query),
    );
  }, [search, teachers]);

  async function addTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName }),
      });
      const body = (await response.json()) as {
        teacher?: Teacher;
        error?: string;
      };

      if (!response.ok || !body.teacher) {
        throw new Error(body.error || "The staff member could not be added.");
      }

      setTeachers((current) => [
        body.teacher!,
        ...current.filter((teacher) => teacher.email !== body.teacher!.email),
      ]);
      setEmail("");
      setFullName("");
      setSuccess(`${body.teacher.email} can now sign in.`);
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateAccess(teacher: Teacher) {
    setUpdatingEmail(teacher.email);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/teachers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: teacher.email,
          isActive: !teacher.is_active,
        }),
      });
      const body = (await response.json()) as {
        teacher?: Teacher;
        error?: string;
      };

      if (!response.ok || !body.teacher) {
        throw new Error(body.error || "Access could not be updated.");
      }

      setTeachers((current) =>
        current.map((item) =>
          item.email === body.teacher!.email ? body.teacher! : item,
        ),
      );
      setSuccess(
        body.teacher.is_active
          ? `${body.teacher.email} can sign in again.`
          : `${body.teacher.email} has been deactivated.`,
      );
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Please try again.",
      );
    } finally {
      setUpdatingEmail(null);
    }
  }

  const activeCount = teachers.filter((teacher) => teacher.is_active).length;

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/teacher/login");
    router.refresh();
  }

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link href="/teacher">
          <ArrowLeft size={18} />
          Staff workspace
        </Link>
        <div className="admin-header-actions">
          <span>
            <ShieldCheck size={17} />
            School administrator
          </span>
          <button onClick={signOut}>
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </header>

      <div className="admin-main">
        <section className="admin-title">
          <div>
            <span className="section-kicker">Access management</span>
            <h1>Manage school staff</h1>
            <p>
              Add approved school emails and control who can sign in to
              Isfaham.
            </p>
          </div>
          <div className="admin-school-card">
            <span>
              <Users size={20} />
            </span>
            <div>
              <strong>{schoolName}</strong>
              <small>{activeCount} active staff members</small>
            </div>
          </div>
        </section>

        <section className="add-teacher-card">
          <div className="add-teacher-heading">
            <span>
              <UserPlus size={21} />
            </span>
            <div>
              <h2>Add a staff member</h2>
              <p>They will use this email to receive their six-digit code.</p>
            </div>
          </div>
          <form onSubmit={addTeacher}>
            <label>
              Full name
              <input
                autoComplete="name"
                maxLength={100}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Amina Hassan"
                value={fullName}
              />
            </label>
            <label>
              School email
              <input
                autoComplete="email"
                maxLength={200}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@school.org"
                required
                type="email"
                value={email}
              />
            </label>
            <button className="button" disabled={loading}>
              {loading ? (
                <Loader2 className="spin" size={18} />
              ) : (
                <UserPlus size={18} />
              )}
              {loading ? "Adding…" : "Add staff member"}
            </button>
          </form>
          {error && <p className="admin-message admin-error">{error}</p>}
          {success && (
            <p className="admin-message admin-success">
              <Check size={15} />
              {success}
            </p>
          )}
        </section>

        <section className="teacher-directory">
          <div className="directory-heading">
            <div>
              <h2>Approved staff</h2>
              <span>{teachers.length} total accounts</span>
            </div>
            <label className="admin-search">
              <Search size={16} />
              <input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search staff"
                type="search"
                value={search}
              />
            </label>
          </div>

          <div className="teacher-table">
            <div className="teacher-table-head">
              <span>Staff member</span>
              <span>Role</span>
              <span>Status</span>
              <span>Access</span>
            </div>
            {filteredTeachers.map((teacher) => (
              <article className="teacher-row" key={teacher.email}>
                <span className="teacher-identity">
                  <i>
                    {(teacher.full_name || teacher.email)
                      .slice(0, 1)
                      .toUpperCase()}
                  </i>
                  <span>
                    <strong>{teacher.full_name || "Staff member"}</strong>
                    <small>
                      <Mail size={12} />
                      {teacher.email}
                    </small>
                  </span>
                </span>
                <span className="teacher-role">
                  {teacher.is_admin ? "Administrator" : "Staff"}
                </span>
                <span
                  className={`teacher-access-status ${
                    teacher.is_active ? "access-active" : "access-inactive"
                  }`}
                >
                  {teacher.is_active ? "Active" : "Inactive"}
                </span>
                <button
                  disabled={
                    updatingEmail === teacher.email || teacher.is_admin
                  }
                  onClick={() => updateAccess(teacher)}
                >
                  {updatingEmail === teacher.email ? (
                    <Loader2 className="spin" size={15} />
                  ) : teacher.is_admin ? (
                    "Protected"
                  ) : teacher.is_active ? (
                    "Deactivate"
                  ) : (
                    "Reactivate"
                  )}
                </button>
              </article>
            ))}
            {!filteredTeachers.length && (
              <div className="directory-empty">
                <Users size={25} />
                <span>No staff members match your search.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
