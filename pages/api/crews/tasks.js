import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'
import { sanitizeTitle } from '../../../lib/sanitize'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function assertMember(supabaseAdmin, crew_id, userId) {
  const { data } = await supabaseAdmin
    .from('crew_members')
    .select('id')
    .eq('crew_id', crew_id)
    .eq('user_id', userId)
    .single()
  return !!data
}

async function handler(req, res, userId) {
  const supabaseAdmin = getAdminClient()

  // ── GET — fetch all tasks for a crew ───────────────────────────────────────
  if (req.method === 'GET') {
    const { crew_id } = req.query
    if (!crew_id) return res.status(400).json({ error: 'crew_id required' })

    const isMember = await assertMember(supabaseAdmin, crew_id, userId)
    if (!isMember) return res.status(403).json({ error: 'Not a member of this crew' })

    const { data: tasks, error } = await supabaseAdmin
      .from('crew_tasks')
      .select('*')
      .eq('crew_id', crew_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[crews/tasks:GET] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to fetch tasks' })
    }

    return res.status(200).json({ tasks })
  }

  // ── POST — create a crew task ──────────────────────────────────────────────
  if (req.method === 'POST') {
    const { crew_id, title, assigned_to, due_date } = req.body
    if (!crew_id) return res.status(400).json({ error: 'crew_id required' })
    if (!title) return res.status(400).json({ error: 'title required' })

    const cleanTitle = sanitizeTitle(title)
    if (!cleanTitle) return res.status(400).json({ error: 'Invalid title' })

    const isMember = await assertMember(supabaseAdmin, crew_id, userId)
    if (!isMember) return res.status(403).json({ error: 'Not a member of this crew' })

    const { data: task, error } = await supabaseAdmin
      .from('crew_tasks')
      .insert({
        crew_id,
        title: cleanTitle,
        created_by: userId,
        assigned_to: assigned_to || null,
        due_date: due_date || null,
        status: 'open',
      })
      .select()
      .single()

    if (error) {
      console.error('[crews/tasks:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to create task' })
    }

    return res.status(200).json({ task })
  }

  // ── PATCH — update task status / claimed_by ────────────────────────────────
  if (req.method === 'PATCH') {
    const { task_id, status, claimed_by } = req.body
    if (!task_id) return res.status(400).json({ error: 'task_id required' })

    // Fetch the task to resolve crew_id for membership check
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('crew_tasks')
      .select('crew_id')
      .eq('id', task_id)
      .single()

    if (fetchErr || !existing) return res.status(404).json({ error: 'Task not found' })

    const isMember = await assertMember(supabaseAdmin, existing.crew_id, userId)
    if (!isMember) return res.status(403).json({ error: 'Not a member of this crew' })

    const updates = {}
    if (status !== undefined) updates.status = status
    if (claimed_by !== undefined) updates.claimed_by = claimed_by

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' })
    }

    const { data: task, error } = await supabaseAdmin
      .from('crew_tasks')
      .update(updates)
      .eq('id', task_id)
      .select()
      .single()

    if (error) {
      console.error('[crews/tasks:PATCH] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to update task' })
    }

    return res.status(200).json({ task })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
