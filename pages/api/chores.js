import { createClient } from '@supabase/supabase-js'
import { buildChoreTasks, CHORE_PRESETS } from '../../lib/chores'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getAuthUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export default async function handler(req, res) {
  const user = await getAuthUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseAdmin = getAdminClient()

  // ── GET — return current preset + available presets ──────────────────────
  if (req.method === 'GET') {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('chore_preset')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('[chores:GET] profile error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to fetch profile' })
    }

    return res.status(200).json({
      preset: profile.chore_preset,
      presets: CHORE_PRESETS.map(p => ({ id: p.id, name: p.name, description: p.description }))
    })
  }

  // ── POST — apply a preset ─────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { preset: presetId } = req.body
    if (!presetId) return res.status(400).json({ error: 'preset required' })

    const preset = CHORE_PRESETS.find(p => p.id === presetId)
    if (!preset) {
      return res.status(400).json({ error: `preset must be one of: ${CHORE_PRESETS.map(p => p.id).join(', ')}` })
    }

    // Build tasks and tag with 'chore routine' so they're findable for cleanup
    const rawTasks = buildChoreTasks(preset, user.id)
    const tasks = rawTasks.map(t => ({ ...t, notes: 'chore routine' }))

    // Delete existing chore tasks (clean swap)
    const { error: deleteErr } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('completed', false)
      .like('notes', '%chore routine%')

    if (deleteErr) {
      console.error('[chores:POST] delete error:', JSON.stringify(deleteErr))
      return res.status(500).json({ error: 'Failed to clear existing chore tasks' })
    }

    // Bulk insert new chore tasks
    const { error: insertErr } = await supabaseAdmin
      .from('tasks')
      .insert(tasks)

    if (insertErr) {
      console.error('[chores:POST] insert error:', JSON.stringify(insertErr))
      return res.status(500).json({ error: 'Failed to create chore tasks' })
    }

    // Save preset to profile
    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({ chore_preset: presetId })
      .eq('id', user.id)

    if (profileErr) {
      console.error('[chores:POST] profile update error:', JSON.stringify(profileErr))
      // Non-fatal — tasks are created, just log it
    }

    console.log(`[chores:POST] Applied "${preset.name}" for ${user.id} — ${tasks.length} tasks`)
    return res.status(200).json({ success: true, tasksCreated: tasks.length, preset: preset.name })
  }

  // ── DELETE — remove all chore tasks and clear preset ─────────────────────
  if (req.method === 'DELETE') {
    const { error: deleteErr } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .like('notes', '%chore routine%')

    if (deleteErr) {
      console.error('[chores:DELETE] error:', JSON.stringify(deleteErr))
      return res.status(500).json({ error: 'Failed to delete chore tasks' })
    }

    const { error: profileErr } = await supabaseAdmin
      .from('profiles')
      .update({ chore_preset: null })
      .eq('id', user.id)

    if (profileErr) {
      console.error('[chores:DELETE] profile update error:', JSON.stringify(profileErr))
    }

    console.log(`[chores:DELETE] Cleared chore tasks and preset for ${user.id}`)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
