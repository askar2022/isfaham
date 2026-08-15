-- School one-way English → Somali voice messages to parents.

create table if not exists public.voice_messages (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null unique default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  sender_email text not null,
  parent_phone_e164 text not null,
  parent_phone_last_four text not null,
  status text not null default 'draft'
    check (status in ('draft', 'ready', 'sent', 'failed', 'expired', 'deleted')),
  english_text text,
  somali_text text,
  somali_audio_base64 text,
  delivery_status text
    check (delivery_status is null or delivery_status in ('pending', 'sent', 'failed', 'manual')),
  link_opened_at timestamptz,
  audio_played_at timestamptz,
  sms_sid text,
  expires_at timestamptz not null default (now() + interval '30 days'),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_messages_school_created_idx
  on public.voice_messages (school_id, created_at desc);

create index if not exists voice_messages_sender_created_idx
  on public.voice_messages (sender_user_id, created_at desc);

create index if not exists voice_messages_token_idx
  on public.voice_messages (public_token);

alter table public.voice_messages enable row level security;

revoke all on table public.voice_messages from anon, authenticated;

-- Staff read their own school's history through server APIs (service role).
-- No direct client policies for anonymous/authenticated writes.
