import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore
import webpush from 'npm:web-push'

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const pushEnabled  = !!(vapidPublic && vapidPrivate)

  if (pushEnabled) {
    webpush.setVapidDetails('mailto:admin@prodeegee.com', vapidPublic, vapidPrivate)
  }

  const today = new Date().toISOString().split('T')[0]

  // Find overdue tasks (past due date, not Done)
  const { data: overdueTasks, error } = await supabase
    .from('hub_tasks')
    .select('id, title, due_date, claimed_by, assigned_to')
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

  // Skip tasks already notified today
  const taskIds = overdueTasks.map(t => t.id)
  const { data: existing } = await supabase
    .from('notifications')
    .select('reference_id')
    .eq('type', 'task_overdue')
    .in('reference_id', taskIds)
    .gte('created_at', `${today}T00:00:00Z`)

  const alreadyNotified = new Set((existing || []).map((n: any) => n.reference_id))
  const newTasks = overdueTasks.filter(t => !alreadyNotified.has(t.id))

  if (!newTasks.length) {
    return new Response(JSON.stringify({ processed: overdueTasks.length, notified: 0, message: 'All already notified today' }))
  }

  // Build in-app notifications + map recipients to tasks for push
  const notifications: object[] = []
  const recipientTasks: Record<string, { title: string; dueDate: string }[]> = {}

  for (const task of newTasks) {
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
      if (!recipientTasks[userId]) recipientTasks[userId] = []
      recipientTasks[userId].push({ title: task.title, dueDate: task.due_date })
    }
  }

  if (notifications.length) {
    const { error: insertErr } = await supabase.from('notifications').insert(notifications)
    if (insertErr) console.error('[overdue-tasks] notification insert error:', insertErr.message)
  }

  // Send Web Push notifications
  let pushSent = 0
  if (pushEnabled && Object.keys(recipientTasks).length) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription, id')
      .in('user_id', Object.keys(recipientTasks))

    for (const sub of subs || []) {
      const tasks = recipientTasks[sub.user_id] || []
      const body = tasks.length === 1
        ? `"${tasks[0].title}" was due ${tasks[0].dueDate}`
        : `${tasks.length} tasks are overdue`

      try {
        await webpush.sendNotification(
          JSON.parse(sub.subscription),
          JSON.stringify({
            title: '⚠️ Overdue Task Reminder',
            body,
            url: 'https://hub.prodeegee.com',
            tag: `overdue-${sub.user_id}-${today}`,
          })
        )
        pushSent++
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          // Expired subscription — remove it
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          console.log('[push] removed expired subscription for', sub.user_id)
        } else {
          console.error('[push] send failed:', e.message)
        }
      }
    }
  }

  console.log(`[overdue-tasks] processed=${overdueTasks.length} notified=${newTasks.length} push_sent=${pushSent}`)
  return new Response(
    JSON.stringify({
      processed: overdueTasks.length,
      notified: newTasks.length,
      notifications_sent: notifications.length,
      push_sent: pushSent,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
