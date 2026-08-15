-- Keep is_active_staff callable only from authenticated RLS evaluation.
-- Revoke any broader grants that may have been restored accidentally.
revoke all on function public.is_active_staff()
  from public, anon;
grant execute on function public.is_active_staff() to authenticated;

-- Credit/wallet write RPCs must stay service-role only.
do $$
declare
  target regprocedure;
begin
  foreach target in array array[
    'public.apply_credit_purchase(uuid, bigint, text, integer, jsonb)',
    'public.apply_revenuecat_credit_purchase(uuid, bigint, text, integer, jsonb)',
    'public.reserve_translation_credit(uuid, bigint, text)',
    'public.refund_translation_credit(uuid, bigint, text)',
    'public.consume_api_rate_limit(text, integer, integer)',
    'public.claim_trial_device(text, uuid)'
  ]
  loop
    if to_regprocedure(target::text) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', target);
      execute format('grant execute on function %s to service_role', target);
    end if;
  end loop;
end
$$;
