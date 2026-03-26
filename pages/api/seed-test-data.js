import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Authenticate via Bearer token
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No auth token provided' })

  const supabaseAdmin = getAdminClient()
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const userId = user.id

  // Date helpers
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const todayISO = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const tomorrowISO = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString()

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const tasks = [
    {
      user_id: userId,
      title: 'Review quarterly goals',
      scheduled_for: todayISO,
      due_time: `${today}T09:00:00Z`,
      priority_score: 1,
      completed: false,
      archived: false,
      rollover_count: 0,
      starred: false,
      task_type: 'regular',
      estimated_minutes: 30,
    },
    {
      user_id: userId,
      title: 'Call the insurance company',
      scheduled_for: todayISO,
      due_time: `${today}T11:30:00Z`,
      priority_score: 0,
      completed: false,
      archived: false,
      rollover_count: 0,
      starred: false,
      task_type: 'regular',
      estimated_minutes: 20,
    },
    {
      user_id: userId,
      title: 'Send project update email',
      scheduled_for: todayISO,
      due_time: `${today}T14:00:00Z`,
      priority_score: 0,
      completed: false,
      archived: false,
      rollover_count: 0,
      starred: true,
      task_type: 'regular',
      estimated_minutes: 15,
    },
    {
      user_id: userId,
      title: '30 minute walk',
      scheduled_for: todayISO,
      due_time: `${today}T17:00:00Z`,
      priority_score: 0,
      completed: false,
      archived: false,
      rollover_count: 0,
      starred: false,
      task_type: 'regular',
      estimated_minutes: 30,
    },
    {
      user_id: userId,
      title: 'Read before bed',
      scheduled_for: tomorrowISO,
      due_time: `${today}T21:00:00Z`,
      priority_score: 0,
      completed: false,
      archived: false,
      rollover_count: 0,
      starred: false,
      task_type: 'regular',
      estimated_minutes: 20,
    },
  ]

  const { error: tasksErr } = await supabaseAdmin.from('tasks').insert(tasks)
  if (tasksErr) {
    console.error('[seed-test-data] tasks insert error:', JSON.stringify(tasksErr))
    return res.status(500).json({ error: 'Failed to seed tasks', detail: tasksErr.message })
  }

  // ── Bills ─────────────────────────────────────────────────────────────────
  const bills = [
    {
      user_id: userId,
      name: 'Netflix',
      amount: 15.99,
      frequency: 'monthly',
      category: 'Subscriptions',
      bill_type: 'bill',
      due_day: 15,
    },
    {
      user_id: userId,
      name: 'Rent',
      amount: 1450.00,
      frequency: 'monthly',
      category: 'Housing',
      bill_type: 'bill',
      due_day: 1,
    },
    {
      user_id: userId,
      name: 'Car Loan',
      amount: 387.50,
      frequency: 'monthly',
      category: 'Transport',
      bill_type: 'loan',
      interest_rate: 4.9,
      due_day: 20,
    },
  ]

  const { error: billsErr } = await supabaseAdmin.from('bills').insert(bills)
  if (billsErr) {
    console.error('[seed-test-data] bills insert error:', JSON.stringify(billsErr))
    return res.status(500).json({ error: 'Failed to seed bills', detail: billsErr.message })
  }

  // ── Journal entry ─────────────────────────────────────────────────────────
  const { error: journalErr } = await supabaseAdmin.from('journal_entries').insert({
    user_id: userId,
    content: 'QC test entry — seeded automatically',
    ai_response: 'This is a seeded test response for QC purposes.',
    created_at: now.toISOString(),
  })
  if (journalErr) {
    console.error('[seed-test-data] journal insert error:', JSON.stringify(journalErr))
    return res.status(500).json({ error: 'Failed to seed journal entry', detail: journalErr.message })
  }

  // ── Progress snapshot ─────────────────────────────────────────────────────
  const { error: progressErr } = await supabaseAdmin.from('progress_snapshots').insert({
    user_id: userId,
    snapshot_date: todayISO,
    tasks_completed: 2,
    tasks_added: 5,
    tasks_rolled: 1,
    focus_minutes: 25,
  })
  if (progressErr) {
    console.error('[seed-test-data] progress insert error:', JSON.stringify(progressErr))
    return res.status(500).json({ error: 'Failed to seed progress snapshot', detail: progressErr.message })
  }

  return res.status(200).json({ success: true, seeded: { tasks: 5, bills: 3, journal: 1, progress: 1 } })
}
