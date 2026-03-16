export function getNextDueDate(bill) {
  if (bill.due_day == null) return null
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth()
  const d = bill.due_day
  return d >= today.getDate() ? new Date(y, m, d) : new Date(y, m + 1, d)
}

export function isDueSoon(bill, daysThreshold = 7) {
  const dueDay = typeof bill === 'number' ? bill : bill?.due_day
  if (dueDay == null) return false
  const today = new Date().getDate()
  return dueDay >= today && dueDay <= today + daysThreshold
}

export function formatBillAmount(bill) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(bill.amount) || 0)
}

export function getBillCategory(bill) {
  if (bill.category) return bill.category

  const name = (bill.name || bill.title || '').toLowerCase()
  if (/rent|mortgage|housing/.test(name)) return 'Housing'
  if (/electric|gas|water|utility|utilities/.test(name)) return 'Utilities'
  if (/netflix|hulu|spotify|subscription|amazon prime/.test(name)) return 'Subscriptions'
  if (/phone|mobile|cell/.test(name)) return 'Phone'
  if (/internet|wifi|cable/.test(name)) return 'Internet'
  if (/insurance/.test(name)) return 'Insurance'
  if (/loan|credit|card|debt/.test(name)) return 'Credit Card'
  if (/gym|fitness/.test(name)) return 'Health'
  return 'Other'
}
