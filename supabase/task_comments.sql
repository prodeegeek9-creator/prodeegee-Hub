-- Task comments table
-- Run in Supabase SQL Editor

create table if not exists task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references hub_tasks(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);

alter table task_comments enable row level security;

create policy "authenticated can view task comments"
  on task_comments for select to authenticated using (true);

create policy "authenticated can add task comments"
  on task_comments for insert to authenticated with check (auth.uid() = user_id);

create policy "creator or admin can delete task comments"
  on task_comments for delete to authenticated using (auth.uid() = user_id);
