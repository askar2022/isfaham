-- Production security hardening:
-- - persistent API rate limits for server routes
-- - immediate enforcement for blocked users and inactive school staff
-- - least-privilege conversation mutations and privileged RPC execution

create table public.api_rate_limits (
  limit_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from public, anon, authenticated;

create or replace function public.consume_api_rate_limit(
  requested_key text,
  maximum_requests integer,
  window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  current_count integer;
begin
  if
    requested_key is null
    or char_length(requested_key) < 3
    or char_length(requested_key) > 200
    or maximum_requests < 1
    or window_seconds < 1
  then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext(requested_key));

  select window_started_at, request_count
  into current_window, current_count
  from public.api_rate_limits
  where limit_key = requested_key
  for update;

  if not found then
    insert into public.api_rate_limits (
      limit_key,
      window_started_at,
      request_count,
      updated_at
    )
    values (requested_key, now(), 1, now());
    return true;
  end if;

  if current_window <= now() - make_interval(secs => window_seconds) then
    update public.api_rate_limits
    set window_started_at = now(), request_count = 1, updated_at = now()
    where limit_key = requested_key;
    return true;
  end if;

  if current_count >= maximum_requests then
    return false;
  end if;

  update public.api_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where limit_key = requested_key;
  return true;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

create table public.trial_device_claims (
  device_hash text primary key,
  user_id uuid not null unique,
  claimed_at timestamptz not null default now()
);

alter table public.trial_device_claims enable row level security;
revoke all on table public.trial_device_claims from public, anon, authenticated;

create or replace function public.claim_trial_device(
  requested_device_hash text,
  requested_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if
    requested_device_hash is null
    or char_length(requested_device_hash) <> 64
    or requested_user_id is null
  then
    return false;
  end if;

  insert into public.trial_device_claims (device_hash, user_id)
  values (requested_device_hash, requested_user_id)
  on conflict do nothing;

  return exists (
    select 1
    from public.trial_device_claims
    where device_hash = requested_device_hash
      and user_id = requested_user_id
  );
end;
$$;

revoke all on function public.claim_trial_device(text, uuid)
  from public, anon, authenticated;
grant execute on function public.claim_trial_device(text, uuid)
  to service_role;

create table public.user_access_blocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default 'administrative',
  blocked_at timestamptz not null default now()
);

alter table public.user_access_blocks enable row level security;
revoke all on table public.user_access_blocks from public, anon, authenticated;

insert into public.user_access_blocks (user_id, reason)
select id, 'supabase_auth_ban'
from auth.users
where banned_until is not null and banned_until > now()
on conflict (user_id) do nothing;

insert into public.user_access_blocks (user_id, reason)
select auth_user.id, 'inactive_school_access'
from auth.users as auth_user
join public.approved_teachers as approved
  on approved.email = lower(auth_user.email)
where approved.is_active = false
on conflict (user_id) do nothing;

update public.profiles as profile
set is_admin = false
from public.approved_teachers as approved
where approved.email = lower(profile.email)
  and approved.is_active = false;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.approved_teachers as approved
      on approved.email = lower(profile.email)
    where profile.id = auth.uid()
      and approved.school_id = profile.school_id
      and approved.is_active = true
  );
$$;

revoke all on function public.is_active_staff()
  from public, anon, authenticated;
grant execute on function public.is_active_staff() to authenticated;

drop policy if exists "Teachers can read their school" on public.schools;
create policy "Active teachers can read their school"
  on public.schools for select
  to authenticated
  using (
    public.is_active_staff()
    and id in (
      select school_id from public.profiles where id = auth.uid()
    )
  );

drop policy if exists "Teachers can read their own profile" on public.profiles;
create policy "Active teachers can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() and public.is_active_staff());

drop policy if exists "Teachers can read their conversations"
  on public.conversations;
create policy "Active teachers can read their conversations"
  on public.conversations for select
  to authenticated
  using (teacher_id = auth.uid() and public.is_active_staff());

-- Conversation writes are performed by authenticated server routes with the
-- service role. Removing direct client mutations prevents analytics, expiry,
-- Twilio identifiers, and lifecycle fields from being tampered with.
drop policy if exists "Teachers can create conversations"
  on public.conversations;
drop policy if exists "Teachers can update their conversations"
  on public.conversations;

drop policy if exists "Teachers can read conversation messages"
  on public.conversation_messages;
create policy "Active teachers can read conversation messages"
  on public.conversation_messages for select
  to authenticated
  using (
    public.is_active_staff()
    and conversation_id in (
      select id
      from public.conversations
      where teacher_id = auth.uid()
    )
  );

revoke all on table public.approved_teachers from anon, authenticated;

create or replace function public.sync_approved_teacher_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not new.is_active then
    update public.profiles
    set is_admin = false
    where lower(email) = lower(new.email);
    return new;
  end if;

  insert into public.profiles (id, school_id, email, full_name, is_admin)
  select
    auth_user.id,
    new.school_id,
    lower(new.email),
    coalesce(new.full_name, auth_user.raw_user_meta_data ->> 'full_name'),
    new.is_admin
  from auth.users as auth_user
  where lower(auth_user.email) = lower(new.email)
  on conflict (id) do update
  set
    school_id = excluded.school_id,
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    is_admin = excluded.is_admin;

  return new;
end;
$$;

revoke all on function public.sync_approved_teacher_profile()
  from public, anon, authenticated;

-- Defense in depth: these functions are server/trigger-only. Explicit service
-- grants prevent accidental exposure through a future default grant change.
-- Missing functions are skipped so this migration stays runnable against a
-- database where an earlier migration has not been applied yet.
do $$
declare
  signature text;
  target regprocedure;
begin
  foreach signature in array array[
    'public.record_conversation_turn(uuid, bigint, integer, integer, bigint)',
    'public.record_translation_failure(uuid)',
    'public.apply_credit_purchase(uuid, bigint, text, integer, jsonb)',
    'public.apply_revenuecat_credit_purchase(uuid, bigint, text, integer, jsonb)',
    'public.reserve_translation_credit(uuid, bigint, text)',
    'public.refund_translation_credit(uuid, bigint, text)'
  ]
  loop
    target := to_regprocedure(signature);
    if target is null then
      raise warning 'Skipped grant for missing function: %', signature;
      continue;
    end if;
    execute format('grant execute on function %s to service_role', target);
  end loop;
end;
$$;

-- Keep the limiter table bounded without requiring an extension or scheduler.
create index api_rate_limits_updated_idx
  on public.api_rate_limits (updated_at);
