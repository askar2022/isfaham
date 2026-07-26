"use client";

import {
  ArrowRight,
  AudioLines,
  BarChart3,
  Check,
  Clock3,
  Copy,
  DollarSign,
  Link2,
  Loader2,
  LogOut,
  MessageCircleMore,
  Phone,
  Plus,
  UserCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type RecentConversation = {
  id: string;
  token: string;
  status: string;
  createdAt: string;
  lastFour: string | null;
};

type CreatedConversation = {
  conversationUrl: string;
  publicToken: string;
  smsSent: boolean;
  warning?: string;
};

type UsageSummary = {
  conversations: number;
  averageSessionMinutes: number;
  averageTurns: number;
  speechMinutes: number;
  invitations: number;
  joinRate: number;
  translationFailures: number;
  estimatedCostUsd: number;
};

export function TeacherDashboard({
  teacherName,
  schoolName,
  conversations,
  usage,
}: {
  teacherName: string;
  schoolName: string;
  conversations: RecentConversation[];
  usage: UsageSummary;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [teacherPhone, setTeacherPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedConversation | null>(null);
  const [copied, setCopied] = useState(false);
  const usageCards = [
    {
      label: "Conversations",
      value: usage.conversations.toLocaleString(),
      icon: BarChart3,
    },
    {
      label: "Average session",
      value: `${usage.averageSessionMinutes.toFixed(1)} min`,
      icon: Clock3,
    },
    {
      label: "Average turns",
      value: usage.averageTurns.toFixed(1),
      icon: MessageCircleMore,
    },
    {
      label: "Speech processed",
      value: `${usage.speechMinutes.toFixed(1)} min`,
      icon: AudioLines,
    },
    {
      label: "Invitations sent",
      value: usage.invitations.toLocaleString(),
      icon: Phone,
    },
    {
      label: "Parent join rate",
      value: `${usage.joinRate.toFixed(0)}%`,
      icon: UserCheck,
    },
    {
      label: "Translation failures",
      value: usage.translationFailures.toLocaleString(),
      icon: Link2,
    },
    {
      label: "Estimated AI cost",
      value: `$${usage.estimatedCostUsd.toFixed(2)}`,
      icon: DollarSign,
    },
  ];

  async function createConversation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherPhone, parentPhone }),
      });
      const body = (await response.json()) as CreatedConversation & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error || "Please try again.");
      }

      setCreated(body);
      router.refresh();
    } catch (creationError) {
      setError(
        creationError instanceof Error
          ? creationError.message
          : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!created) return;
    await navigator.clipboard.writeText(created.conversationUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/teacher/login");
    router.refresh();
  }

  return (
    <div className="teacher-shell">
      <header className="teacher-header">
        <Link className="teacher-brand" href="/">
          <span className="teacher-brand-mark">
            <MessageCircleMore size={22} />
          </span>
          <strong>Isfaham</strong>
        </Link>
        <div className="teacher-account">
          <span>
            <strong>{teacherName}</strong>
            <small>{schoolName}</small>
          </span>
          <button aria-label="Sign out" onClick={signOut}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="teacher-main">
        <section className="teacher-welcome">
          <div>
            <span className="section-kicker">Teacher workspace</span>
            <h1>Welcome, {teacherName.split(" ")[0]}.</h1>
            <p>
              Start a private Somali–English conversation with a family. They
              can join from their browser—no account or download needed.
            </p>
          </div>
          <button
            className="button"
            onClick={() => {
              setShowForm(true);
              setCreated(null);
            }}
          >
            <Plus size={18} />
            New conversation
          </button>
        </section>

        <section className="usage-section">
          <div className="usage-heading">
            <div>
              <h2>Your usage</h2>
              <span>All time • No audio or transcript data</span>
            </div>
          </div>
          <div className="usage-grid">
            {usageCards.map(({ label, value, icon: Icon }) => (
              <article className="usage-card" key={label}>
                <span className="usage-card-icon">
                  <Icon size={18} />
                </span>
                <strong>{value}</strong>
                <small>{label}</small>
              </article>
            ))}
          </div>
        </section>

        {showForm && (
          <section className="create-conversation-card">
            <div className="create-card-heading">
              <div>
                <h2>Invite a parent</h2>
                <p>
                  Twilio hides both numbers and sends a private, expiring link.
                </p>
              </div>
              <button
                aria-label="Close invitation form"
                onClick={() => setShowForm(false)}
              >
                ×
              </button>
            </div>

            {created ? (
              <div className="invite-success">
                <span className="invite-success-icon">
                  <Check size={22} />
                </span>
                <div>
                  <h3>Conversation is ready</h3>
                  <p>
                    {created.smsSent
                      ? "The private link was sent to the parent."
                      : created.warning}
                  </p>
                </div>
                <div className="invite-link-row">
                  <code>{created.conversationUrl}</code>
                  <button onClick={copyLink}>
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <Link
                  className="button"
                  href={`/c/${created.publicToken}?teacher=1`}
                >
                  Enter conversation
                  <ArrowRight size={18} />
                </Link>
              </div>
            ) : (
              <form className="conversation-form" onSubmit={createConversation}>
                <label>
                  <span>
                    <Phone size={16} />
                    Your school or personal phone
                  </span>
                  <input
                    autoComplete="tel"
                    inputMode="tel"
                    onChange={(event) => setTeacherPhone(event.target.value)}
                    placeholder="+1 612 555 0123"
                    required
                    value={teacherPhone}
                  />
                  <small>Your number remains hidden from the parent.</small>
                </label>
                <label>
                  <span>
                    <Phone size={16} />
                    Parent phone
                  </span>
                  <input
                    autoComplete="off"
                    inputMode="tel"
                    onChange={(event) => setParentPhone(event.target.value)}
                    placeholder="+1 612 555 0456"
                    required
                    value={parentPhone}
                  />
                  <small>Include the country code. The link expires in one hour.</small>
                </label>
                <button className="button" disabled={loading}>
                  {loading ? <Loader2 className="spin" size={18} /> : <Link2 size={18} />}
                  {loading ? "Creating…" : "Create and send invitation"}
                </button>
                {error && <p className="auth-error">{error}</p>}
              </form>
            )}
          </section>
        )}

        <section className="recent-section">
          <div className="recent-heading">
            <h2>Recent conversations</h2>
            <span>Links automatically expire after 60 minutes</span>
          </div>
          {conversations.length ? (
            <div className="conversation-list">
              {conversations.map((conversation) => (
                <Link
                  className="conversation-list-item"
                  href={`/c/${conversation.token}?teacher=1`}
                  key={conversation.id}
                >
                  <span className="conversation-list-icon">
                    <MessageCircleMore size={21} />
                  </span>
                  <span className="conversation-list-details">
                    <strong>
                      Parent {conversation.lastFour ? `•••• ${conversation.lastFour}` : ""}
                    </strong>
                    <small>
                      <Clock3 size={13} />
                      {new Date(conversation.createdAt).toLocaleString()}
                    </small>
                  </span>
                  <span className={`status status-${conversation.status}`}>
                    {conversation.status}
                  </span>
                  <ArrowRight className="list-arrow" size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-conversations">
              <MessageCircleMore size={30} />
              <strong>No conversations yet</strong>
              <span>Your new family conversations will appear here.</span>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
