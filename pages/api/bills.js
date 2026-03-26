import { createClient } from '@supabase/supabase-js'
import withAuth from '../../lib/authGuard'
import { sanitizeTitle, sanitizeNotes } from '../../lib/sanitize'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const VALID_FREQUENCIES = ['monthly', 'weekly', 'yearly', 'quarterly', 'one-time', 'bimonthly']
const VALID_CATEGORIES = ['housing', 'utilities', 'subscriptions', 'insurance', 'debt', 'medical', 'transport', 'food', 'other']
const VALID_BILL_TYPES = ['bill', 'loan', 'credit_card']

const BILL_FIELDS = [
  'name', 'amount', 'due_day', 'first_date', 'second_date', 'frequency', 'category',
  'autopay', 'is_variable', 'account', 'notes', 'url', 'remind_days',
  'auto_task', 'interest_rate', 'bill_type'
]

async function handler(req, res, userId) {
  const supabaseAdmin = getAdminClient()

  // GET — all bills ordered by due_day; bimonthly bills expand into two entries
  if (req.method === 'GET') {
    const { data: bills, error } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .order('due_day', { ascending: true, nullsFirst: false })

    if (error) {
      console.error('[bills:GET] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to fetch bills' })
    }

    // Expand bimonthly bills with both dates into two separate display entries
    const expanded = []
    for (const bill of bills || []) {
      if (bill.frequency === 'bimonthly' && bill.first_date && bill.second_date) {
        expanded.push({ ...bill, due_day: bill.first_date,  _bimonthly_slot: 1 })
        expanded.push({ ...bill, due_day: bill.second_date, _bimonthly_slot: 2 })
      } else {
        expanded.push(bill)
      }
    }
    // Re-sort after expansion so both dates appear in correct order
    expanded.sort((a, b) => (a.due_day ?? 99) - (b.due_day ?? 99))

    return res.status(200).json({ bills: expanded })
  }

  // POST — create bill + optional auto-task
  if (req.method === 'POST') {
    const raw = req.body

    const body = {
      ...raw,
      ...(raw.dueDay !== undefined      && { due_day: raw.dueDay }),
      ...(raw.billType !== undefined     && { bill_type: raw.billType }),
      ...(raw.interestRate !== undefined && { interest_rate: raw.interestRate }),
      ...(raw.autoTask !== undefined     && { auto_task: raw.autoTask }),
      ...(raw.remindDays !== undefined   && { remind_days: raw.remindDays }),
      ...(raw.isVariable !== undefined   && { is_variable: raw.isVariable }),
    }

    if (!body.name) return res.status(400).json({ error: 'name required' })

    const cleanName = sanitizeTitle(body.name)
    if (!cleanName) return res.status(400).json({ error: 'Invalid name' })

    if (body.frequency && !VALID_FREQUENCIES.includes(body.frequency)) {
      return res.status(400).json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` })
    }
    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` })
    }
    if (body.bill_type && !VALID_BILL_TYPES.includes(body.bill_type)) {
      return res.status(400).json({ error: `bill_type must be one of: ${VALID_BILL_TYPES.join(', ')}` })
    }

    const { data: bill, error } = await supabaseAdmin
      .from('bills')
      .insert({
        user_id: userId,
        name: cleanName,
        amount: body.amount || 0,
        due_day: body.due_day || null,
        first_date: body.first_date ? parseInt(body.first_date) : null,
        second_date: body.second_date ? parseInt(body.second_date) : null,
        frequency: body.frequency || 'monthly',
        category: body.category || 'other',
        auto_task: body.auto_task || false,
        autopay: body.autopay || false,
        account: body.account || null,
        url: body.url || null,
        remind_days: body.remind_days || 3,
        is_variable: body.is_variable || false,
        notes: body.notes ? sanitizeNotes(body.notes) : null,
        bill_type: body.bill_type || 'bill',
        interest_rate: body.interest_rate || null,
      })
      .select()
      .single()

    if (error) {
      console.error('[bills:POST] insert error:', JSON.stringify(error))
      return res.status(400).json({ error: error.message, hint: error.hint })
    }


    if (bill.auto_task && bill.due_day) {
      const now = new Date()
      const dueDate = new Date(now.getFullYear(), now.getMonth(), bill.due_day, 12, 0, 0)
      if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1)

      const { error: taskErr } = await supabaseAdmin.from('tasks').insert({
        user_id: userId,
        title: `Pay ${bill.name}`,
        scheduled_for: dueDate.toISOString(),
        completed: false,
        archived: false,
        task_type: 'bill',
        notes: `$${parseFloat(bill.amount).toFixed(2)} due`,
      })

      if (taskErr) {
        console.error('[bills:POST] auto-task error:', JSON.stringify(taskErr))
      } else {
      }
    }

    return res.status(200).json({ bill })
  }

  // PATCH — update fields, ownership enforced via user_id filter
  if (req.method === 'PATCH') {
    const { id, ...body } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    if (body.frequency && !VALID_FREQUENCIES.includes(body.frequency)) {
      return res.status(400).json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` })
    }
    if (body.bill_type && !VALID_BILL_TYPES.includes(body.bill_type)) {
      return res.status(400).json({ error: `bill_type must be one of: ${VALID_BILL_TYPES.join(', ')}` })
    }

    const updates = {}
    for (const key of BILL_FIELDS) {
      if (key in body) {
        if (key === 'name') updates[key] = sanitizeTitle(body[key])
        else if (key === 'notes') updates[key] = body[key] ? sanitizeNotes(body[key]) : null
        else updates[key] = body[key]
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data: bill, error } = await supabaseAdmin
      .from('bills')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('[bills:PATCH] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to update bill' })
    }
    if (!bill) return res.status(404).json({ error: 'Bill not found' })

    return res.status(200).json({ bill })
  }

  // DELETE ?id=[bill_id] — ownership verified, cleans up associated tasks
  if (req.method === 'DELETE') {
    const id = req.query.id || req.body?.id
    if (!id) return res.status(400).json({ error: 'id required' })

    const { data: bill, error: fetchErr } = await supabaseAdmin
      .from('bills')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchErr || !bill) return res.status(404).json({ error: 'Bill not found' })

    const { error: deleteErr } = await supabaseAdmin
      .from('bills')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteErr) {
      console.error('[bills:DELETE] error:', JSON.stringify(deleteErr))
      return res.status(500).json({ error: 'Failed to delete bill' })
    }

    // Clean up auto-tasks created for this bill
    const { error: taskCleanErr } = await supabaseAdmin
      .from('tasks')
      .delete()
      .eq('user_id', userId)
      .eq('task_type', 'bill')
      .ilike('notes', `%${bill.name}%`)

    if (taskCleanErr) {
      console.error('[bills:DELETE] task cleanup error:', JSON.stringify(taskCleanErr))
    }

    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withAuth(handler)
