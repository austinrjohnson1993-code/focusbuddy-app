import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import styles from '../../styles/TabTasks.module.css'

/* ── Helpers ────────────────────────────────────────────────────────────── */
const isToday = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

const isPast = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return d < now
}

const daysOverdue = (dateStr) => {
  if (!dateStr) return 0
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.floor((now - d) / 86400000)
}

const getLocalKey = (suffix) => {
  const d = new Date()
  return `cinis_${suffix}_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ── Component ──────────────────────────────────────────────────────────── */
export default function TabTasks({ user, profile, tasks = [], setTasks, showToast, loggedFetch, switchTab }) {
  const [greet, setGreet] = useState(() => {
    if (typeof localStorage === 'undefined') return true
    return !localStorage.getItem(getLocalKey('greeting_dismissed'))
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [addMode, setAddMode] = useState('single') // 'single' | 'bulk' | 'voice'
  const [addTitle, setAddTitle] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [addDate, setAddDate] = useState('today')
  const [xpId, setXpId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [todayCollapsed, setTodayCollapsed] = useState(() => {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem('cinis_tasks_today_collapsed') === 'true'
  })
  const [doneCollapsed, setDoneCollapsed] = useState(() => {
    if (typeof localStorage === 'undefined') return true
    const v = localStorage.getItem('cinis_tasks_done_collapsed')
    return v === null ? true : v === 'true'
  })
  const [routinesExpanded, setRoutinesExpanded] = useState(false)

  // Fetch tasks on mount if empty
  useEffect(() => {
    if (!user || tasks.length > 0) return
    setLoading(true)
    supabase.from('tasks').select('*').eq('user_id', user.id).eq('archived', false)
      .order('sort_order', { ascending: true, nullsLast: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data && setTasks) setTasks(data) })
      .finally(() => setLoading(false))
  }, [user])

  // ── Actions ──────────────────────────────────────────────────────────────
  const toggle = async (id) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    const newCompleted = !task.completed
    const completedAt = newCompleted ? new Date().toISOString() : null
    if (setTasks) setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: newCompleted, completed_at: completedAt } : t))
    if (newCompleted) { setXpId(id); setTimeout(() => setXpId(null), 1200) }
    await supabase.from('tasks').update({ completed: newCompleted, completed_at: completedAt }).eq('id', id)
  }

  const star = async (id) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return
    if (setTasks) setTasks(prev => prev.map(t => t.id === id ? { ...t, starred: !t.starred } : t))
    await supabase.from('tasks').update({ starred: !task.starred }).eq('id', id)
  }

  const getScheduledDate = () => {
    const now = new Date()
    if (addDate === 'tomorrow') { now.setDate(now.getDate() + 1) }
    else if (addDate === 'week') {
      const day = now.getDay()
      const diff = day === 0 ? 5 : 5 - day
      now.setDate(now.getDate() + (diff > 0 ? diff : 7))
    }
    return now.toISOString().split('T')[0]
  }

  const handleAddSingle = async () => {
    if (!addTitle.trim() || !user) return
    const { data, error } = await supabase.from('tasks').insert({
      user_id: user.id,
      title: addTitle.trim(),
      scheduled_for: getScheduledDate(),
    }).select().single()
    if (!error && data) {
      if (setTasks) setTasks(prev => [data, ...prev])
      setAddTitle('')
      setShowAddForm(false)
      showToast?.('Task added')
    }
  }

  const handleAddBulk = async () => {
    if (!bulkText.trim() || !user) return
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) return
    const scheduled = getScheduledDate()
    const rows = lines.map(title => ({ user_id: user.id, title, scheduled_for: scheduled }))
    const { data, error } = await supabase.from('tasks').insert(rows).select()
    if (!error && data) {
      if (setTasks) setTasks(prev => [...data, ...prev])
      setBulkText('')
      setShowAddForm(false)
      showToast?.(`Added ${data.length} tasks`)
    }
  }

  const dismissGreeting = () => {
    setGreet(false)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getLocalKey('greeting_dismissed'), 'true')
    }
  }

  const toggleTodayCollapsed = () => {
    setTodayCollapsed(v => {
      const next = !v
      if (typeof localStorage !== 'undefined') localStorage.setItem('cinis_tasks_today_collapsed', String(next))
      return next
    })
  }

  const toggleDoneCollapsed = () => {
    setDoneCollapsed(v => {
      const next = !v
      if (typeof localStorage !== 'undefined') localStorage.setItem('cinis_tasks_done_collapsed', String(next))
      return next
    })
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const overdue = tasks.filter(t => !t.completed && !t.archived && isPast(t.scheduled_for))
  const todayTasks = tasks.filter(t => !t.completed && !t.archived && isToday(t.scheduled_for))
    .sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0))
  const routines = tasks.filter(t => !t.completed && isToday(t.scheduled_for) &&
    (t.task_type === 'routine' || (t.recurrence && t.recurrence !== 'none')))
  const completed = tasks.filter(t => t.completed && !t.archived && isToday(t.completed_at))
  const allActive = tasks.filter(t => !t.archived)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const name = profile?.full_name?.split(' ')[0] || 'there'

  // Bills from profile/dashboard — passed through as tasks with type 'bill' or separate
  // For now, bills filtering uses tasks with task_type === 'bill'
  const billsToday = tasks.filter(t => t.task_type === 'bill' && !t.archived && isToday(t.scheduled_for))

  const topOverdue = overdue[0]
  const starredTask = todayTasks.find(t => t.starred)

  // ── Chevron SVG ──────────────────────────────────────────────────────────
  const Chevron = ({ collapsed }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      className={`${styles.chevron} ${collapsed ? styles.chevronCollapsed : ''}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )

  return (
    <div className={styles.wrap}>

      {/* ── Date + Add row ───────────────────────────────────────────── */}
      <div className={styles.dateRow}>
        <span className={styles.dateLabel}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </span>
        <button className={styles.addPill} onClick={() => setShowAddForm(v => !v)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF6644" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add
        </button>
      </div>

      {/* ── Greeting card ────────────────────────────────────────────── */}
      {greet && (
        <div className={styles.greetCard}>
          <button className={styles.greetDismiss} onClick={dismissGreeting}>{'\u2715'}</button>
          <div className={styles.greetTitle}>{greeting}, {name}</div>
          <div className={styles.greetBody}>
            {todayTasks.length > 0
              ? `${todayTasks.length} task${todayTasks.length !== 1 ? 's' : ''} on your list today.`
              : 'Nothing on your list yet. Add something to start.'}
          </div>
        </div>
      )}

      {/* ── Overdue card ─────────────────────────────────────────────── */}
      {topOverdue && (
        <div className={styles.overdueCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className={styles.overdueLabel}>OVERDUE &middot; {daysOverdue(topOverdue.scheduled_for)}d</span>
            {overdue.length > 1 && <span className={styles.overdueMore}>+{overdue.length - 1} more overdue</span>}
          </div>
          <div className={styles.overdueTitle}>{topOverdue.title}</div>
          <div className={styles.overdueBtns}>
            <button className={styles.btnDoNow} onClick={() => toggle(topOverdue.id)}>Do now</button>
            <button className={styles.btnReschedule}>Reschedule</button>
          </div>
        </div>
      )}

      {/* ── Priority card ────────────────────────────────────────────── */}
      {starredTask && (
        <div className={styles.priorityCard}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className={styles.priorityLabel}>PRIORITY</span>
            {starredTask.due_time
              ? <span className={styles.priorityBadge}>Due soon</span>
              : <span className={styles.prioritySub}>Your #1 priority</span>
            }
          </div>
          <div className={styles.priorityTitle}>{starredTask.title}</div>
          <button className={styles.btnFocus} onClick={() => switchTab?.('focus')}>Start focus</button>
        </div>
      )}

      {/* ── Add form ─────────────────────────────────────────────────── */}
      {showAddForm && (
        <div className={styles.addForm}>
          <div className={styles.modeTabs}>
            {['single', 'bulk', 'voice'].map(m => (
              <button key={m} onClick={() => setAddMode(m)}
                className={`${styles.modeTab} ${addMode === m ? styles.modeTabActive : ''}`}>
                {m === 'single' ? 'Single' : m === 'bulk' ? 'Bulk' : 'Voice'}
              </button>
            ))}
          </div>

          {addMode === 'single' && (
            <>
              <input className={styles.addInput} placeholder="Task title..." value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSingle()} />
              <div className={styles.datePills}>
                {['today', 'tomorrow', 'week'].map(d => (
                  <button key={d} onClick={() => setAddDate(d)}
                    className={`${styles.datePill} ${addDate === d ? styles.datePillActive : ''}`}>
                    {d === 'today' ? 'Today' : d === 'tomorrow' ? 'Tomorrow' : 'This week'}
                  </button>
                ))}
              </div>
              <div className={styles.addActions}>
                <button className={styles.btnAdd} onClick={handleAddSingle}>Add task</button>
                <button className={styles.btnCancel} onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </>
          )}

          {addMode === 'bulk' && (
            <>
              <textarea className={styles.addTextarea} placeholder="One task per line..."
                value={bulkText} onChange={e => setBulkText(e.target.value)} />
              <div className={styles.addActions}>
                <button className={styles.btnAdd} onClick={handleAddBulk}>Add all</button>
                <button className={styles.btnCancel} onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </>
          )}

          {addMode === 'voice' && (
            <div className={styles.voiceWrap}>
              <button className={styles.micBtn}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0014 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </button>
              <span className={styles.micLabel}>Tap to speak a task</span>
            </div>
          )}
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {loading && <div className={styles.loadingMsg}>Loading tasks...</div>}

      {/* ── TODAY section ─────────────────────────────────────────────── */}
      <div className={styles.sectionHeader} onClick={toggleTodayCollapsed}>
        <span className={styles.sectionLabel}>TODAY</span>
        <div className={styles.sectionRight}>
          <span className={styles.sectionCount}>{todayTasks.length}</span>
          <Chevron collapsed={todayCollapsed} />
        </div>
      </div>

      {!todayCollapsed && todayTasks.map(t => (
        <div key={t.id} className={styles.taskCard}>
          <div className={styles.circleWrap} onClick={() => toggle(t.id)}>
            <div className={styles.circle} />
          </div>
          <div className={styles.taskInfo}>
            <div className={styles.taskTitle}>{t.title}</div>
            {t.scheduled_for && (() => {
              const d = new Date(t.scheduled_for)
              return d.getHours() !== 0 || d.getMinutes() !== 0
                ? <div className={styles.taskTime}>{d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                : null
            })()}
          </div>
          <div className={styles.starBtn} onClick={() => star(t.id)}>
            <svg width="13" height="13" viewBox="0 0 24 24"
              fill={t.starred ? '#E8321A' : 'none'}
              stroke={t.starred ? '#E8321A' : 'rgba(240,234,214,0.18)'}
              strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          {xpId === t.id && <div className={styles.xpFloat}>+10 XP</div>}
        </div>
      ))}

      {/* ── ROUTINES card ────────────────────────────────────────────── */}
      {routines.length > 0 && (
        <div className={styles.routinesCard}>
          <div className={styles.routinesHeader} onClick={() => setRoutinesExpanded(v => !v)}>
            <div className={styles.routinesLeft}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,214,0.22)" strokeWidth="2" strokeLinecap="round">
                <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" />
                <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
              <span className={styles.routinesLabel}>Routines</span>
              <span className={styles.routinesCount}>{routines.length} today</span>
            </div>
            <Chevron collapsed={!routinesExpanded} />
          </div>
          {routinesExpanded && (
            <div className={styles.routinesList}>
              {routines.map(r => (
                <div key={r.id} className={styles.routineRow}>
                  <div
                    className={r.completed ? styles.routineCircleDone : styles.routineCircle}
                    onClick={() => toggle(r.id)}
                  >
                    {r.completed && (
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                        <path d="M5 12l5 5L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={styles.routineTitle}>{r.title}</span>
                  <span className={styles.routineBadge}>
                    {r.recurrence === 'weekly' ? 'WEEKLY' : 'DAILY'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── BILLS DUE TODAY ──────────────────────────────────────────── */}
      {billsToday.length > 0 && (
        <>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>BILLS DUE TODAY</span>
            <span className={styles.sectionCount}>{billsToday.length}</span>
          </div>
          {billsToday.map(b => (
            <div key={b.id} className={styles.billRow}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#E8321A" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
              <div className={styles.billInfo}>
                <div className={styles.billName}>{b.title}</div>
                <div className={styles.billSub}>Due today{b.autopay ? ' \u00B7 Autopay' : ''}</div>
              </div>
              {b.autopay
                ? <span className={styles.autoBadge}>AUTO</span>
                : <button className={styles.payLink} onClick={() => switchTab?.('finance')}>Pay</button>
              }
            </div>
          ))}
        </>
      )}

      {/* ── COMPLETED TODAY ──────────────────────────────────────────── */}
      {completed.length > 0 && (
        <>
          <div className={styles.sectionHeader} onClick={toggleDoneCollapsed}>
            <span className={styles.sectionLabel}>COMPLETED ({completed.length})</span>
            <Chevron collapsed={doneCollapsed} />
          </div>
          {!doneCollapsed && completed.map(t => (
            <div key={t.id} className={styles.taskCardDone}>
              <div className={styles.circleWrap} onClick={() => toggle(t.id)}>
                <div className={styles.circleDone}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                    <path d="M5 12l5 5L19 7" />
                  </svg>
                </div>
              </div>
              <span className={styles.taskTitleDone}>{t.title}</span>
            </div>
          ))}
        </>
      )}

      {/* ── Momentum bar ─────────────────────────────────────────────── */}
      <div className={styles.momentumBar}>
        <div className={styles.momentumRow}>
          <div className={styles.momentumLeft}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF6644">
              <path d="M12 23c-3.5 0-7-2.5-7-7.5 0-4 3-7.5 5-10.5.3-.4.8-.4 1.1 0C13.5 8 17 11.5 17 15.5c0 5-3.5 7.5-5 7.5z" />
            </svg>
            <span className={styles.momentumCount}>
              {completed.length}/{allActive.filter(t => isToday(t.scheduled_for) || isToday(t.completed_at)).length || allActive.length}
            </span>
            <span className={styles.momentumToday}>today</span>
          </div>
          <span className={styles.momentumRight}>
            {(profile?.total_xp || 0).toLocaleString()} XP &middot; {profile?.current_streak || 0}d streak
          </span>
        </div>
        <div className={styles.momentumTrack}>
          <div
            className={styles.momentumFill}
            style={{ width: `${(completed.length / Math.max(todayTasks.length + completed.length, 1)) * 100}%` }}
          />
        </div>
      </div>

    </div>
  )
}
