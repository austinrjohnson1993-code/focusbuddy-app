import React, { useState, useEffect, useRef } from 'react'
import styles from '../../styles/Dashboard.module.css'
import { supabase } from '../../lib/supabase'
import { isDueSoon as billIsDueSoon, formatBillAmount, getBillCategory, getNextDueDate } from '../../lib/billUtils'
import { fmtMoney, EmptyState, SkeletonCard, BILL_CATEGORIES, localDateStr, todayStr, ErrorState, TabErrorBoundary } from './shared'
import { Wallet, Plus, Trash, Receipt, Scales, Microphone } from '@phosphor-icons/react'

export default function TabFinance({ user, profile, showToast, loggedFetch, setProfile, switchTab }) {
  // ── Bill states ──────────────────────────────────────────────────────────
  const [bills, setBills] = useState([])
  const [billsLoaded, setBillsLoaded] = useState(false)
  const [showAddBillModal, setShowAddBillModal] = useState(false)
  const [newBillName, setNewBillName] = useState('')
  const [newBillAmount, setNewBillAmount] = useState('')
  const [newBillDueDay, setNewBillDueDay] = useState('')
  const [newBillFrequency, setNewBillFrequency] = useState('monthly')
  const [newBillCategory, setNewBillCategory] = useState('')
  const [newBillAutoTask, setNewBillAutoTask] = useState(true)
  const [newBillAutopay, setNewBillAutopay] = useState(false)
  const [newBillNotes, setNewBillNotes] = useState('')
  const [newBillAccount, setNewBillAccount] = useState('')
  const [newBillFirstDate, setNewBillFirstDate] = useState('')
  const [newBillSecondDate, setNewBillSecondDate] = useState('')
  const [budgetPlan, setBudgetPlan] = useState('50/30/20')
  const [addingBill, setAddingBill] = useState(false)
  const [billsLoading, setBillsLoading] = useState(false)
  const [billsError, setBillsError] = useState(false)

  // ── Finance sub-tabs ─────────────────────────────────────────────────────
  const [financeSub, setFinanceSub] = useState('bills')
  const [expandedLearnCard, setExpandedLearnCard] = useState(null)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState('')
  const [learnReferral, setLearnReferral] = useState(null)
  const [incomeFrequency, setIncomeFrequency] = useState('monthly')
  const [billType, setBillType] = useState('bill')
  const [billInterestRate, setBillInterestRate] = useState('')

  // ── Finance Budget sub-tab ───────────────────────────────────────────────
  const [spendLog, setSpendLog] = useState([])
  const [todaySpendTotal, setTodaySpendTotal] = useState(0)
  const [spendLoaded, setSpendLoaded] = useState(false)
  const [spendInput, setSpendInput] = useState('')
  const [spendAmount, setSpendAmount] = useState('')
  const [spendCategory, setSpendCategory] = useState('')
  const [spendImpulse, setSpendImpulse] = useState(false)
  const [spendLogging, setSpendLogging] = useState(false)
  const [paydayDay, setPaydayDay] = useState(0)
  const [paydayDayInput, setPaydayDayInput] = useState('')

  // ── Finance Plans sub-tab (calculators) ──────────────────────────────────
  const [expandedPlanCalc, setExpandedPlanCalc] = useState(null)
  const [planCalcInputs, setPlanCalcInputs] = useState({})
  const [knowledgeFilter, setKnowledgeFilter] = useState('All')
  const [learnFilter, setLearnFilter] = useState('All')
  const [expandedInsightCat, setExpandedInsightCat] = useState(null)

  // ── Bill voice input ─────────────────────────────────────────────────────
  const [billListening, setBillListening] = useState(false)
  const [billVoiceTranscript, setBillVoiceTranscript] = useState('')
  const [billParsing, setBillParsing] = useState(false)
  const billRecognitionRef = useRef(null)

  // ── Data fetching ────────────────────────────────────────────────────────
  const fetchBills = async (userId) => {
    setBillsLoaded(true)
    setBillsLoading(true)
    setBillsError(false)
    try {
      const { data, error } = await supabase
        .from('bills').select('*').eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (error) throw error
      setBills(data || [])
    } catch {
      setBillsError(true)
    } finally {
      setBillsLoading(false)
    }
  }

  const fetchSpendLog = async () => {
    setSpendLoaded(true)
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'
      const res = await loggedFetch(`/api/finance/spend?timezone=${encodeURIComponent(tz)}`)
      if (!res.ok) return
      const data = await res.json()
      setSpendLog(data.entries || [])
      setTodaySpendTotal(data.today_total || 0)
    } catch {}
  }

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user && !billsLoaded) {
      fetchBills(user.id)
    }
  }, [user])

  useEffect(() => {
    if ((financeSub === 'budget' || financeSub === 'insights') && user && !spendLoaded) {
      fetchSpendLog()
    }
  }, [financeSub, user])

  // ── Handlers ─────────────────────────────────────────────────────────────
  const patchSettings = async (updates) => {
    if (!user) return false
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('[settings] patchSettings: no access token')
        return false
      }
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: user.id, updates }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[settings] PATCH failed:', res.status, err)
        return false
      }
      return true
    } catch (err) {
      console.error('[settings] PATCH error:', err)
      return false
    }
  }

  const addBill = async (e) => {
    e.preventDefault()
    if (!newBillName.trim() || !newBillAmount || !user) return
    setAddingBill(true)
    const bill = {
      user_id: user.id, name: newBillName.trim(),
      amount: parseFloat(newBillAmount),
      due_day: newBillFrequency === 'bimonthly' ? null : (newBillDueDay ? parseInt(newBillDueDay) : null),
      frequency: newBillFrequency, category: newBillCategory || 'Other',
      autopay: newBillAutopay,
      auto_task: newBillAutoTask, created_at: new Date().toISOString(),
      bill_type: billType,
      notes: newBillNotes || null,
      account: newBillAccount || null,
      ...(newBillFrequency === 'bimonthly' && newBillFirstDate ? { first_date: parseInt(newBillFirstDate), second_date: parseInt(newBillSecondDate) || null } : {}),
      ...(billInterestRate ? { interest_rate: parseFloat(billInterestRate) } : {}),
    }
    const { data } = await supabase.from('bills').insert(bill).select().single()
    if (data) setBills(prev => [data, ...prev])
    setNewBillName(''); setNewBillAmount(''); setNewBillDueDay('')
    setNewBillFrequency('monthly'); setNewBillCategory(''); setNewBillAutoTask(true)
    setNewBillAutopay(false); setNewBillNotes(''); setNewBillAccount('')
    setNewBillFirstDate(''); setNewBillSecondDate('')
    setBillType('bill'); setBillInterestRate('')
    setAddingBill(false); setShowAddBillModal(false)
  }

  const deleteBill = async (id) => {
    await supabase.from('bills').delete().eq('id', id)
    setBills(prev => prev.filter(b => b.id !== id))
  }

  const logSpend = async (e) => {
    e.preventDefault()
    if (!spendAmount || !user) return
    setSpendLogging(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await loggedFetch('/api/finance/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ amount: parseFloat(spendAmount), category: spendCategory || null, description: spendInput || null, impulse: spendImpulse }),
      })
      if (!res.ok) { showToast('Failed to log spend'); return }
      const data = await res.json()
      if (data.entry) {
        setSpendLog(prev => [data.entry, ...prev])
        setTodaySpendTotal(prev => prev + parseFloat(data.entry.amount))
        setSpendAmount('')
        setSpendInput('')
        setSpendCategory('')
        setSpendImpulse(false)
        showToast('Spend logged')
      }
    } catch { showToast('Failed to log spend') }
    setSpendLogging(false)
  }

  // ── Bill voice input ─────────────────────────────────────────────────────
  const startBillListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Voice input not supported. Try Chrome or Safari.'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = false
    recognition.onstart = () => setBillListening(true)
    recognition.onend = () => setBillListening(false)
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript
      setBillVoiceTranscript(transcript); setBillParsing(true)
      try {
        const res = await loggedFetch('/api/parse-bill', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        })
        const parsed = await res.json()
        if (parsed.name) setNewBillName(parsed.name)
        if (parsed.amount != null) setNewBillAmount(String(parsed.amount))
        if (parsed.due_day != null) setNewBillDueDay(String(parsed.due_day))
        if (parsed.frequency) setNewBillFrequency(parsed.frequency)
        if (parsed.category) {
          const matched = BILL_CATEGORIES.find(c => c.toLowerCase() === parsed.category.toLowerCase())
          if (matched) setNewBillCategory(matched)
        }
      } catch (err) { console.error('[bill voice] parse error:', err) }
      setBillParsing(false)
    }
    recognition.onerror = () => setBillListening(false)
    billRecognitionRef.current = recognition; recognition.start()
  }

  const stopBillListening = () => { billRecognitionRef.current?.stop(); setBillListening(false) }

  // ── Computed values ──────────────────────────────────────────────────────
  const monthlyTotal = bills.reduce((sum, b) => {
    const amt = parseFloat(b.amount) || 0
    if (b.frequency === 'weekly') return sum + amt * 4.33
    if (b.frequency === 'yearly') return sum + amt / 12
    return sum + amt // monthly
  }, 0)

  const billsByCategory = {}
  bills.forEach(b => {
    const cat = b.category || 'Other'
    if (!billsByCategory[cat]) billsByCategory[cat] = []
    billsByCategory[cat].push(b)
  })

  const today = new Date().getDate()
  const isDueSoon = (dueDay) => dueDay != null && dueDay >= today && dueDay <= today + 3
  const largestBill = bills.length ? bills.reduce((max, b) => parseFloat(b.amount) > parseFloat(max.amount) ? b : max, bills[0]) : null

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <TabErrorBoundary tabName="Finance">
      <div className={styles.view}>

        {/* Sub-tab nav */}
        <div style={{ display: 'flex', gap: 6, padding: '12px 14px 0', overflowX: 'auto' }}>
          {[['bills','Bills'],['budget','Budget'],['plans','Plans'],['knowledge','Knowledge'],['learn','Learn'],['insights','Insights']].map(([id, label]) => {
            const isActive = financeSub === id
            return (
              <button key={id} onClick={() => setFinanceSub(id)}
                style={{
                  padding: '5px 12px', borderRadius: 20, whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                  background: isActive ? 'rgba(255,102,68,0.15)' : '#3E3228',
                  color: isActive ? '#FF6644' : 'rgba(245,240,227,0.32)',
                  border: isActive ? '1px solid rgba(255,102,68,0.25)' : '1px solid rgba(245,240,227,0.12)',
                  fontFamily: "'Figtree', sans-serif", fontSize: 14, fontWeight: isActive ? 500 : 400,
                }}>
                {label}
              </button>
            )
          })}
        </div>

        {/* ── BILLS ── */}
        {financeSub === 'bills' && (
          <>
            {billsLoading ? (
              <div style={{ padding: '12px 14px', paddingBottom: 80 }}>
                <SkeletonCard lines={3} />
                <SkeletonCard lines={3} />
              </div>
            ) : billsError ? (
              <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
                <ErrorState message="Couldn't load your data." onRetry={() => { setBillsError(false); fetchBills(user.id) }} />
              </div>
            ) : bills.length === 0 ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px 0', marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(245,240,227,0.32)', fontFamily: "'Figtree', sans-serif" }}>Finance</span>
                    <h1 style={{ margin: '2px 0 0', fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 600, color: '#F5F0E3' }}>Bills</h1>
                    <p className={styles.financeTotal}>{fmtMoney(monthlyTotal)}<span className={styles.financeTotalSub}>/mo</span></p>
                  </div>
                  <button onClick={() => setShowAddBillModal(true)} className={styles.addTaskBtn}>+ Add bill</button>
                </div>
                <EmptyState
                  customIcon={<Receipt size={32} weight="fill" color="#FF6644" />}
                  headline="No bills tracked yet"
                  subtext="Add your first bill to start tracking."
                  ctaLabel="+ Add bill"
                  onCtaClick={() => setShowAddBillModal(true)}
                />
              </>
            ) : (
            <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px 0', marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(245,240,227,0.32)', fontFamily: "'Figtree', sans-serif" }}>Finance</span>
                <h1 style={{ margin: '2px 0 0', fontFamily: "'Sora', sans-serif", fontSize: 20, fontWeight: 600, color: '#F5F0E3' }}>Bills</h1>
                <p className={styles.financeTotal}>{fmtMoney(monthlyTotal)}<span className={styles.financeTotalSub}>/mo</span></p>
              </div>
              <button onClick={() => setShowAddBillModal(true)} className={styles.addTaskBtn}>+ Add bill</button>
            </div>

            {/* Income setup card - shows when monthly_income is null */}
            {!profile?.monthly_income && (
              <div className={styles.budgetSetupCard}>
                <p className={styles.budgetSetupLabel}>What's your monthly take-home pay?</p>
                <div className={styles.incomeInputRow}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', color: 'rgba(245,240,227,0.4)' }}>$</span>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    step="1"
                    value={monthlyIncomeInput}
                    onChange={e => setMonthlyIncomeInput(e.target.value)}
                    style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', color: '#F5F0E3' }}
                    className={styles.incomeInput}
                  />
                </div>
                <div className={styles.toggleRow} style={{ marginTop: '14px', marginBottom: '14px' }}>
                  {[['weekly','Weekly'],['biweekly','Bi-weekly'],['bimonthly','Twice/mo'],['monthly','Monthly']].map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setIncomeFrequency(val)}
                      className={`${styles.toggleBtn} ${incomeFrequency === val ? styles.toggleBtnActive : ''}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
                <button
                  className={styles.addTaskBtn}
                  onClick={async () => {
                    const val = parseFloat(monthlyIncomeInput) || 0
                    if (val > 0) {
                      const ok = await patchSettings({ monthly_income: val, income_frequency: incomeFrequency })
                      if (ok) {
                        setProfile(prev => ({ ...prev, monthly_income: val, income_frequency: incomeFrequency }))
                        setMonthlyIncomeInput('')
                        showToast('Income saved')
                      } else {
                        showToast('Failed to save income')
                      }
                    }
                  }}
                >
                  Save
                </button>
              </div>
            )}

            <>
                {/* Bills by category */}
                {Object.entries(billsByCategory).map(([cat, catBills]) => (
                  <div key={cat} className={styles.financeCatGroup}>
                    <p className={styles.financeCatLabel}>{cat}</p>
                    {catBills.map(bill => (
                      <div key={bill.id} className={styles.billCard}>
                        <div className={styles.billInfo}>
                          <span className={styles.billName}>{bill.name}</span>
                          <div className={styles.billMeta}>
                            {bill.due_day && (
                              <span className={`${styles.billDue} ${isDueSoon(bill.due_day) ? styles.billDueSoon : ''}`}>
                                {isDueSoon(bill.due_day) ? '⚡ ' : ''}Due {bill.due_day}{bill.due_day === 1 ? 'st' : bill.due_day === 2 ? 'nd' : bill.due_day === 3 ? 'rd' : 'th'}
                              </span>
                            )}
                            <span className={styles.billFreq}>{bill.frequency}</span>
                            {bill.category && <span className={styles.billCatLabel}>{bill.category}</span>}
                            <span className={bill.autopay ? styles.billAutopayOn : styles.billAutopayOff}>
                              {bill.autopay ? 'Autopay on' : 'Manual'}
                            </span>
                          </div>
                        </div>
                        <div className={styles.billRight}>
                          <span className={styles.billAmount}>{fmtMoney(bill.amount)}</span>
                          <button onClick={() => deleteBill(bill.id)} className={styles.billDelete}>×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}

                {/* Category breakdown bars */}
                {monthlyTotal > 0 && (
                  <div className={styles.financeBreakdown}>
                    <p className={styles.financeBreakdownLabel}>Breakdown</p>
                    {Object.entries(billsByCategory).map(([cat, catBills]) => {
                      const catTotal = catBills.reduce((s, b) => s + parseFloat(b.amount), 0)
                      const pct = Math.round((catTotal / monthlyTotal) * 100)
                      return (
                        <div key={cat} className={styles.financeBar}>
                          <div className={styles.financeBarMeta}>
                            <span className={styles.financeBarCat}>{cat}</span>
                            <span className={styles.financeBarAmt}>{fmtMoney(catTotal)}</span>
                          </div>
                          <div className={styles.financeBarTrack}>
                            <div className={styles.financeBarFill} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Bottom insight */}
                {largestBill && (
                  <div className={styles.financeInsight}>
                    Your largest expense is <strong>{largestBill.name}</strong> at <strong>{fmtMoney(largestBill.amount)}/mo</strong>.
                  </div>
                )}
              </>
            </>
            )}
          </>
        )}

        {/* ── BUDGET ── */}
        {financeSub === 'budget' && (() => {
          const incomeSource = profile?.monthly_income || monthlyIncome || 0
          const freqDays = { weekly: 7, biweekly: 14, bimonthly: 15, monthly: 30 }[profile?.income_frequency || incomeFrequency] || 30
          const freqMultiplier = { weekly: 4.33, biweekly: 2.17, bimonthly: 2, monthly: 1 }[profile?.income_frequency || incomeFrequency] || 1
          const normalizedIncome = incomeSource * freqMultiplier
          const surplus = normalizedIncome - monthlyTotal
          // Budget plan modifier
          const savePct = budgetPlan === 'Pay Yourself First' ? 0.2 : budgetPlan === '80/20' ? 0.2 : budgetPlan === '50/30/20' ? 0.2 : 0
          const spendable = surplus * (1 - savePct)
          const dailyNumber = normalizedIncome > 0 ? Math.max(0, spendable / freqDays) : 0
          const remaining = dailyNumber - todaySpendTotal
          return (
            <div className={styles.budgetPanel}>
              {normalizedIncome > 0 ? (
                <div className={styles.dailyHero}>
                  <div className={styles.dailyHeroLabel}>Daily number</div>
                  <div className={styles.dailyHeroAmount}>{fmtMoney(dailyNumber)}</div>
                  <div className={styles.dailyStats}>
                    <div className={styles.dailyStat}>
                      <span className={styles.dailyStatLabel}>Spent today</span>
                      <span className={styles.dailyStatAmt}>{fmtMoney(todaySpendTotal)}</span>
                    </div>
                    <div className={styles.dailyStatDivider} />
                    <div className={styles.dailyStat}>
                      <span className={styles.dailyStatLabel}>Remaining</span>
                      <span className={`${styles.dailyStatAmt} ${remaining < 0 ? styles.dailyStatNeg : ''}`}>
                        {remaining < 0 ? '-' : ''}{fmtMoney(Math.abs(remaining))}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Income setup card */
                <div className={styles.budgetSetupCard}>
                  <p className={styles.budgetSetupLabel}>What's your take-home pay?</p>
                  <div className={styles.incomeInputRow}>
                    <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', color: 'rgba(245,240,227,0.4)' }}>$</span>
                    <input
                      type="number" placeholder="0" min="0" step="1"
                      value={monthlyIncomeInput}
                      onChange={e => setMonthlyIncomeInput(e.target.value)}
                      style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', color: '#F5F0E3' }}
                      className={styles.incomeInput}
                    />
                  </div>
                  <div className={styles.toggleRow} style={{ marginTop: '14px', marginBottom: '14px' }}>
                    {[['weekly','Weekly'],['biweekly','Bi-weekly'],['bimonthly','Twice/mo'],['monthly','Monthly']].map(([val, lbl]) => (
                      <button key={val} type="button" onClick={() => setIncomeFrequency(val)}
                        className={`${styles.toggleBtn} ${incomeFrequency === val ? styles.toggleBtnActive : ''}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <button className={styles.addTaskBtn} onClick={async () => {
                    const val = parseFloat(monthlyIncomeInput) || 0
                    if (val > 0 && user) {
                      const ok = await patchSettings({ monthly_income: val, income_frequency: incomeFrequency })
                      if (ok) {
                        setProfile(prev => ({ ...prev, monthly_income: val, income_frequency: incomeFrequency }))
                        setMonthlyIncome(val)
                        setMonthlyIncomeInput('')
                        showToast('Income saved')
                      }
                    }
                  }}>Save income</button>
                </div>
              )}

              {/* Budget plan pills */}
              {normalizedIncome > 0 && (
                <div className={styles.budgetPlanPills}>
                  {['Pay Yourself First', '50/30/20', '80/20', 'Zero-based'].map(plan => (
                    <button key={plan} type="button"
                      className={`${styles.budgetPlanPill} ${budgetPlan === plan ? styles.budgetPlanPillActive : ''}`}
                      onClick={() => {
                        setBudgetPlan(plan)
                        if (typeof localStorage !== 'undefined') localStorage.setItem('fb_budget_plan', plan)
                      }}>{plan}</button>
                  ))}
                </div>
              )}

              {/* Quick Spend Log */}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Log a spend</label>
                <form onSubmit={logSpend} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    type="number" placeholder="$0.00" min="0" step="0.01"
                    value={spendAmount}
                    onChange={e => setSpendAmount(e.target.value)}
                    className={styles.fieldInput}
                    style={{ fontFamily: 'Sora, sans-serif', fontSize: '1.4rem', fontWeight: 300, color: '#F5F0E3', textAlign: 'center' }}
                  />
                  <div className={styles.toggleRow} style={{ flexWrap: 'wrap' }}>
                    {['Food','Transport','Shopping','Entertainment','Bills','Other'].map(c => (
                      <button key={c} type="button" onClick={() => setSpendCategory(c === spendCategory ? '' : c)}
                        className={`${styles.toggleBtn} ${spendCategory === c ? styles.toggleBtnActive : ''}`}
                        style={{ fontSize: '0.78rem', padding: '5px 10px' }}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text" placeholder="Description (optional)"
                    value={spendInput}
                    onChange={e => setSpendInput(e.target.value)}
                    className={styles.fieldInput}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button type="button" onClick={() => setSpendImpulse(v => !v)}
                      className={`${styles.toggleBtn} ${spendImpulse ? styles.spendImpulseActive : ''}`}>
                      Impulse buy?
                    </button>
                    <button type="submit" className={styles.addTaskBtn} disabled={!spendAmount || spendLogging}
                      style={{ flex: 1, opacity: (!spendAmount || spendLogging) ? 0.5 : 1 }}>
                      {spendLogging ? 'Logging…' : 'Log it'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Today's spend entries */}
              {spendLog.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div className={styles.ttSectionLabel}>Today</div>
                  {spendLog.map((entry, i) => (
                    <div key={entry.id || i} className={styles.spendEntry}>
                      <div className={styles.spendEntryLeft}>
                        {entry.impulse && <span className={styles.spendImpulseBadge}>Impulse</span>}
                        <span className={styles.spendEntryDesc}>{entry.description || entry.category || 'Spend'}</span>
                        {entry.category && entry.description && <span className={styles.billCatLabel}>{entry.category}</span>}
                        <span className={styles.spendEntryTime}>
                          {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={styles.spendEntryAmt}>{fmtMoney(entry.amount)}</span>
                    </div>
                  ))}
                  <div className={styles.spendTodayTotal}>Spent today: {fmtMoney(todaySpendTotal)}</div>
                </div>
              )}

              {/* 50/30/20 breakdown */}
              {normalizedIncome > 0 && (
                <>
                  <div className={styles.budgetCard}>
                    <p className={styles.financeBreakdownLabel}>
                      {budgetPlan === 'Pay Yourself First' ? 'Pay Yourself First plan' :
                       budgetPlan === '80/20' ? '80/20 plan' :
                       budgetPlan === 'Zero-based' ? 'Zero-based allocation' :
                       '50 / 30 / 20 breakdown'}
                    </p>
                    {budgetPlan === '50/30/20' && [
                      { label: 'Needs', pct: 50, desc: 'Rent, groceries, bills' },
                      { label: 'Wants', pct: 30, desc: 'Dining, subscriptions, fun' },
                      { label: 'Savings', pct: 20, desc: 'Emergency fund, investments' },
                    ].map(({ label, pct, desc }) => (
                      <div key={label} className={styles.budgetRow}>
                        <div>
                          <span className={styles.budgetRowLabel}>{label} <span className={styles.budgetRowPct}>({pct}%)</span></span>
                          <span className={styles.budgetRowDesc}>{desc}</span>
                        </div>
                        <span className={styles.budgetRowAmt}>{fmtMoney(normalizedIncome * pct / 100)}</span>
                      </div>
                    ))}
                    {budgetPlan === 'Pay Yourself First' && [
                      { label: 'Save first', pct: 20, desc: 'Non-negotiable savings transfer' },
                      { label: 'Bills & needs', pct: 50, desc: 'Fixed + essential expenses' },
                      { label: 'Free spend', pct: 30, desc: 'Whatever is left' },
                    ].map(({ label, pct, desc }) => (
                      <div key={label} className={styles.budgetRow}>
                        <div>
                          <span className={styles.budgetRowLabel}>{label}</span>
                          <span className={styles.budgetRowDesc}>{desc}</span>
                        </div>
                        <span className={styles.budgetRowAmt}>{fmtMoney(normalizedIncome * pct / 100)}</span>
                      </div>
                    ))}
                    {budgetPlan === '80/20' && [
                      { label: 'Spending', pct: 80, desc: 'Bills, food, life' },
                      { label: 'Savings', pct: 20, desc: 'Automatic, no excuses' },
                    ].map(({ label, pct, desc }) => (
                      <div key={label} className={styles.budgetRow}>
                        <div>
                          <span className={styles.budgetRowLabel}>{label}</span>
                          <span className={styles.budgetRowDesc}>{desc}</span>
                        </div>
                        <span className={styles.budgetRowAmt}>{fmtMoney(normalizedIncome * pct / 100)}</span>
                      </div>
                    ))}
                    {budgetPlan === 'Zero-based' && [
                      { label: 'Fixed bills', amt: monthlyTotal, desc: 'Tracked in Bills tab' },
                      { label: 'Savings (20%)', amt: normalizedIncome * 0.2, desc: 'Savings target' },
                      { label: 'Remaining', amt: Math.max(0, normalizedIncome - monthlyTotal - normalizedIncome * 0.2), desc: 'Discretionary' },
                    ].map(({ label, amt, desc }) => (
                      <div key={label} className={styles.budgetRow}>
                        <div>
                          <span className={styles.budgetRowLabel}>{label}</span>
                          <span className={styles.budgetRowDesc}>{desc}</span>
                        </div>
                        <span className={styles.budgetRowAmt}>{fmtMoney(amt)}</span>
                      </div>
                    ))}
                    <div className={styles.budgetRow}>
                      <div>
                        <span className={styles.budgetRowLabel}>Fixed bills</span>
                        <span className={styles.budgetRowDesc}>Tracked in Bills tab</span>
                      </div>
                      <span className={styles.budgetRowAmt}>{fmtMoney(monthlyTotal)}<span className={styles.financeTotalSub}>/mo</span></span>
                    </div>
                  </div>
                  {(() => {
                    const diff = normalizedIncome - monthlyTotal
                    return (
                      <div className={styles.budgetCard}>
                        <div className={styles.budgetRow} style={{ borderBottom: 'none' }}>
                          <span className={styles.budgetRowLabel}>{diff >= 0 ? 'Surplus' : 'Deficit'} after fixed bills</span>
                          <span className={diff >= 0 ? styles.surplusPositive : styles.surplusNegative}>
                            {diff >= 0 ? '+' : ''}{fmtMoney(diff)}
                          </span>
                        </div>
                      </div>
                    )
                  })()}
                  {/* Income edit */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Income <span className={styles.fieldLabelOptional}>— update</span></label>
                    <div className={styles.quickRow}>
                      <input type="number" placeholder="Take-home" min="0" step="1"
                        value={monthlyIncomeInput}
                        onChange={e => setMonthlyIncomeInput(e.target.value)}
                        className={styles.fieldInput} style={{ maxWidth: '140px' }} />
                      <select className={styles.fieldInput} style={{ maxWidth: '120px' }}
                        value={profile?.income_frequency || incomeFrequency}
                        onChange={e => setIncomeFrequency(e.target.value)}>
                        <option value="weekly">Weekly</option>
                        <option value="biweekly">Bi-weekly</option>
                        <option value="bimonthly">Twice/mo</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <button className={styles.addTaskBtn} onClick={async () => {
                        const val = parseFloat(monthlyIncomeInput) || 0
                        if (val > 0) {
                          const ok = await patchSettings({ monthly_income: val, income_frequency: incomeFrequency })
                          if (ok) {
                            setProfile(prev => ({ ...prev, monthly_income: val, income_frequency: incomeFrequency }))
                            setMonthlyIncome(val)
                            setMonthlyIncomeInput('')
                            showToast('Income updated')
                          }
                        }
                      }}>Update</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* ── PLANS ── */}
        {financeSub === 'plans' && (
          <div style={{ padding: '12px 14px 80px' }}>
            {[
              {
                key: 'debt', icon: '💳', title: 'Debt payoff', desc: 'Enter your balance and rate. See exactly when you\'ll be free.',
                fields: [
                  { key: 'debtBal', label: 'Balance ($)', placeholder: '5000' },
                  { key: 'debtRate', label: 'APR (%)', placeholder: '18.9' },
                  { key: 'debtPmt', label: 'Monthly payment ($)', placeholder: '200' },
                ],
                compute: (v) => {
                  const balance = parseFloat(v.debtBal) || 0
                  const rate = (parseFloat(v.debtRate) || 0) / 100 / 12
                  const payment = parseFloat(v.debtPmt) || 0
                  if (!balance || !payment) return null
                  if (rate === 0) return { lines: [`${Math.ceil(balance / payment)} months`, `${fmtMoney(balance)} total paid`] }
                  if (payment <= balance * rate) return { lines: ['Payment too low', 'Increase payment above interest charged'] }
                  const months = Math.ceil(-Math.log(1 - (balance * rate) / payment) / Math.log(1 + rate))
                  const totalPaid = payment * months
                  const interest = totalPaid - balance
                  return { lines: [`${months} months to payoff`, `${fmtMoney(interest)} in interest`, `${fmtMoney(totalPaid)} total paid`] }
                },
              },
              {
                key: 'ef', icon: '⛄', title: 'Emergency fund', desc: 'Pick your target. See how long it takes to get there.',
                fields: [{ key: 'efExp', label: 'Monthly expenses ($)', placeholder: '3000' }],
                selector: { key: 'efMonths', label: 'Coverage target', options: ['3', '6', '9', '12'], suffix: ' months' },
                compute: (v) => {
                  const exp = parseFloat(v.efExp) || 0
                  const months = parseInt(v.efMonths) || 3
                  if (!exp) return null
                  const goal = exp * months
                  const monthly = goal / 12
                  return { lines: [fmtMoney(goal) + ' goal', `Save ${fmtMoney(monthly)}/mo → reach in 1 year`, `Save ${fmtMoney(monthly / 2)}/mo → reach in 2 years`] }
                },
              },
              {
                key: 'sub', icon: '🔄', title: 'Subscription audit', desc: 'What your subscriptions actually cost over 1, 5, and 10 years.',
                fields: [{ key: 'subMo', label: 'Monthly cost ($)', placeholder: '15.99' }],
                compute: (v) => {
                  const mo = parseFloat(v.subMo) || 0
                  if (!mo) return null
                  const incomeForRate = profile?.monthly_income || monthlyIncome || 0
                  const hourly = incomeForRate > 0 ? incomeForRate / 160 : 0
                  const hoursLine = hourly > 0 ? `${(mo / hourly).toFixed(1)} hours of work/mo` : null
                  const lines = [`${fmtMoney(mo * 12)}/year`, `${fmtMoney(mo * 60)} over 5 years`, `${fmtMoney(mo * 120)} over 10 years`]
                  if (hoursLine) lines.push(hoursLine)
                  return { lines }
                },
              },
              {
                key: 'ci', icon: '📈', title: 'Compound interest', desc: 'Small monthly amounts. See what they become over time.',
                fields: [
                  { key: 'ciPrincipal', label: 'Principal ($)', placeholder: '5000' },
                  { key: 'ciRate', label: 'Annual rate (%)', placeholder: '7' },
                  { key: 'ciYears', label: 'Years', placeholder: '20' },
                  { key: 'ciMonthly', label: 'Monthly contribution ($)', placeholder: '100' },
                ],
                compute: (v) => {
                  const p = parseFloat(v.ciPrincipal) || 0
                  const r = (parseFloat(v.ciRate) || 0) / 100
                  const t = parseFloat(v.ciYears) || 0
                  const pmt = parseFloat(v.ciMonthly) || 0
                  if ((!p && !pmt) || !r || !t) return null
                  const rMonthly = r / 12
                  const n = t * 12
                  const futureP = p * Math.pow(1 + r, t)
                  const futurePmt = pmt > 0 ? pmt * (Math.pow(1 + rMonthly, n) - 1) / rMonthly : 0
                  const final = futureP + futurePmt
                  const contributed = p + pmt * n
                  const gained = final - contributed
                  return {
                    lines: [fmtMoney(final) + ' final value', `${fmtMoney(contributed)} contributed`, `${fmtMoney(gained)} in interest`],
                    bar: { fill: Math.round((contributed / final) * 100), total: final },
                  }
                },
              },
              {
                key: 'ab', icon: '🎯', title: 'Auto-budget (50/30/20)', desc: 'Pulls your income and bills. Builds your budget automatically.',
                fields: [{ key: 'abIncome', label: 'Monthly income ($)', placeholder: '4000' }],
                compute: (v) => {
                  const inc = parseFloat(v.abIncome) || profile?.monthly_income || monthlyIncome || 0
                  if (!inc) return null
                  const needsAlloc = inc * 0.5
                  const billsTotal = monthlyTotal
                  const needsRemaining = needsAlloc - billsTotal
                  return {
                    lines: [
                      `Needs 50%: ${fmtMoney(needsAlloc)}`,
                      `  Bills: ${fmtMoney(billsTotal)} · Remaining: ${fmtMoney(Math.max(0, needsRemaining))}`,
                      `Wants 30%: ${fmtMoney(inc * 0.3)}`,
                      `Savings 20%: ${fmtMoney(inc * 0.2)}`,
                    ],
                  }
                },
              },
            ].map(card => {
              const isOpen = expandedPlanCalc === card.key
              const vals = {
                ...planCalcInputs[card.key],
                ...(card.selector ? { [card.selector.key]: (planCalcInputs[card.key] || {})[card.selector.key] || card.selector.options[0] } : {}),
                ...(card.key === 'ab' && !planCalcInputs?.ab?.abIncome ? { abIncome: String(profile?.monthly_income || monthlyIncome || '') } : {}),
              }
              const result = isOpen ? card.compute(vals) : null
              return (
                <div key={card.key} className={`${styles.learnCard} ${isOpen ? styles.learnCardExpanded : ''}`}>
                  <div className={styles.learnCardHeader} onClick={() => setExpandedPlanCalc(isOpen ? null : card.key)}>
                    <span className={styles.learnCardIcon}>{card.icon}</span>
                    <span className={styles.learnCardTitle}>{card.title}</span>
                    <span className={styles.learnCardChevron}>▼</span>
                  </div>
                  {card.desc && <p style={{ fontFamily: 'Figtree, sans-serif', fontSize: '11px', color: '#F5F0E350', margin: '0 0 8px', padding: '0 14px 0 42px', lineHeight: 1.4 }}>{card.desc}</p>}
                  {isOpen && (
                    <div className={styles.learnCardContent}>
                      {card.fields.map(f => (
                        <div key={f.key} className={styles.fieldGroup} style={{ marginBottom: 10 }}>
                          <label className={styles.fieldLabel}>{f.label}</label>
                          <input
                            type="number" placeholder={f.placeholder}
                            value={vals[f.key] || ''}
                            onChange={e => setPlanCalcInputs(prev => ({ ...prev, [card.key]: { ...(prev[card.key] || {}), [f.key]: e.target.value } }))}
                            className={styles.fieldInput}
                          />
                        </div>
                      ))}
                      {card.selector && (
                        <div className={styles.fieldGroup} style={{ marginBottom: 10 }}>
                          <label className={styles.fieldLabel}>{card.selector.label}</label>
                          <div className={styles.toggleRow}>
                            {card.selector.options.map(opt => (
                              <button key={opt} type="button"
                                className={`${styles.toggleBtn} ${vals[card.selector.key] === opt ? styles.toggleBtnActive : ''}`}
                                onClick={() => setPlanCalcInputs(prev => ({ ...prev, [card.key]: { ...(prev[card.key] || {}), [card.selector.key]: opt } }))}>
                                {opt}{card.selector.suffix}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {result && (
                        <div className={styles.planCalcResult}>
                          {result.lines.map((line, i) => (
                            <div key={i} className={i === 0 ? styles.planCalcResultMain : styles.planCalcResultSub}>{line}</div>
                          ))}
                          {result.bar && (
                            <div className={styles.planCalcBar}>
                              <div className={styles.planCalcBarFill} style={{ width: `${result.bar.fill}%` }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── KNOWLEDGE ── */}
        {financeSub === 'knowledge' && (() => {
          const KNOWLEDGE_CARDS = [
            {
              id: 'pay-first',
              tag: 'Savings',
              title: 'Pay yourself first',
              body: `Move money to savings the moment you get paid — before bills, before anything. You never miss what you never see.`,
            },
            {
              id: '50-30-20',
              tag: 'Budgeting',
              title: 'The 50/30/20 rule',
              body: `50% needs, 30% wants, 20% savings and debt. Use it as a starting point, not scripture.`,
            },
            {
              id: 'impulse',
              tag: 'Impulse',
              title: 'The 72-hour rule',
              body: `Wait 72 hours before any non-essential purchase. Most urges disappear — the ones that don't are worth it.`,
            },
            {
              id: 'credit-util',
              tag: 'Credit',
              title: 'Credit utilization',
              body: `Keep balances below 30% of your limit — ideally under 10%. This one factor is 30% of your score.`,
            },
            {
              id: 'emergency',
              tag: 'Savings',
              title: 'Emergency fund first',
              body: `Build a $1,000 buffer before paying extra on debt. Build 3–6 months of expenses before investing.`,
            },
            {
              id: 'subscriptions',
              tag: 'Spending',
              title: 'Subscription creep',
              body: `Audit every recurring charge every 6 months. Cancel anything you haven't opened in 30 days.`,
            },
            {
              id: 'system',
              tag: 'System',
              title: 'Automate everything',
              body: `Automate savings on payday, minimums on debt, and bills. A system that runs without willpower is the goal.`,
            },
            {
              id: 'sinking',
              tag: 'Budgeting',
              title: 'Sinking funds',
              body: `Divide big annual bills by 12 and transfer that amount monthly. When the bill arrives, the money is already there.`,
            },
          ]
          const filters = ['All', 'Budgeting', 'Spending', 'Credit', 'Savings', 'Impulse', 'System']
          const filtered = knowledgeFilter === 'All' ? KNOWLEDGE_CARDS : KNOWLEDGE_CARDS.filter(c => c.tag === knowledgeFilter)
          return (
            <div style={{ paddingBottom: 80 }}>
              <div className={styles.fkFilterRow}>
                {filters.map(f => (
                  <button key={f} className={`${styles.fkFilterChip} ${knowledgeFilter === f ? styles.fkFilterChipActive : ''}`}
                    onClick={() => setKnowledgeFilter(f)}>{f}</button>
                ))}
              </div>
              <div style={{ padding: '0 14px' }}>
                {filtered.map(card => (
                  <div key={card.id} className={styles.fkCard}>
                    <div className={styles.fkCardTag}>{card.tag}</div>
                    <div className={styles.fkCardTitle}>{card.title}</div>
                    <div className={styles.fkCardBody}>{card.body}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {/* ── LEARN ── */}
        {financeSub === 'learn' && (() => {
          const GUIDES = [
            { id: 'start-budget', tag: 'Guides', title: 'Build your first budget in 20 minutes', desc: `A step-by-step walkthrough for people who have never budgeted before.` },
            { id: 'debt-plan', tag: 'Guides', title: 'Make a debt payoff plan that actually works', desc: `Avalanche vs snowball, what to pay first, and how to stay motivated.` },
            { id: 'credit-score', tag: 'Guides', title: 'Understand your credit score in plain English', desc: 'What the 5 factors are, what matters most, and how to move the number.' },
            { id: 'emergency', tag: 'Guides', title: 'How to build an emergency fund', desc: 'Starting from zero, step by step, even on a tight budget.' },
          ]
          const TOOLS = [
            { id: 'nerdwallet', tag: 'Tools', title: 'NerdWallet', desc: 'Compare credit cards, savings rates, and loans.', href: '#' },
            { id: 'mint', tag: 'Tools', title: 'Credit Karma', desc: 'Free credit score monitoring and alerts.', href: '#' },
            { id: 'ynab', tag: 'Tools', title: 'YNAB', desc: 'Zero-based budgeting for people who want to go deep.', href: '#' },
            { id: 'compound', tag: 'Calculators', title: 'Investor.gov Compound Calculator', desc: 'Official compound interest calculator from the SEC.', href: '#' },
          ]
          const learnFilters = ['All', 'Guides', 'Calculators', 'Research', 'Tools']
          const allItems = [...GUIDES, ...TOOLS]
          const filteredLearn = learnFilter === 'All' ? allItems : allItems.filter(i => i.tag === learnFilter)
          const showGuides = learnFilter === 'All' || learnFilter === 'Guides'
          const showTools = learnFilter === 'All' || learnFilter === 'Calculators' || learnFilter === 'Tools'
          return (
            <div style={{ paddingBottom: 80 }}>
              <div className={styles.fkFilterRow}>
                {learnFilters.map(f => (
                  <button key={f} className={`${styles.fkFilterChip} ${learnFilter === f ? styles.fkFilterChipActive : ''}`}
                    onClick={() => setLearnFilter(f)}>{f}</button>
                ))}
              </div>
              <div style={{ padding: '0 14px' }}>
                {/* Featured */}
                {learnFilter === 'All' && (
                  <div className={styles.flFeatured}>
                    <div className={styles.flFeaturedTag}>Featured</div>
                    <div className={styles.flFeaturedTitle}>The one financial move that changes everything</div>
                    <div className={styles.flFeaturedBody}>Automate your savings the day you get paid. Not the day before bills are due. The day money lands. Even $50/paycheck compounds into a financial cushion most people never build.</div>
                  </div>
                )}
                {/* Quick guides */}
                {showGuides && (
                  <>
                    <div className={styles.flSectionLabel}>Quick guides</div>
                    {GUIDES.map(g => (
                      <div key={g.id} className={styles.flGuideCard}>
                        <div className={styles.flGuideTitle}>{g.title}</div>
                        <div className={styles.flGuideDesc}>{g.desc}</div>
                        <span className={styles.flGuideTag}>{g.tag}</span>
                      </div>
                    ))}
                  </>
                )}
                {/* Tools */}
                {showTools && (
                  <>
                    <div className={styles.flSectionLabel} style={{ marginTop: showGuides ? 24 : 0 }}>Free tools & resources</div>
                    {TOOLS.map(t => (
                      <div key={t.id} className={styles.flToolCard}>
                        <div>
                          <div className={styles.flGuideTitle}>{t.title}</div>
                          <div className={styles.flGuideDesc}>{t.desc}</div>
                        </div>
                        <span className={styles.flToolTag}>{t.tag}</span>
                      </div>
                    ))}
                  </>
                )}
                {/* Coach CTA */}
                <div className={styles.flCoachCta}>
                  <div className={styles.flCoachTitle}>Want a personalized plan?</div>
                  <div className={styles.flCoachBody}>Ask Cinis to build a custom financial plan based on your income, bills, and goals.</div>
                  <button className={styles.addTaskBtn} style={{ marginTop: 12 }}
                    onClick={() => setFinanceSub('insights')}>See my financial health →</button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* ── INSIGHTS ── */}
        {financeSub === 'insights' && (() => {
          const totalBills = bills.length
          const autoPayBills = bills.filter(b => b.autopay).length
          const autopayCoverage = totalBills > 0 ? (autoPayBills / totalBills) * 25 : 0
          const billTracking = totalBills > 0 ? 25 : 0
          const budgetSet = (profile?.monthly_income || monthlyIncome) > 0 ? 25 : 0
          const spendLogged = spendLog.length > 0 ? 25 : 0
          const score = Math.round(autopayCoverage + billTracking + budgetSet + spendLogged)
          const HP = '#FF6644'
          const EMBER = '#E8321A'
          const scoreColor = score <= 40 ? EMBER : score <= 70 ? '#FFB800' : HP
          const circumference = 2 * Math.PI * 54
          const strokeDash = (score / 100) * circumference

          const CATEGORIES = [
            { label: 'Bill tracking', pts: billTracking, max: 25, tip: billTracking < 25 ? 'Add your recurring bills to get started' : 'All bills tracked' },
            { label: 'Budget set', pts: budgetSet, max: 25, tip: budgetSet < 25 ? 'Set your income in the Budget tab' : 'Income is set' },
            { label: 'Autopay coverage', pts: Math.round(autopayCoverage), max: 25, tip: autopayCoverage < 25 ? `${autoPayBills}/${totalBills} bills on autopay — enable more` : 'All bills automated' },
            { label: 'Spend logged', pts: spendLogged, max: 25, tip: spendLogged < 25 ? 'Log a purchase in Budget today' : 'Spending tracked today' },
          ]

          const tips = []
          if (autopayCoverage < 12.5 && totalBills > 0) {
            const manualBill = bills.find(b => !b.autopay)
            tips.push({ type: 'Alert', icon: '⚡', title: `Turn on autopay for ${manualBill?.name || 'your bills'}`, body: 'Stop missing due dates and late fees. Takes 5 minutes to set up.' })
          }
          if (budgetSet === 0) tips.push({ type: 'Pattern', icon: '💰', title: 'Set your income', body: 'Set your income to unlock your daily spending number.' })
          if (spendLogged === 0) tips.push({ type: 'Pattern', icon: '📊', title: 'Log one purchase today', body: 'Start tracking your money with one entry in Budget.' })
          if (score > 75) tips.push({ type: 'Win', icon: '🏆', title: "You're tracking well", body: 'Consider adding a savings goal. Even $25/week compounds fast.' })
          if (billTracking === 0) tips.push({ type: 'Alert', icon: '🧾', title: 'Track your bills', body: 'Add recurring bills to see where your money goes.' })
          if (tips.length === 0) tips.push({ type: 'Win', icon: '🌟', title: 'Solid foundation', body: 'Income set, bills tracked, autopay on, spending logged.' })

          const fastest80 = CATEGORIES.filter(c => c.pts < c.max).slice(0, 2)

          return (
            <div style={{ padding: '12px 14px 80px' }}>
              {/* Score ring */}
              <div className={styles.fiScoreCard}>
                <div className={styles.fiScoreRing}>
                  <svg width="124" height="124" viewBox="0 0 124 124">
                    <circle cx="62" cy="62" r="54" fill="none" stroke="rgba(245,240,227,0.07)" strokeWidth="10" />
                    <circle cx="62" cy="62" r="54" fill="none"
                      stroke={scoreColor} strokeWidth="10"
                      strokeDasharray={`${strokeDash} ${circumference}`}
                      strokeDashoffset={circumference * 0.25}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dasharray 0.6s ease' }}
                    />
                    <text x="62" y="57" textAnchor="middle" dominantBaseline="central"
                      fill={scoreColor} fontSize="26" fontWeight="700" fontFamily="Sora, sans-serif">{score}</text>
                    <text x="62" y="77" textAnchor="middle" dominantBaseline="central"
                      fill="rgba(245,240,227,0.4)" fontSize="11" fontFamily="Figtree, sans-serif">out of 100</text>
                  </svg>
                </div>
                <div className={styles.fiScoreInfo}>
                  <div className={styles.fiScoreLabel}>Financial health</div>
                  <div className={styles.fiScoreGrade} style={{ color: scoreColor }}>
                    {score <= 40 ? 'Getting started' : score <= 70 ? 'Building up' : score <= 90 ? 'On track' : 'Strong'}
                  </div>
                  <div className={styles.fiScoreDesc}>Score updates as you add bills, log spending, and set your income.</div>
                </div>
              </div>

              {/* How score works */}
              <div className={styles.fiExplainerCard}>
                <div className={styles.fiExplainerTitle}>How your score works</div>
                <div className={styles.fiExplainerBody}>Your score is built from 4 categories, 25 points each. The more you track, the more useful it becomes.</div>
              </div>

              {/* Score breakdown */}
              <div className={styles.fiBreakdownCard}>
                {CATEGORIES.map(cat => (
                  <div key={cat.label} className={styles.fiCatRow}>
                    <div className={styles.fiCatTop}>
                      <span className={styles.fiCatLabel}>{cat.label}</span>
                      <span className={styles.fiCatPts} style={{ color: cat.pts === cat.max ? '#4CAF50' : 'rgba(245,240,227,0.5)' }}>{cat.pts}/{cat.max}</span>
                    </div>
                    <div className={styles.fiCatBar}>
                      <div className={styles.fiCatBarFill} style={{ width: `${(cat.pts / cat.max) * 100}%`, background: cat.pts === cat.max ? '#4CAF50' : HP }} />
                    </div>
                    <div className={styles.fiCatTip}>{cat.tip}</div>
                  </div>
                ))}
              </div>

              {/* Fastest path to 80 */}
              {score < 80 && fastest80.length > 0 && (
                <div className={styles.fiActionCard}>
                  <div className={styles.fiActionTitle}>Fastest path to 80</div>
                  {fastest80.map(cat => (
                    <div key={cat.label} className={styles.fiActionItem}>
                      <span className={styles.fiActionBullet}>→</span>
                      <span>{cat.tip}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* AI observation cards */}
              {tips.slice(0, 3).map((tip, i) => (
                <div key={i} className={`${styles.fiObsCard} ${tip.type === 'Alert' ? styles.fiObsAlert : tip.type === 'Win' ? styles.fiObsWin : styles.fiObsPattern}`}>
                  <div className={styles.fiObsType}>{tip.type}</div>
                  <div className={styles.fiObsIcon}>{tip.icon}</div>
                  <div>
                    <div className={styles.fiObsTitle}>{tip.title}</div>
                    <div className={styles.fiObsBody}>{tip.body}</div>
                  </div>
                </div>
              ))}

              {/* Coach CTA */}
              <div className={styles.flCoachCta}>
                <div className={styles.flCoachTitle}>Get a personalized breakdown</div>
                <div className={styles.flCoachBody}>Ask Cinis what your score means and how to improve it specifically for your situation.</div>
                <button className={styles.addTaskBtn} style={{ marginTop: 12, width: '100%' }}
                  onClick={() => switchTab('checkin')}>Ask Cinis about this →</button>
              </div>
            </div>
          )
        })()}


      </div>

      {/* ADD BILL MODAL */}
      {showAddBillModal && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowAddBillModal(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add bill</h2>
              <div className={styles.modalHeaderRight}>
                <button type="button"
                  onClick={billListening ? stopBillListening : startBillListening}
                  className={`${styles.micBtn} ${billListening ? styles.micBtnActive : ''}`}
                  title={billListening ? 'Stop recording' : 'Speak bill details'}>
                  {billListening ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  ) : (
                    <Microphone size={18} />
                  )}
                </button>
                <button onClick={() => { setShowAddBillModal(false); setBillVoiceTranscript('') }} className={styles.modalClose}>×</button>
              </div>
            </div>
            {(billListening || billParsing || billVoiceTranscript) && (
              <div className={styles.voiceState}>
                {billListening && (
                  <div className={styles.voiceListening}>
                    <span className={styles.voiceDot} /><span className={styles.voiceDot} /><span className={styles.voiceDot} />
                    <span className={styles.voiceListeningText}>Listening...</span>
                  </div>
                )}
                {billParsing && <div className={styles.voiceParsing}>Parsing bill details...</div>}
                {billVoiceTranscript && !billListening && !billParsing && <div className={styles.voiceTranscript}>"{billVoiceTranscript}"</div>}
              </div>
            )}
            <form onSubmit={addBill} className={styles.modalForm}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Bill name</label>
                <input type="text" placeholder="e.g. Netflix, Rent, Electric"
                  value={newBillName} onChange={e => setNewBillName(e.target.value)}
                  className={styles.fieldInput} required autoFocus />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Amount</label>
                <input type="number" placeholder="0.00" min="0" step="0.01"
                  value={newBillAmount} onChange={e => setNewBillAmount(e.target.value)}
                  className={styles.fieldInput} required />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Type</label>
                <div className={styles.toggleRow}>
                  {[['bill','Bill'],['loan','Loan'],['credit_card','Credit Card']].map(([val, lbl]) => (
                    <button key={val} type="button" onClick={() => setBillType(val)}
                      className={`${styles.toggleBtn} ${billType === val ? styles.toggleBtnActive : ''}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              {(billType === 'loan' || billType === 'credit_card') && (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>APR % <span className={styles.fieldLabelOptional}>(optional)</span></label>
                  <input type="number" placeholder="0.00" min="0" step="0.01" max="100"
                    value={billInterestRate} onChange={e => setBillInterestRate(e.target.value)}
                    className={styles.fieldInput} />
                </div>
              )}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Frequency</label>
                <div className={styles.toggleRow}>
                  {['monthly', 'bimonthly', 'weekly', 'yearly'].map(f => (
                    <button key={f} type="button" onClick={() => setNewBillFrequency(f)}
                      className={`${styles.toggleBtn} ${newBillFrequency === f ? styles.toggleBtnActive : ''}`}>
                      {f === 'bimonthly' ? 'Twice/mo' : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              {newBillFrequency === 'bimonthly' ? (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Due days <span className={styles.fieldLabelOptional}>(day of month)</span></label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="number" placeholder="1st date (e.g. 1)" min="1" max="31"
                      value={newBillFirstDate} onChange={e => setNewBillFirstDate(e.target.value)}
                      className={styles.fieldInput} />
                    <input type="number" placeholder="2nd date (e.g. 15)" min="1" max="31"
                      value={newBillSecondDate} onChange={e => setNewBillSecondDate(e.target.value)}
                      className={styles.fieldInput} />
                  </div>
                </div>
              ) : (
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Due day of month <span className={styles.fieldLabelOptional}>(optional)</span></label>
                  <input type="number" placeholder="e.g. 15" min="1" max="31"
                    value={newBillDueDay} onChange={e => setNewBillDueDay(e.target.value)}
                    className={styles.fieldInput} />
                </div>
              )}
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Category</label>
                <div className={styles.quickRow} style={{ flexWrap: 'wrap' }}>
                  {['Housing','Utilities','Transport','Insurance','Subscriptions','Other'].map(cat => (
                    <button key={cat} type="button" onClick={() => setNewBillCategory(cat)}
                      className={`${styles.quickBtn} ${newBillCategory === cat ? styles.quickBtnActive : ''}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Autopay</label>
                <div className={styles.toggleRow}>
                  <button type="button" onClick={() => setNewBillAutopay(true)}
                    className={`${styles.toggleBtn} ${newBillAutopay ? styles.toggleBtnActive : ''}`}>On</button>
                  <button type="button" onClick={() => setNewBillAutopay(false)}
                    className={`${styles.toggleBtn} ${!newBillAutopay ? styles.toggleBtnActive : ''}`}>Manual</button>
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Auto-create task when due</label>
                <div className={styles.toggleRow}>
                  <button type="button" onClick={() => setNewBillAutoTask(true)}
                    className={`${styles.toggleBtn} ${newBillAutoTask ? styles.toggleBtnActive : ''}`}>Yes</button>
                  <button type="button" onClick={() => setNewBillAutoTask(false)}
                    className={`${styles.toggleBtn} ${!newBillAutoTask ? styles.toggleBtnActive : ''}`}>No</button>
                </div>
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Notes <span className={styles.fieldLabelOptional}>(optional)</span></label>
                <input type="text" placeholder="Context, login, account number…"
                  value={newBillNotes} onChange={e => setNewBillNotes(e.target.value)}
                  className={styles.fieldInput} />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Account <span className={styles.fieldLabelOptional}>(optional)</span></label>
                <input type="text" placeholder="e.g. Chase checking"
                  value={newBillAccount} onChange={e => setNewBillAccount(e.target.value)}
                  className={styles.fieldInput} />
              </div>
              <button type="submit" disabled={addingBill || !newBillName.trim() || !newBillAmount} className={styles.modalSubmit}>
                {addingBill ? 'Adding...' : 'Add bill'}
              </button>
            </form>
          </div>
        </div>
      )}
    </TabErrorBoundary>
  )
}
