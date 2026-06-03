import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const today = new Date().toISOString().split('T')[0]

  // Tasks past due date that aren't Done
  const { data: overdueTasks, error } = await supabase
    .from('hub_tasks')
    .select('id, title, due_date, claimed_by, assigned_to, team_id')
    .lt('due_date', today)
    .not('status', 'eq', 'Done')
    .not('due_date', 'is', null)

  if (error) {
    console.error('[overdue-tasks] fetch error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!overdueTasks?.length) {
    return new Response(JSON.stringify({ processed: 0, message: 'No overdue tasks' }))
  }

  // Avoid duplicate notifications — check what was already sent today
  const taskIds = overdueTasks.map(t => t.id)
  const { data: existing } = await supabase
    .from('notifications')
    .select('reference_id')
    .eq('type', 'task_overdue')
    .in('reference_id', taskIds)
    .gte('created_at', `${today}T00:00:00Z`)

  const alreadyNotified = new Set((existing || []).map(n => n.reference_id))

  // Build notifications for unclaimed + claimed users
  const notifications: object[] = []
  for (const task of overdueTasks) {
    if (alreadyNotified.has(task.id)) continue
    const recipients = new Set<string>()
    if (task.claimed_by) recipients.add(task.claimed_by)
    if (task.assigned_to && task.assigned_to !== task.claimed_by) recipients.add(task.assigned_to)
    for (const userId of recipients) {
      notifications.push({
        user_id: userId,
        type: 'task_overdue',
        message: `⚠️ Task "${task.title}" is overdue (was due ${task.due_date})`,
        reference_id: task.id,
      })
    }
  }

  if (notifications.length) {
    const { error: insertErr } = await supabase.from('notifications').insert(notifications)
    if (insertErr) console.error('[overdue-tasks] insert error:', insertErr.message)
  }

  console.log(`[overdue-tasks] processed ${overdueTasks.length} tasks, sent ${notifications.length} notifications`)
  return new Response(
    JSON.stringify({ processed: overdueTasks.length, notifications_sent: notifications.length }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
