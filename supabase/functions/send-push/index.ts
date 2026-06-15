import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore
import webpush from 'npm:web-push'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS })
  }

  // Verify auth token
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Validate caller is authenticated
  const token = authHeader.slice(7)
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS })
  }

  const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')

  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: 'Push not configured' }), {
      status: 503,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  webpush.setVapidDetails('mailto:admin@prodeegee.com', vapidPublic, vapidPrivate)

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('Bad request', { status: 400, headers: CORS })
  }

  const { user_id, title, body: msgBody, url } = body
  const userIds: string[] = Array.isArray(user_id) ? user_id : [user_id]

  if (!userIds.length || !title) {
    return new Response(JSON.stringify({ error: 'user_id and title are required' }), {
      status: 400,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // Fetch push subscriptions for target users
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, subscription')
    .in('user_id', userIds)

  if (subsErr) {
    return new Response(JSON.stringify({ error: subsErr.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0
  let failed = 0
  const expiredIds: string[] = []

  for (const sub of subs || []) {
    try {
      const subObj = typeof sub.subscription === 'string' ? JSON.parse(sub.subscription) : sub.subscription
      await webpush.sendNotification(
        subObj,
        JSON.stringify({
          title,
          body: msgBody || '',
          url: url || 'https://hub.prodeegee.com',
          tag: `hub-${Date.now()}`,
        })
      )
      sent++
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        expiredIds.push(sub.id)
      } else {
        console.error('[send-push] failed for', sub.user_id, e.message)
        failed++
      }
    }
  }

  // Clean up expired subscriptions
  if (expiredIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', expiredIds)
    console.log('[send-push] removed', expiredIds.length, 'expired subscriptions')
  }

  return new Response(
    JSON.stringify({ sent, failed, expired_removed: expiredIds.length }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
