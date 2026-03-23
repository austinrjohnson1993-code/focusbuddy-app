import { createClient } from '@supabase/supabase-js'
import withAuth from '../../../lib/authGuard'
import { sanitizeTitle } from '../../../lib/sanitize'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const VALID_TASK_TYPES = ['task', 'bill', 'appointment', 'chore']

async function handler(req, res, userId) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'Task ID is required' })

  const { starred, task_type, estimated_minutes } = req.body
  const update = {}

  // Validate and collect fields
  if (starred !== undefined) {
    if (typeof starred !== 'boolean') {
      return res.status(400).json({ error: 'starred must be a boolean' })
    }
    update.starred = starred
  }

  if (task_type !== undefined) {
    const sanitized = sanitizeTitle(task_type)
    if (!VALID_TASK_TYPES.includes(sanitized)) {
      return res.status(400).json({ error: `task_type must be one of: ${VALID_TASK_TYPES.join(', ')}` })
    }
    update.task_type = sanitized
  }

  if (estimated_minutes !== undefined) {
    const mins = parseInt(estimated_minutes, 10)
    if (!Number.isInteger(mins) || mins <= 0) {
      return res.status(400).json({ error: 'estimated_minutes must be a positive integer' })
    }
    update.estimated_minutes = mins
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const supabaseAdmin = getAdminClient()

  try {
    // Verify task belongs to this user before updating
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Task not found' })
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tasks')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (updateError) {
      return res.status(500).json({ error: 'Failed to update task' })
    }

    return res.status(200).json({ success: true, task: updated })
  } catch (err) {
    console.error(`[tasks/${id}] PATCH error:`, err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)
