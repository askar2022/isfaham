alter table public.conversations
  add column started_at timestamptz,
  add column parent_joined_at timestamptz,
  add column invitation_sent_at timestamptz,
  add column invitation_status text not null default 'pending'
    check (invitation_status in ('pending', 'sent', 'failed', 'manual')),
  add column turn_count integer not null default 0
    check (turn_count >= 0),
  add column speech_duration_ms bigint not null default 0
    check (speech_duration_ms >= 0),
  add column source_character_count bigint not null default 0
    check (source_character_count >= 0),
  add column translated_character_count bigint not null default 0
    check (translated_character_count >= 0),
  add column translation_failure_count integer not null default 0
    check (translation_failure_count >= 0),
  add column estimated_cost_microusd bigint not null default 0
    check (estimated_cost_microusd >= 0);

comment on column public.conversations.estimated_cost_microusd is
  'Estimated provider cost in millionths of one US dollar. 1000000 = $1.00.';

create or replace function public.record_conversation_turn(
  conversation_uuid uuid,
  duration_ms bigint,
  source_characters integer,
  translated_characters integer,
  cost_microusd bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set
    turn_count = turn_count + 1,
    speech_duration_ms = speech_duration_ms + greatest(duration_ms, 0),
    source_character_count =
      source_character_count + greatest(source_characters, 0),
    translated_character_count =
      translated_character_count + greatest(translated_characters, 0),
    estimated_cost_microusd =
      estimated_cost_microusd + greatest(cost_microusd, 0)
  where id = conversation_uuid;
end;
$$;

create or replace function public.record_translation_failure(
  conversation_uuid uuid
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations
  set translation_failure_count = translation_failure_count + 1
  where id = conversation_uuid;
$$;

revoke all on function public.record_conversation_turn(
  uuid, bigint, integer, integer, bigint
) from public, anon, authenticated;

revoke all on function public.record_translation_failure(uuid)
  from public, anon, authenticated;

create or replace view public.school_usage_daily
with (security_invoker = true)
as
select
  school_id,
  created_at::date as usage_date,
  count(*) as conversations,
  count(*) filter (where invitation_sent_at is not null) as invitations_sent,
  count(*) filter (where parent_joined_at is not null) as parents_joined,
  round(
    100.0
    * count(*) filter (where parent_joined_at is not null)
    / nullif(count(*) filter (where invitation_sent_at is not null), 0),
    1
  ) as join_success_rate_percent,
  round(
    avg(
      extract(epoch from (ended_at - started_at))
    ) filter (where started_at is not null and ended_at is not null),
    1
  ) as average_session_seconds,
  round(avg(turn_count), 1) as average_turns,
  round(sum(speech_duration_ms)::numeric / 60000, 2) as speech_minutes,
  sum(translation_failure_count) as translation_failures,
  round(sum(estimated_cost_microusd)::numeric / 1000000, 4)
    as estimated_cost_usd,
  round(
    sum(estimated_cost_microusd)::numeric
    / nullif(count(*), 0)
    / 1000000,
    4
  ) as estimated_cost_per_conversation_usd
from public.conversations
group by school_id, created_at::date;

revoke all on public.school_usage_daily from public, anon, authenticated;

comment on view public.school_usage_daily is
  'Privacy-safe daily aggregates. No audio, transcript, student, or phone data.';
