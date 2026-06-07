-- Add notification_email to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_email TEXT DEFAULT NULL;

-- Add task body type columns to hub_tasks (if not already added)
ALTER TABLE hub_tasks
  ADD COLUMN IF NOT EXISTS task_body_type TEXT DEFAULT 'text'
    CHECK (task_body_type IN ('text', 'code')),
  ADD COLUMN IF NOT EXISTS code_language TEXT DEFAULT NULL;

-- Allow null/update for notification_email via RLS (profiles table)
-- Users can update their own notification_email
CREATE POLICY IF NOT EXISTS "Users can update own notification_email"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
