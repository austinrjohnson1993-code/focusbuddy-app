import { createClient } from '@supabase/supabase-js'
import { withAuthGuard } from '../../lib/authGuard'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function runBillsToTasks(userId) {
  const supabaseAdmin = getAdminClient()

  const { data: bills, error: billsErr } = await supabaseAdmin
    .from('bills')
    .select('*')
    .eq('user_id', userId)
    .eq('auto_task', true)

  if (billsErr) throw new Error(billsErr.message)
  if (!bills || bills.length === 0) return { created: 0, bills: [] }

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const todayDay = today.getDate()
  const tomorrowDay = tomorrow.getDate()

  const created = []

  for (const bill of bills) {
    if (bill.due_day !== todayDay && bill.due_day !== tomorrowDay) continue

    const { data: existing } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .ilike('title', `Pay: ${bill.name}%`)
      .eq('completed', false)
      .limit(1)

    if (existing && existing.length > 0) {
      continue
    }

    const dueDate = bill.due_day === todayDay ? new Date(today) : new Date(tomorrow)
    dueDate.setHours(9, 0, 0, 0)
    const dueISO = dueDate.toISOString()

    const amountStr = bill.amount != null ? ` — $${Number(bill.amount).toFixed(2)}` : ''
    const title = `Pay: ${bill.name}${amountStr}`
    const noteParts = [`Recurring ${bill.frequency} bill`]
    if (bill.account) noteParts.push(bill.account)
    const notes = noteParts.join(' — ')

    const { error: insertErr } = await supabaseAdmin
      .from('tasks')
      .insert({
        user_id: userId,
        title,
        consequence_level: 'external',
        due_time: dueISO,
        notes,
      })

    if (insertErr) {
      console.error(`[bills-to-tasks] Failed to create task for "${bill.name}":`, JSON.stringify(insertErr))
    } else {
      created.push(bill.name)
    }
  }

  return { created: created.length, bills: created }
}

async function handler(req, res, userId) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const result = await runBillsToTasks(userId)
    return res.status(200).json(result)
  } catch (err) {
    console.error('[bills-to-tasks] Error:', err.message)
    return res.status(500).json({ error: err.message })
  }
}

export default withAuthGuard(handler)
