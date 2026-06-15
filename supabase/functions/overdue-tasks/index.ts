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

  const now = new Date()
  const today     = now.toISOString().split('T')[0]
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
  const twoDaysAgo = new Date(now.getTime() - 2 * 86400000).toISOString().split('T')[0]

  // ── 1. Auto-drop tasks that are 2+ days overdue and still claimed ──────────
  const { data: dropTasks } = await supabase
    .from('hub_tasks')
    .select('id, title, due_date, claimed_by, assigned_to, team_id')
    .lte('due_date', twoDaysAgo)
    .not('status', 'eq', 'Done')
    .not('due_date', 'is', null)
    .not('claimed_by', 'is', null)

  let droppedCount = 0
  const droppedUserIds: string[] = []

  for (const task of dropTasks || []) {
    const { error } = await supabase
      .from('hub_tasks')
      .update({ claimed_by: null, claimed_at: null, status: 'Queue' })
      .eq('id', task.id)

    if (error) {
      console.error('[overdue-tasks] drop error for', task.id, error.message)
      continue
    }

    droppedCount++

    // Activity log
    await supabase.from('task_activity').insert({
      task_id: task.id,
      user_id: task.claimed_by,
      action: 'dropped',
      note: `Task auto-dropped: "${task.title}" was overdue by 2+ days`,
    })

    // In-app notification to the person who was holding it
    await supabase.from('notifications').insert({
      user_id: task.claimed_by,
      type: 'task_overdue',
      message: `⛔ Task "${task.title}" was auto-dropped — it was overdue and has been returned to the queue.`,
      reference_id: task.id,
    })

    // Notify team members that the task is available again
    const { data: teamMembers } = await supabase
      .from('hub_team_members')
      .select('user_id')
      .eq('team_id', task.team_id)

    const teamIds = (teamMembers || [])
      .map((m: any) => m.user_id)
      .filter((id: string) => id !== task.claimed_by)

    if (teamIds.length) {
      const notifs = teamIds.map((uid: string) => ({
        user_id: uid,
        type: 'project_update',
        message: `📋 "${task.title}" is back in the queue — it was overdue and auto-dropped.`,
        reference_id: task.id,
      }))
      await supabase.from('notifications').insert(notifs)
    }

    if (task.claimed_by) droppedUserIds.push(task.claimed_by)
  }

  // ── 2. Send push for auto-dropped tasks ───────────────────────────────────
  if (pushEnabled && droppedUserIds.length) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription, id')
      .in('user_id', droppedUserIds)

    for (const sub of subs || []) {
      try {
        await webpush.sendNotification(
          JSON.parse(sub.subscription),
          JSON.stringify({
            title: '⛔ Task Auto-Dropped',
            body: 'A task you held was overdue by 2+ days and has been returned to the queue.',
            url: 'https://hub.prodeegee.com',
            tag: `auto-drop-${sub.user_id}-${today}`,
          })
        )
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        }
      }
    }
  }

  // ── 3. Warn users whose tasks are exactly 1 day overdue ───────────────────
  const { data: warnTasks, error: warnErr } = await supabase
    .from('hub_tasks')
    .select('id, title, due_date, claimed_by, assigned_to')
    .eq('due_date', yesterday)
    .not('status', 'eq', 'Done')
    .not('due_date', 'is', null)

  if (warnErr) {
    console.error('[overdue-tasks] warn fetch error:', warnErr.message)
  }

  // Skip tasks already warned today
  const warnTaskIds = (warnTasks || []).map((t: any) => t.id)
  let alreadyWarned = new Set<string>()

  if (warnTaskIds.length) {
    const { data: existing } = await supabase
      .from('notifications')
      .select('reference_id')
      .eq('type', 'task_overdue')
      .in('reference_id', warnTaskIds)
      .gte('created_at', `${today}T00:00:00Z`)

    alreadyWarned = new Set((existing || []).map((n: any) => n.reference_id))
  }

  const newWarnTasks = (warnTasks || []).filter((t: any) => !alreadyWarned.has(t.id))

  const notifications: object[] = []
  const recipientTasks: Record<string, { title: string; dueDate: string }[]> = {}

  for (const task of newWarnTasks) {
    const recipients = new Set<string>()
    if (task.claimed_by) recipients.add(task.claimed_by)
    if (task.assigned_to && task.assigned_to !== task.claimed_by) recipients.add(task.assigned_to)

    for (const userId of recipients) {
      notifications.push({
        user_id: userId,
        type: 'task_overdue',
        message: `⚠️ Task "${task.title}" is overdue. It will be auto-dropped tomorrow if not completed.`,
        reference_id: task.id,
      })
      if (!recipientTasks[userId]) recipientTasks[userId] = []
      recipientTasks[userId].push({ title: task.title, dueDate: task.due_date })
    }
  }

  if (notifications.length) {
    const { error: insertErr } = await supabase.from('notifications').insert(notifications)
    if (insertErr) console.error('[overdue-tasks] warning insert error:', insertErr.message)
  }

  // ── 4. Send push warnings ─────────────────────────────────────────────────
  let pushSent = 0
  if (pushEnabled && Object.keys(recipientTasks).length) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription, id')
      .in('user_id', Object.keys(recipientTasks))

    for (const sub of subs || []) {
      const tasks = recipientTasks[sub.user_id] || []
      const body = tasks.length === 1
        ? `"${tasks[0].title}" is overdue — it will be auto-dropped tomorrow`
        : `${tasks.length} tasks are overdue and will be auto-dropped tomorrow`

      try {
        await webpush.sendNotification(
          JSON.parse(sub.subscription),
          JSON.stringify({
            title: '⚠️ Task Due Date Warning',
            body,
            url: 'https://hub.prodeegee.com',
            tag: `overdue-warn-${sub.user_id}-${today}`,
          })
        )
        pushSent++
      } catch (e: any) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id)
          console.log('[push] removed expired subscription for', sub.user_id)
        } else {
          console.error('[push] send failed:', e.message)
        }
      }
    }
  }

  console.log(`[overdue-tasks] dropped=${droppedCount} warned=${newWarnTasks.length} push_sent=${pushSent}`)
  return new Response(
    JSON.stringify({
      auto_dropped: droppedCount,
      warned: newWarnTasks.length,
      notifications_sent: notifications.length,
      push_sent: pushSent,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
