-- message_likes table
-- Run in Supabase SQL Editor

create table if not exists message_likes (
  id         uuid primary key default gen_random_uuid(),
  message_id uuid not null references chat_messages(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(message_id, user_id)
);

alter table message_likes enable row level security;

create policy "authenticated can view likes"
  on message_likes for select to authenticated using (true);

create policy "authenticated can like"
  on message_likes for insert to authenticated with check (auth.uid() = user_id);

create policy "user can unlike"
  on message_likes for delete to authenticated using (auth.uid() = user_id);
