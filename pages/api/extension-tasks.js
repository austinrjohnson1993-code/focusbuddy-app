// Chrome extension task API — supports GET (today's tasks), POST (create),
// and PATCH (complete a task). All requests require a valid Supabase JWT.

import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGINS = [
  'chrome-extension://',
  'https://focus-buddy.app',
  'http://localhost:3000',
]

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || ''
  const allowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o))
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function getAuthClient(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function getUser(token) {
  const supabase = getAuthClient(token)
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No auth token' })

  const user = await getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const admin = getAdminClient()

  // ── GET: today's tasks ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)

    const { data, error } = await admin
      .from('tasks')
      .select('id, title, due_time, completed, consequence_level, notes, recurrence')
      .eq('user_id', user.id)
      .eq('archived', false)
      .gte('scheduled_for', todayStart.toISOString())
      .lte('scheduled_for', todayEnd.toISOString())
      .order('priority_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[extension-tasks] GET error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json(data || [])
  }

  // ── POST: create a task ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    const {
      title,
      due_date,
      due_time: dueTimeStr,
      consequence_level = 'self',
      notes,
      recurrence = 'none',
      source_url,
      source_note,
    } = req.body || {}

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required' })
    }

    // Build due_time ISO string from parsed date + time fields
    let dueTime = null
    if (due_date && dueTimeStr) {
      dueTime = new Date(`${due_date}T${dueTimeStr}:00`).toISOString()
    } else if (due_date) {
      dueTime = new Date(`${due_date}T09:00:00`).toISOString()
    }

    // Combine notes with page source note if provided
    let finalNotes = notes || null
    if (source_note) {
      finalNotes = finalNotes ? `${finalNotes}\n\n${source_note}` : source_note
    }

    const task = {
      user_id: user.id,
      title: title.trim(),
      completed: false,
      archived: false,
      due_time: dueTime,
      consequence_level: ['external', 'self'].includes(consequence_level) ? consequence_level : 'self',
      notes: finalNotes,
      recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : 'none',
      rollover_count: 0,
      priority_score: 0,
      created_at: new Date().toISOString(),
      scheduled_for: new Date().toISOString(),
    }

    const { data, error } = await admin.from('tasks').insert(task).select().single()
    if (error) {
      console.error('[extension-tasks] POST error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.status(201).json(data)
  }

  // ── PATCH: complete a task ────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { task_id, completed } = req.body || {}
    if (!task_id) return res.status(400).json({ error: 'task_id is required' })

    const update = {
      completed: completed !== false,
      completed_at: completed !== false ? new Date().toISOString() : null,
    }

    const { error } = await admin
      .from('tasks')
      .update(update)
      .eq('id', task_id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[extension-tasks] PATCH error:', error.message)
      return res.status(500).json({ error: error.message })
    }

    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
