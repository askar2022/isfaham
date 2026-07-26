alter table public.approved_teachers
  add column is_admin boolean not null default false;

alter table public.profiles
  add column is_admin boolean not null default false;

update public.profiles as profile
set is_admin = approved.is_admin
from public.approved_teachers as approved
where lower(profile.email) = lower(approved.email);

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

  insert into public.profiles (
    id,
    school_id,
    email,
    full_name,
    is_admin
  )
  values (
    new.id,
    approved.school_id,
    lower(new.email),
    coalesce(approved.full_name, new.raw_user_meta_data ->> 'full_name'),
    approved.is_admin
  )
  on conflict (id) do update
  set
    school_id = excluded.school_id,
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    is_admin = excluded.is_admin;

  return new;
end;
$$;

create or replace function public.sync_teacher_admin_access()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    full_name = coalesce(new.full_name, full_name),
    is_admin = new.is_admin
  where lower(email) = lower(new.email);

  return new;
end;
$$;

create trigger on_approved_teacher_updated
  after update of full_name, is_admin on public.approved_teachers
  for each row execute procedure public.sync_teacher_admin_access();

-- Bootstrap the first administrator after running this migration:
--
-- update public.approved_teachers
-- set is_admin = true
-- where email = 'your-email@school.org';
--
-- If that person already signed in before this migration, also run:
--
-- update public.profiles
-- set is_admin = true
-- where email = 'your-email@school.org';
