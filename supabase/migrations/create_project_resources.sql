-- Run this in your Supabase SQL editor for project twpkuntxvlkuqjmyfjlf

-- 1. Project resources table
create table if not exists project_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references hub_projects(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint not null default 0,
  mime_type text not null default '',
  resource_type text not null default 'other',
  uploaded_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table project_resources enable row level security;

create policy "project members can view resources"
  on project_resources for select
  using (
    exists (
      select 1 from hub_project_members
      where hub_project_members.project_id = project_resources.project_id
        and hub_project_members.user_id = auth.uid()
    )
  );

create policy "project members can insert resources"
  on project_resources for insert
  with check (
    exists (
      select 1 from hub_project_members
      where hub_project_members.project_id = project_resources.project_id
        and hub_project_members.user_id = auth.uid()
    )
  );

create policy "uploader or lead can delete resources"
  on project_resources for delete
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from hub_project_members
      where hub_project_members.project_id = project_resources.project_id
        and hub_project_members.user_id = auth.uid()
        and hub_project_members.role = 'lead'
    )
  );

-- 2. Storage bucket (run separately in Storage dashboard or via SQL)
insert into storage.buckets (id, name, public)
  values ('project-resources', 'project-resources', false)
  on conflict (id) do nothing;

create policy "authenticated can upload project resources"
  on storage.objects for insert
  with check (bucket_id = 'project-resources' and auth.role() = 'authenticated');

create policy "authenticated can read project resources"
  on storage.objects for select
  using (bucket_id = 'project-resources' and auth.role() = 'authenticated');

create policy "authenticated can delete project resources"
  on storage.objects for delete
  using (bucket_id = 'project-resources' and auth.role() = 'authenticated');
