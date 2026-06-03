-- Run this in Supabase SQL Editor if push_subscriptions table doesn't exist yet

create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  subscription jsonb not null,
  device_hint  text,
  updated_at   timestamptz default now(),
  unique(user_id, subscription)
);

alter table push_subscriptions enable row level security;

create policy "users manage own push subscriptions"
  on push_subscriptions for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
