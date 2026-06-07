-- Add notification_email to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_email TEXT DEFAULT NULL;

-- Add task body type columns to hub_tasks (if not already added)
ALTER TABLE hub_tasks
  ADD COLUMN IF NOT EXISTS task_body_type TEXT DEFAULT 'text'
    CHECK (task_body_type IN ('text', 'code')),
  ADD COLUMN IF NOT EXISTS code_language TEXT DEFAULT NULL;
