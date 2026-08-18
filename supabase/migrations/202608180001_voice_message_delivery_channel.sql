-- Track whether a parent message was sent by SMS or WhatsApp.

alter table public.voice_messages
  add column if not exists delivery_channel text
    check (
      delivery_channel is null
      or delivery_channel in ('sms', 'whatsapp')
    );
