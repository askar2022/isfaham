create extension if not exists pgcrypto;

create type public.conversation_status as enum ('waiting', 'active', 'ended');
create type public.conversation_speaker as enum ('teacher', 'parent');
create type public.language_code as enum ('so', 'en');

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.approved_teachers (
  email text primary key check (email = lower(email)),
  school_id uuid not null references public.schools(id) on delete cascade,
  full_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null unique default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  status public.conversation_status not null default 'waiting',
  parent_language public.language_code not null default 'so',
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  twilio_session_sid text,
  parent_phone_last_four text,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  speaker public.conversation_speaker not null,
  source_language public.language_code not null,
  target_language public.language_code not null,
  original_text text not null check (char_length(original_text) <= 5000),
  translated_text text not null check (char_length(translated_text) <= 5000),
  created_at timestamptz not null default now()
);

create index conversations_teacher_created_idx
  on public.conversations (teacher_id, created_at desc);

create index conversation_messages_conversation_created_idx
  on public.conversation_messages (conversation_id, created_at);

alter table public.schools enable row level security;
alter table public.approved_teachers enable row level security;
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create policy "Teachers can read their school"
  on public.schools for select
  to authenticated
  using (
    id in (
      select school_id from public.profiles where id = auth.uid()
    )
  );

create policy "Teachers can read their own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Teachers can read their conversations"
  on public.conversations for select
  to authenticated
  using (teacher_id = auth.uid());

create policy "Teachers can create conversations"
  on public.conversations for insert
  to authenticated
  with check (
    teacher_id = auth.uid()
    and school_id in (
      select school_id from public.profiles where id = auth.uid()
    )
  );

create policy "Teachers can update their conversations"
  on public.conversations for update
  to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Teachers can read conversation messages"
  on public.conversation_messages for select
  to authenticated
  using (
    conversation_id in (
      select id
      from public.conversations
      where teacher_id = auth.uid()
    )
  );

create or replace function public.handle_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  approved public.approved_teachers;
begin
  select *
  into approved
  from public.approved_teachers
  where email = lower(new.email)
    and is_active = true;

  if approved.email is null then
    raise exception 'Email is not approved for Isfaham';
  end if;

  insert into public.profiles (id, school_id, email, full_name)
  values (
    new.id,
    approved.school_id,
    lower(new.email),
    coalesce(approved.full_name, new.raw_user_meta_data ->> 'full_name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_teacher_created
  after insert on auth.users
  for each row execute procedure public.handle_new_teacher();

-- Add a school and the first approved teacher before testing:
--
-- insert into public.schools (name) values ('Example School') returning id;
-- insert into public.approved_teachers (email, school_id, full_name)
-- values ('teacher@example.org', 'SCHOOL_UUID_HERE', 'Teacher Name');
