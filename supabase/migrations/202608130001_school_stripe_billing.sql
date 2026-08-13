-- School Stripe subscription billing fields.
-- Legacy pilot schools keep subscription_status null and remain usable.

alter table public.schools
  add column if not exists billing_email text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_updated_at timestamptz;

create unique index if not exists schools_stripe_customer_id_uidx
  on public.schools (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists schools_stripe_subscription_id_uidx
  on public.schools (stripe_subscription_id)
  where stripe_subscription_id is not null;

create unique index if not exists schools_stripe_checkout_session_id_uidx
  on public.schools (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;
