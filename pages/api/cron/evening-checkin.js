import { createClient } from '@supabase/supabase-js'
import { runRollover } from '../rollover-tasks'
import { runBillsToTasks } from '../bills-to-tasks'
import { runProgressSnapshot } from '../progress-snapshot'
import { buildPersonaPrompt } from '../../../lib/persona'
import { coachingMessage } from '../../../lib/anthropic'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

function fmtTask(t) {
  let s = `"${t.title}"`
  if ((t.rollover_count || 0) > 0) s += ` [rolled ${t.rollover_count}×]`
  return s
}

// Called nightly at 8PM by Vercel cron (see vercel.json)
export default async function handler(req, res) {
  const supabaseAdmin = getAdminClient()

  // 1. Run nightly rollover
  let rolloverResult = { rolled: 0, tasks: [] }
  try {
    rolloverResult = await runRollover()
    console.log(`[evening-checkin] Rollover: ${rolloverResult.rolled} tasks moved`)
  } catch (err) {
    console.error('[evening-checkin] Rollover error:', err.message)
  }

  // 2. Pre-generate evening check-in message for users who have evening check-ins enabled
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .contains('checkin_times', ['evening'])

  if (!profiles || profiles.length === 0) {
    return res.status(200).json({ success: true, rolled: rolloverResult.rolled, pregenerated: 0 })
  }

  let pregenerated = 0

  await Promise.allSettled(profiles.map(async (profile) => {
    try {
      const { data: tasks = [] } = await supabaseAdmin
        .from('tasks').select('*').eq('user_id', profile.id).eq('archived', false)

      const pending = (tasks || []).filter(t => !t.completed)
      const completed = (tasks || []).filter(t => t.completed)
      const rollovers = pending.filter(t => (t.rollover_count || 0) > 0)
      const name = profile.full_name?.split(' ')[0] || 'there'

      const rolloverNote = rollovers.length > 0
        ? ` ${rollovers.length} task${rollovers.length !== 1 ? 's have' : ' has'} been rolling over.`
        : ''
      const contextPrompt = `It's evening. The day is wrapping up for ${name}. Completed: ${completed.length > 0 ? completed.map(fmtTask).join(', ') : 'none'}. Still pending (will roll to tomorrow): ${pending.length > 0 ? pending.map(fmtTask).join(', ') : 'none'}.${rolloverNote} Lead with wins first, always. Close with something that makes them feel good about showing up tomorrow. Under 4 sentences.`

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
      console.log(`[evening-checkin] Pre-generated for ${name}`)

      // 3. Create bill tasks due today or tomorrow
      try {
        const billResult = await runBillsToTasks(profile.id)
        if (billResult.created > 0) {
          console.log(`[evening-checkin] Bill tasks created for ${name}:`, billResult.bills)
        }
      } catch (billErr) {
        console.error(`[evening-checkin] Bill tasks failed for ${profile.id}:`, billErr.message)
      }

      // 4. Save today's progress snapshot before the day ends
      try {
        await runProgressSnapshot(profile.id)
      } catch (snapErr) {
        console.error(`[evening-checkin] Progress snapshot failed for ${profile.id}:`, snapErr.message)
      }
    } catch (err) {
      console.error(`[evening-checkin] Pre-gen failed for ${profile.id}:`, err.message)
    }
  }))

  return res.status(200).json({ success: true, rolled: rolloverResult.rolled, pregenerated })
}
