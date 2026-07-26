import { redirect } from "next/navigation";

import { TeacherDashboard } from "@/components/TeacherDashboard";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Teacher workspace",
};

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/teacher/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/teacher/login?error=profile");
  }

  const [
    { data: school },
    { data: conversationRows },
    { data: usageRows },
  ] = await Promise.all([
    supabase.from("schools").select("name").eq("id", profile.school_id).single(),
    supabase
      .from("conversations")
      .select("id, public_token, status, created_at, parent_phone_last_four")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase
      .from("conversations")
      .select(
        "started_at, ended_at, invitation_sent_at, parent_joined_at, turn_count, speech_duration_ms, translation_failure_count, estimated_cost_microusd",
      )
      .eq("teacher_id", user.id),
  ]);

  const conversations = (conversationRows ?? []).map((conversation) => ({
    id: conversation.id as string,
    token: conversation.public_token as string,
    status: conversation.status as string,
    createdAt: conversation.created_at as string,
    lastFour: conversation.parent_phone_last_four as string | null,
  }));
  const usage = (usageRows ?? []).reduce(
    (summary, conversation) => {
      summary.conversations += 1;
      summary.turns += Number(conversation.turn_count ?? 0);
      summary.speechDurationMs += Number(
        conversation.speech_duration_ms ?? 0,
      );
      summary.translationFailures += Number(
        conversation.translation_failure_count ?? 0,
      );
      summary.estimatedCostMicrousd += Number(
        conversation.estimated_cost_microusd ?? 0,
      );
      if (conversation.invitation_sent_at) summary.invitations += 1;
      if (conversation.parent_joined_at) summary.joins += 1;
      if (conversation.started_at && conversation.ended_at) {
        summary.completedSessionSeconds += Math.max(
          0,
          (new Date(conversation.ended_at).getTime() -
            new Date(conversation.started_at).getTime()) /
            1000,
        );
        summary.completedSessions += 1;
      }
      return summary;
    },
    {
      conversations: 0,
      invitations: 0,
      joins: 0,
      turns: 0,
      speechDurationMs: 0,
      translationFailures: 0,
      estimatedCostMicrousd: 0,
      completedSessionSeconds: 0,
      completedSessions: 0,
    },
  );

  return (
    <TeacherDashboard
      conversations={conversations}
      schoolName={school?.name ?? "Your school"}
      teacherName={profile.full_name || profile.email || "Teacher"}
      usage={{
        conversations: usage.conversations,
        averageSessionMinutes: usage.completedSessions
          ? usage.completedSessionSeconds / usage.completedSessions / 60
          : 0,
        averageTurns: usage.conversations
          ? usage.turns / usage.conversations
          : 0,
        speechMinutes: usage.speechDurationMs / 60_000,
        invitations: usage.invitations,
        joinRate: usage.invitations
          ? (usage.joins / usage.invitations) * 100
          : 0,
        translationFailures: usage.translationFailures,
        estimatedCostUsd: usage.estimatedCostMicrousd / 1_000_000,
      }}
    />
  );
}
