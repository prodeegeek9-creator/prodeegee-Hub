-- Run this in Supabase Dashboard > SQL Editor
-- ─────────────────────────────────────────────

-- 1. Table
create table if not exists task_attachments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references hub_tasks(id) on delete cascade,
  file_name   text not null,
  file_path   text not null,
  file_size   bigint,
  mime_type   text,
  uploaded_by uuid references profiles(id) on delete set null,
  created_at  timestamptz default now()
);

-- 2. Row-level security
alter table task_attachments enable row level security;

-- Team members of the task's team can view attachments
create policy "team members can view attachments"
  on task_attachments for select
  using (
    exists (
      select 1 from hub_tasks ht
      join hub_team_members htm on htm.team_id = ht.team_id
      where ht.id = task_attachments.task_id
        and htm.user_id = auth.uid()
    )
    or
    -- Cross-team: origin team members can also view
    exists (
      select 1 from hub_tasks ht
      join hub_team_members htm on htm.team_id = ht.assigned_by_team
      where ht.id = task_attachments.task_id
        and htm.user_id = auth.uid()
    )
  );

-- Any authenticated user who is on the task's team can attach files
create policy "team members can insert attachments"
  on task_attachments for insert
  with check (auth.uid() = uploaded_by);

-- Only uploader can delete their attachment
create policy "uploader can delete attachment"
  on task_attachments for delete
  using (auth.uid() = uploaded_by);


-- ─────────────────────────────────────────────
-- 3. Storage bucket (do in Dashboard OR via SQL)
--
-- Dashboard: Storage > New bucket
--   Name:        task-attachments
--   Public:      NO (private)
--   File limit:  10485760  (10 MB)
--
-- Then add these storage policies (Dashboard > Storage > task-attachments > Policies):
--
-- Policy 1 — authenticated users can upload:
insert into storage.policies (name, bucket_id, operation, definition)
values (
  'authenticated upload',
  'task-attachments',
  'INSERT',
  'auth.role() = ''authenticated'''
) on conflict do nothing;
--
-- Policy 2 — authenticated users can download:
insert into storage.policies (name, bucket_id, operation, definition)
values (
  'authenticated download',
  'task-attachments',
  'SELECT',
  'auth.role() = ''authenticated'''
) on conflict do nothing;
