create table public.credit_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_seconds bigint not null default 120 check (balance_seconds >= 0),
  purchased_seconds bigint not null default 0 check (purchased_seconds >= 0),
  used_seconds bigint not null default 0 check (used_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('trial', 'purchase', 'usage', 'refund')),
  seconds_delta bigint not null check (seconds_delta <> 0),
  amount_cents integer check (amount_cents is null or amount_cents >= 0),
  provider text,
  provider_transaction_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_transaction_id)
);

create index credit_transactions_user_created_idx
  on public.credit_transactions (user_id, created_at desc);

alter table public.credit_wallets enable row level security;
alter table public.credit_transactions enable row level security;

create policy "Users can read their credit wallet"
  on public.credit_wallets for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can read their credit transactions"
  on public.credit_transactions for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.handle_new_credit_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.credit_wallets (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (
    user_id,
    kind,
    seconds_delta,
    provider,
    provider_transaction_id
  )
  values (
    new.id,
    'trial',
    120,
    'isfaham',
    'trial:' || new.id::text
  )
  on conflict (provider, provider_transaction_id) do nothing;

  return new;
end;
$$;

create trigger on_user_credit_wallet_created
  after insert on auth.users
  for each row execute procedure public.handle_new_credit_wallet();

insert into public.credit_wallets (user_id)
select id from auth.users
on conflict (user_id) do nothing;

insert into public.credit_transactions (
  user_id,
  kind,
  seconds_delta,
  provider,
  provider_transaction_id
)
select
  id,
  'trial',
  120,
  'isfaham',
  'trial:' || id::text
from auth.users
on conflict (provider, provider_transaction_id) do nothing;

create or replace function public.apply_credit_purchase(
  account_user_id uuid,
  purchased_credit_seconds bigint,
  stripe_transaction_id text,
  paid_amount_cents integer,
  purchase_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if purchased_credit_seconds <= 0 or paid_amount_cents < 0 then
    raise exception 'Invalid credit purchase';
  end if;

  insert into public.credit_transactions (
    user_id,
    kind,
    seconds_delta,
    amount_cents,
    provider,
    provider_transaction_id,
    metadata
  )
  values (
    account_user_id,
    'purchase',
    purchased_credit_seconds,
    paid_amount_cents,
    'stripe',
    stripe_transaction_id,
    purchase_metadata
  )
  on conflict (provider, provider_transaction_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return false;
  end if;

  update public.credit_wallets
  set
    balance_seconds = balance_seconds + purchased_credit_seconds,
    purchased_seconds = purchased_seconds + purchased_credit_seconds,
    updated_at = now()
  where user_id = account_user_id;

  return true;
end;
$$;

create or replace function public.reserve_translation_credit(
  account_user_id uuid,
  reserved_seconds bigint,
  reservation_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if reserved_seconds <= 0 then
    return false;
  end if;

  update public.credit_wallets
  set
    balance_seconds = balance_seconds - reserved_seconds,
    used_seconds = used_seconds + reserved_seconds,
    updated_at = now()
  where user_id = account_user_id
    and balance_seconds >= reserved_seconds;

  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    return false;
  end if;

  insert into public.credit_transactions (
    user_id,
    kind,
    seconds_delta,
    provider,
    provider_transaction_id
  )
  values (
    account_user_id,
    'usage',
    -reserved_seconds,
    'isfaham',
    reservation_id
  );

  return true;
end;
$$;

create or replace function public.refund_translation_credit(
  account_user_id uuid,
  refunded_seconds bigint,
  reservation_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
begin
  if refunded_seconds <= 0 then
    return false;
  end if;

  insert into public.credit_transactions (
    user_id,
    kind,
    seconds_delta,
    provider,
    provider_transaction_id
  )
  values (
    account_user_id,
    'refund',
    refunded_seconds,
    'isfaham',
    reservation_id || ':refund'
  )
  on conflict (provider, provider_transaction_id) do nothing;

  get diagnostics inserted_count = row_count;
  if inserted_count = 0 then
    return false;
  end if;

  update public.credit_wallets
  set
    balance_seconds = balance_seconds + refunded_seconds,
    used_seconds = greatest(used_seconds - refunded_seconds, 0),
    updated_at = now()
  where user_id = account_user_id;

  return true;
end;
$$;

-- Unapproved email users are consumers, not staff. Staff approval is
-- still enforced by the OTP request API before a profile is created.
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
    return new;
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

revoke all on function public.handle_new_credit_wallet()
  from public, anon, authenticated;

revoke all on function public.apply_credit_purchase(
  uuid, bigint, text, integer, jsonb
) from public, anon, authenticated;
revoke all on function public.reserve_translation_credit(
  uuid, bigint, text
) from public, anon, authenticated;

revoke all on function public.refund_translation_credit(
  uuid, bigint, text
) from public, anon, authenticated;

revoke all on function public.handle_new_teacher()
  from public, anon, authenticated;
