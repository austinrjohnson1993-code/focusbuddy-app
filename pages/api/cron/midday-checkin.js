import { createClient } from '@supabase/supabase-js'
import { buildPersonaPrompt } from '../../../lib/persona'
import { coachingMessage } from '../../../lib/anthropic'
const { sendPushToUsers } = require('../../../lib/push')

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function fmtTask(t) {
  let s = `"${t.title}"`
  if ((t.rollover_count || 0) > 0) s += ` [rolled ${t.rollover_count}×]`
  if (t.due_time) s += ` [due ${new Date(t.due_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}]`
  if (t.consequence_level === 'external') s += ' [external]'
  return s
}

function topTask(pending) {
  return pending.find(t => t.consequence_level === 'external' || t.due_time)
    || pending.find(t => (t.rollover_count || 0) > 0)
    || pending[0]
    || null
}

// Called daily at 17:00 UTC (midday US Central) by Vercel cron
export default async function handler(req, res) {
  const authHeader = req.headers.authorization
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseAdmin = getAdminClient()

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .contains('checkin_times', ['midday'])

  if (!profiles || profiles.length === 0) {
    return res.status(200).json({ success: true, pregenerated: 0 })
  }

  let pregenerated = 0

  await Promise.allSettled(profiles.map(async (profile) => {
    try {
      const { data: tasks = [] } = await supabaseAdmin
        .from('tasks').select('*').eq('user_id', profile.id).eq('archived', false)

      const pending = (tasks || []).filter(t => !t.completed)
      const completed = (tasks || []).filter(t => t.completed)
      const name = profile.full_name?.split(' ')[0] || 'there'
      const top = topTask(pending)

      const topLine = top
        ? `Top remaining: ${fmtTask(top)}.`
        : 'All tasks done so far.'

      const progressLine = completed.length > 0
        ? `${completed.length} task${completed.length !== 1 ? 's' : ''} completed today.`
        : 'No tasks completed yet today.'

      const contextPrompt = `It's midday. ${name} is halfway through their day. ${progressLine} ${topLine} Write a midday check-in. 2-3 sentences max. Acknowledge progress if any. Name the top remaining task. Be focused and calm.`

      const systemPrompt = buildPersonaPrompt(profile)
      const message = await coachingMessage(
        [{ role: 'user', content: contextPrompt }],
        systemPrompt
      )

      await supabaseAdmin.from('profiles').update({
        last_checkin_message: message,
        last_checkin_at: new Date().toISOString()
      }).eq('id', profile.id)

      pregenerated++
      console.log(`[midday-checkin] Pre-generated for ${name}`)
    } catch (err) {
      console.error(`[midday-checkin] Pre-gen failed for ${profile.id}:`, err.message)
    }
  }))

  // Send push notifications to all eligible midday users
  const userIds = profiles.map(p => p.id)
  try {
    await sendPushToUsers(supabaseAdmin, userIds, {
      title: 'Midday check.',
      body: 'Half the day left. One thing.',
      tag: 'cinis-midday',
      url: '/dashboard'
    })
    console.log(`[midday-checkin] Push sent to ${userIds.length} users`)
  } catch (pushErr) {
    console.error('[midday-checkin] Batch push error:', pushErr.message)
  }

  return res.status(200).json({ success: true, pregenerated })
}
