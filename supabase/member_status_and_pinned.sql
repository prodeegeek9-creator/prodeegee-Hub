-- Member availability status + pinned messages
-- Run in Supabase SQL Editor

-- Add availability_status to profiles
alter table profiles
  add column if not exists availability_status text default 'active'
    check (availability_status in ('active','busy','meeting','leave'));

-- Add is_pinned to chat_messages
alter table chat_messages
  add column if not exists is_pinned boolean default false;

create index if not exists idx_chat_messages_pinned
  on chat_messages(channel_id, is_pinned)
  where is_pinned = true;
