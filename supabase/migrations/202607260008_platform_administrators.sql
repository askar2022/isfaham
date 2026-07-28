create table public.platform_administrators (
  email text primary key check (email = lower(email)),
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.platform_administrators enable row level security;

revoke all on table public.platform_administrators from anon, authenticated;

comment on table public.platform_administrators is
  'Isfaham-wide administrators who may manage Personal users and guest metrics. This is separate from school administrators.';

-- If a registered Personal email is later approved by a school, attach the
-- existing auth account to that school immediately so it cannot appear in both
-- Personal and School Staff management.
create or replace function public.sync_approved_teacher_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not new.is_active then
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

drop trigger if exists on_approved_teacher_profile_sync
  on public.approved_teachers;

create trigger on_approved_teacher_profile_sync
  after insert or update of school_id, full_name, is_active, is_admin
  on public.approved_teachers
  for each row execute procedure public.sync_approved_teacher_profile();

insert into public.profiles (id, school_id, email, full_name, is_admin)
select
  auth_user.id,
  approved.school_id,
  lower(approved.email),
  coalesce(approved.full_name, auth_user.raw_user_meta_data ->> 'full_name'),
  approved.is_admin
from public.approved_teachers as approved
join auth.users as auth_user
  on lower(auth_user.email) = lower(approved.email)
where approved.is_active = true
on conflict (id) do update
set
  school_id = excluded.school_id,
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.profiles.full_name),
  is_admin = excluded.is_admin;

revoke all on function public.sync_approved_teacher_profile()
  from public, anon, authenticated;

-- Bootstrap an Isfaham platform administrator with the verified email used to
-- sign in to the existing admin portal:
--
-- insert into public.platform_administrators (email, full_name)
-- values ('owner@example.com', 'Platform owner')
-- on conflict (email) do update set full_name = excluded.full_name;
