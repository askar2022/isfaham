alter table public.conversations
  alter column teacher_id drop not null,
  alter column school_id drop not null,
  add column host_user_id uuid references auth.users(id) on delete cascade,
  add column conversation_type text not null default 'school'
    check (conversation_type in ('school', 'consumer'));

alter table public.conversations
  add constraint conversations_owner_check check (
    (
      conversation_type = 'school'
      and teacher_id is not null
      and school_id is not null
      and host_user_id is null
    )
    or
    (
      conversation_type = 'consumer'
      and teacher_id is null
      and school_id is null
      and host_user_id is not null
    )
  );

create index conversations_host_created_idx
  on public.conversations (host_user_id, created_at desc)
  where host_user_id is not null;

create policy "Consumers can read their hosted conversations"
  on public.conversations for select
  to authenticated
  using (host_user_id = auth.uid());

create policy "Consumers can read hosted conversation messages"
  on public.conversation_messages for select
  to authenticated
  using (
    conversation_id in (
      select id
      from public.conversations
      where host_user_id = auth.uid()
    )
  );
