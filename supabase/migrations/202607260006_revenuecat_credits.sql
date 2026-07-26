create or replace function public.apply_revenuecat_credit_purchase(
  account_user_id uuid,
  purchased_credit_seconds bigint,
  revenuecat_transaction_id text,
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
    'revenuecat',
    revenuecat_transaction_id,
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

revoke all on function public.apply_revenuecat_credit_purchase(
  uuid, bigint, text, integer, jsonb
) from public, anon, authenticated;
