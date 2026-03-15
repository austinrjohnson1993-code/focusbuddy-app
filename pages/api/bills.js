import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

const VALID_FREQUENCIES = ['monthly', 'weekly', 'yearly', 'quarterly', 'one-time', 'bimonthly']
const VALID_CATEGORIES = ['housing', 'utilities', 'subscriptions', 'insurance', 'debt', 'medical', 'transport', 'food', 'other']
const VALID_BILL_TYPES = ['bill', 'loan', 'debt']

const BILL_FIELDS = [
  'name', 'amount', 'due_day', 'frequency', 'category',
  'autopay', 'is_variable', 'account', 'notes', 'url', 'remind_days',
  'auto_task', 'interest_rate', 'bill_type'
]

export default async function handler(req, res) {
  const supabaseAdmin = getAdminClient()

  // GET ?userId=xxx — fetch all bills for user
  if (req.method === 'GET') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const { data: bills, error } = await supabaseAdmin
      .from('bills')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true })

    if (error) {
      console.error('[bills:GET] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to fetch bills' })
    }

    return res.status(200).json({ bills })
  }

  // POST { userId, ...billFields } — create bill
  if (req.method === 'POST') {
    const { userId, ...body } = req.body
    if (!userId) return res.status(400).json({ error: 'userId required' })
    if (!body.name) return res.status(400).json({ error: 'name required' })

    if (body.frequency && !VALID_FREQUENCIES.includes(body.frequency)) {
      return res.status(400).json({ error: `frequency must be one of: ${VALID_FREQUENCIES.join(', ')}` })
    }
    if (body.category && !VALID_CATEGORIES.includes(body.category)) {
      return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` })
    }
    if (body.bill_type && !VALID_BILL_TYPES.includes(body.bill_type)) {
      return res.status(400).json({ error: `bill_type must be one of: ${VALID_BILL_TYPES.join(', ')}` })
    }

    const insert = { user_id: userId }
    for (const key of BILL_FIELDS) {
      if (key in body) insert[key] = body[key]
    }
    if (!insert.bill_type) insert.bill_type = 'bill'

    const { data: bill, error } = await supabaseAdmin
      .from('bills')
      .insert(insert)
      .select()
      .single()

    if (error) {
      console.error('[bills:POST] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to create bill' })
    }

    console.log(`[bills:POST] Created bill "${bill.name}" for ${userId}`)
    return res.status(201).json({ bill })
  }

  // PATCH { id, ...updates } — update bill fields
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
      if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' })
    }

    const { data: bill, error } = await supabaseAdmin
      .from('bills')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[bills:PATCH] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to update bill' })
    }

    console.log(`[bills:PATCH] Updated bill ${id} — fields: ${Object.keys(updates).join(', ')}`)
    return res.status(200).json({ bill })
  }

  // DELETE { id } — delete bill
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    const { error } = await supabaseAdmin
      .from('bills')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[bills:DELETE] error:', JSON.stringify(error))
      return res.status(500).json({ error: 'Failed to delete bill' })
    }

    console.log(`[bills:DELETE] Deleted bill ${id}`)
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
