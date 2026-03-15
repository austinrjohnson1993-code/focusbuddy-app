import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Dashboard.module.css'

const NAV_ITEMS = [
  { id: 'tasks', label: 'Tasks', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  )},
  { id: 'checkin', label: 'Check-in', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )},
  { id: 'calendar', label: 'Calendar', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  )},
  { id: 'journal', label: 'Journal', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
    </svg>
  )},
]

function computePriorityScore(task) {
  if (task.completed) return 0
  let score = 50
  if (task.due_time) {
    const hoursUntilDue = (new Date(task.due_time) - new Date()) / (1000 * 60 * 60)
    if (hoursUntilDue < 0)       score += 100
    else if (hoursUntilDue < 1)  score += 90
    else if (hoursUntilDue < 2)  score += 75
    else if (hoursUntilDue < 6)  score += 55
    else if (hoursUntilDue < 12) score += 35
    else if (hoursUntilDue < 24) score += 20
  }
  if (task.consequence_level === 'external') score += 40
  score += (task.rollover_count || 0) * 15
  return score
}

function sortByPriority(tasks) {
  return [...tasks]
    .map(t => ({ ...t, priority_score: computePriorityScore(t) }))
    .sort((a, b) => b.priority_score - a.priority_score)
}

function formatDueTime(due_time) {
  if (!due_time) return null
  const due = new Date(due_time)
  const hoursUntil = (due - new Date()) / (1000 * 60 * 60)
  const timeStr = due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (hoursUntil < 0)  return { label: `Overdue · ${timeStr}`, urgent: true }
  if (hoursUntil < 1)  return { label: `Due in ${Math.round(hoursUntil * 60)}m`, urgent: true }
  if (hoursUntil < 3)  return { label: `Due at ${timeStr}`, urgent: true }
  return { label: `Due at ${timeStr}`, urgent: false }
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function tomorrowStr() {
  const t = new Date(); t.setDate(t.getDate() + 1)
  return t.toISOString().split('T')[0]
}

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('tasks')
  const [greeting, setGreeting] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [completing, setCompleting] = useState(null)

  // Add task form
  const [newTitle, setNewTitle] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newDueTime, setNewDueTime] = useState('')
  const [newConsequence, setNewConsequence] = useState('self')
  const [newNotes, setNewNotes] = useState('')
  const [newRecurrence, setNewRecurrence] = useState('none')
  const [adding, setAdding] = useState(false)

  // Voice
  const [listening, setListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [parsing, setParsing] = useState(false)
  const recognitionRef = useRef(null)
  const titleInputRef = useRef(null)

  // Calendar
  const [calView, setCalView] = useState('month')
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
  })
  const [calDay, setCalDay] = useState(null)

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      fetchProfile(session.user.id)
      fetchTasks(session.user.id)
    })
  }, [])

  useEffect(() => {
    if (showAddModal) setTimeout(() => titleInputRef.current?.focus(), 50)
  }, [showAddModal])

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
    else router.push('/onboarding')
  }

  const fetchTasks = async (userId) => {
    const { data } = await supabase
      .from('tasks').select('*').eq('user_id', userId).eq('archived', false)
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  const resetForm = () => {
    setNewTitle(''); setNewDueDate(''); setNewDueTime('')
    setNewConsequence('self'); setNewNotes(''); setNewRecurrence('none')
    setVoiceTranscript('')
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!newTitle.trim() || !user) return
    setAdding(true)

    let due_time = null
    if (newDueDate) {
      const dateStr = newDueTime ? `${newDueDate}T${newDueTime}` : `${newDueDate}T23:59`
      due_time = new Date(dateStr).toISOString()
    }

    const task = {
      user_id: user.id,
      title: newTitle.trim(),
      completed: false,
      archived: false,
      due_time,
      consequence_level: newConsequence,
      notes: newNotes.trim() || null,
      recurrence: newRecurrence,
      rollover_count: 0,
      priority_score: 0,
      created_at: new Date().toISOString(),
      scheduled_for: new Date().toISOString()
    }

    const { data } = await supabase.from('tasks').insert(task).select().single()
    if (data) setTasks(prev => [data, ...prev])
    resetForm()
    setAdding(false)
    setShowAddModal(false)
  }

  // ── Voice input ──
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Try Chrome or Safari.')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)

    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript
      setVoiceTranscript(transcript)
      setParsing(true)
      try {
        const res = await fetch('/api/parse-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        })
        const parsed = await res.json()
        console.log('[voice] Raw parsed response from /api/parse-task:', parsed)
        if (parsed.title) setNewTitle(parsed.title)
        if (parsed.due_date) setNewDueDate(parsed.due_date)
        if (parsed.due_time) setNewDueTime(parsed.due_time)
        if (parsed.consequence_level) setNewConsequence(parsed.consequence_level)
        if (parsed.notes) setNewNotes(parsed.notes)
        if (parsed.recurrence) setNewRecurrence(parsed.recurrence)
      } catch (err) {
        console.error('[voice] Parse error:', err)
      }
      setParsing(false)
    }

    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  // ── Task actions ──
  const completeTask = async (task) => {
    setCompleting(task.id)
    await new Promise(r => setTimeout(r, 400))
    const updated = { ...task, completed: true, completed_at: new Date().toISOString() }
    await supabase.from('tasks').update({ completed: true, completed_at: updated.completed_at }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    setCompleting(null)
  }

  const uncompleteTask = async (task) => {
    const updated = { ...task, completed: false, completed_at: null }
    await supabase.from('tasks').update({ completed: false, completed_at: null }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
  }

  const rescheduleTask = async (task) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    const updated = {
      ...task,
      scheduled_for: tomorrow.toISOString(),
      due_time: task.due_time ? tomorrow.toISOString() : null,
      rollover_count: (task.rollover_count || 0) + 1
    }
    // Update state immediately so rollover_count and due_time render without waiting for DB
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    await supabase.from('tasks').update({
      scheduled_for: updated.scheduled_for,
      due_time: updated.due_time,
      rollover_count: updated.rollover_count
    }).eq('id', task.id)
  }

  const archiveTask = async (task) => {
    await supabase.from('tasks').update({ archived: true }).eq('id', task.id)
    setTasks(prev => prev.filter(t => t.id !== task.id))
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  // ── Calendar helpers ──
  function calDStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function calTasksForDate(dStr) {
    return tasks.filter(t => {
      if (t.archived) return false
      if (t.due_date) return t.due_date === dStr
      if (t.due_time) return new Date(t.due_time).toISOString().split('T')[0] === dStr
      if (t.scheduled_for) return new Date(t.scheduled_for).toISOString().split('T')[0] === dStr
      return false
    })
  }
  function calPrevMonth() {
    setCalMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n })
  }
  function calNextMonth() {
    setCalMonth(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n })
  }

  const pendingTasks = sortByPriority(tasks.filter(t => !t.completed))
  const completedTasks = tasks.filter(t => t.completed)
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const topTask = pendingTasks[0] || null
  const restTasks = pendingTasks.slice(1)

  if (loading) return (
    <div className={styles.loadingPage}>
      <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
    </div>
  )

  return (
    <>
      <Head><title>Dashboard — FocusBuddy</title></Head>
      <div className={styles.appShell}>

        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLogo}>
            <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
          </div>
          <nav className={styles.sidebarNav}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={`${styles.sidebarNavItem} ${activeTab === item.id ? styles.sidebarNavItemActive : ''}`}>
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.sidebarFooter}>
            <span className={styles.sidebarEmail}>{user?.email}</span>
            <button onClick={handleSignOut} className={styles.signOutBtn}>Sign out</button>
          </div>
        </aside>

        {/* MAIN */}
        <main className={styles.main}>

          {/* TASKS */}
          {activeTab === 'tasks' && (
            <div className={styles.view}>
              <div className={styles.viewHeader}>
                <div>
                  <h1 className={styles.greetingText}>
                    {greeting}, <span className={styles.name}>{firstName}.</span>
                  </h1>
                  <p className={styles.headerSub}>
                    {pendingTasks.length === 0
                      ? "You're all caught up. Seriously — well done."
                      : `${pendingTasks.length} thing${pendingTasks.length !== 1 ? 's' : ''} on your list.`}
                  </p>
                </div>
                <button onClick={() => setShowAddModal(true)} className={styles.addTaskBtn}>
                  <span>+</span> Add task
                </button>
              </div>

              {/* FOCUS CARD */}
              {topTask && (
                <div className={styles.focusCardWrap}>
                  <div className={styles.focusLabel}>
                    <span className={styles.focusDot} />
                    Priority focus
                  </div>
                  <div className={`${styles.focusCard} ${completing === topTask.id ? styles.focusCardCompleting : ''}`}>
                    {topTask.rollover_count > 0 && (
                      <div className={styles.rolloverBadge}>
                        ↷ Rolled over {topTask.rollover_count}×
                        {topTask.rollover_count >= 2 && (
                          <button className={styles.breakItDown} onClick={() => {
                            setNewTitle(`First step: ${topTask.title}`)
                            setShowAddModal(true)
                          }}>
                            · Break it down →
                          </button>
                        )}
                      </div>
                    )}
                    <div className={styles.focusCardBody}>
                      <button onClick={() => completeTask(topTask)} className={styles.focusCheck} aria-label="Complete task" />
                      <div className={styles.focusTaskInfo}>
                        <span className={styles.focusTaskTitle}>{topTask.title}</span>
                        {topTask.due_time && (() => {
                          const fmt = formatDueTime(topTask.due_time)
                          return (
                            <span className={`${styles.focusDueTime} ${fmt.urgent ? styles.focusDueUrgent : ''}`}>
                              {fmt.urgent && <span className={styles.urgentDot} />}
                              {fmt.label}
                            </span>
                          )
                        })()}
                        {topTask.notes && (
                          <span className={styles.focusNotes}>{topTask.notes}</span>
                        )}
                        <div className={styles.focusBadgeRow}>
                          {topTask.consequence_level === 'external' && (
                            <span className={styles.externalBadge}>External commitment</span>
                          )}
                          {topTask.recurrence && topTask.recurrence !== 'none' && (
                            <span className={styles.recurrenceBadge}>
                              {topTask.recurrence === 'daily' ? '↻ Daily' : '↻ Weekly'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className={styles.focusCardActions}>
                      <button onClick={() => rescheduleTask(topTask)} className={styles.focusAction}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'5px'}}><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                        Push to tomorrow
                      </button>
                      <button onClick={() => archiveTask(topTask)} className={styles.focusActionDelete}>×</button>
                    </div>
                  </div>
                  {restTasks.length > 0 && <div className={styles.stackCard2} />}
                  {restTasks.length > 1 && <div className={styles.stackCard3} />}
                </div>
              )}

              {/* UP NEXT */}
              {restTasks.length > 0 && (
                <div className={styles.taskGroup}>
                  <div className={styles.taskGroupLabel}>Up next</div>
                  {restTasks.map(task => {
                    const dueFmt = task.due_time ? formatDueTime(task.due_time) : null
                    return (
                      <div key={task.id} className={styles.taskCard}>
                        <button onClick={() => completeTask(task)} className={styles.taskCheck} aria-label="Complete" />
                        <div className={styles.taskInfo}>
                          <span className={styles.taskTitle}>{task.title}</span>
                          {task.notes && <span className={styles.taskNotes}>{task.notes}</span>}
                          <div className={styles.taskMeta}>
                            {dueFmt && (
                              <span className={`${styles.taskDueTime} ${dueFmt.urgent ? styles.taskDueUrgent : ''}`}>
                                {dueFmt.label}
                              </span>
                            )}
                            {task.rollover_count > 0 && (
                              <span className={styles.taskRollover}>↷ {task.rollover_count}×</span>
                            )}
                            {task.consequence_level === 'external' && (
                              <span className={styles.taskExternal}>External</span>
                            )}
                            {task.recurrence && task.recurrence !== 'none' && (
                              <span className={styles.taskRecurrence}>
                                ↻ {task.recurrence}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className={styles.taskActions}>
                          <button onClick={() => rescheduleTask(task)} className={styles.taskAction} title="Push to tomorrow">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                          </button>
                          <button onClick={() => archiveTask(task)} className={styles.taskActionDelete} title="Remove">×</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* EMPTY */}
              {pendingTasks.length === 0 && completedTasks.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>✦</div>
                  <p className={styles.emptyText}>Nothing on your list.</p>
                  <p className={styles.emptySubtext}>Add your first task and FocusBuddy will handle the rest.</p>
                  <button onClick={() => setShowAddModal(true)} className={styles.emptyAddBtn}>+ Add your first task</button>
                </div>
              )}

              {/* COMPLETED */}
              {completedTasks.length > 0 && (
                <div className={styles.taskGroup} style={{ marginTop: '32px' }}>
                  <div className={styles.taskGroupLabel}>
                    Done today · {completedTasks.length} {completedTasks.length === 1 ? 'win' : 'wins'} 🔥
                  </div>
                  {completedTasks.map(task => (
                    <div key={task.id} className={`${styles.taskCard} ${styles.taskDone}`}>
                      <button onClick={() => uncompleteTask(task)} className={`${styles.taskCheck} ${styles.taskCheckDone}`}>✓</button>
                      <div className={styles.taskInfo}>
                        <span className={styles.taskTitleDone}>{task.title}</span>
                      </div>
                      <button onClick={() => archiveTask(task)} className={styles.taskActionDelete} title="Remove">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CHECK-IN */}
          {activeTab === 'checkin' && (
            <div className={styles.view}>
              <div className={styles.header}>
                <h1 className={styles.greetingText}>Check-in</h1>
                <p className={styles.headerSub}>Your daily coaching conversation.</p>
              </div>
              <div className={styles.stubCard}>
                <div className={styles.stubIcon}>💬</div>
                <p className={styles.stubText}>Daily check-in coming soon.</p>
                <p className={styles.stubSubtext}>Morning, midday, and evening sessions — brief, personal, and built around your actual list.</p>
              </div>
            </div>
          )}

          {/* CALENDAR */}
          {activeTab === 'calendar' && (() => {
            const todayDStr = todayStr()
            const year = calMonth.getFullYear()
            const month = calMonth.getMonth()
            const monthName = calMonth.toLocaleString('default', { month: 'long' })
            const firstDayOfWeek = new Date(year, month, 1).getDay()
            const daysInMonth = new Date(year, month + 1, 0).getDate()
            const cells = []
            for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
            for (let d = 1; d <= daysInMonth; d++) cells.push(d)
            while (cells.length % 7 !== 0) cells.push(null)

            // ── DAY VIEW ──
            if (calView === 'day' && calDay) {
              const dayDStr = calDStr(calDay)
              const dayTasks = calTasksForDate(dayDStr)
              const unscheduled = dayTasks.filter(t => !t.due_time)
              const scheduled = dayTasks.filter(t => !!t.due_time)
              const HOURS = Array.from({ length: 18 }, (_, i) => i + 6) // 6am–11pm
              const tasksByHour = {}
              scheduled.forEach(t => {
                const h = new Date(t.due_time).getHours()
                if (!tasksByHour[h]) tasksByHour[h] = []
                tasksByHour[h].push(t)
              })
              const dayLabel = calDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

              return (
                <div className={styles.calViewWrap}>
                  <div className={styles.calDayViewHeader}>
                    <button className={styles.calBackBtn} onClick={() => setCalView('month')}>← Back</button>
                    <div className={styles.calDayTitleBlock}>
                      <h2 className={styles.calDayTitle}>{dayLabel}</h2>
                      <p className={styles.calDaySub}>{dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={() => setShowAddModal(true)} className={styles.calAddBtn}>+ Add</button>
                  </div>

                  <div className={styles.calTimeline}>
                    {unscheduled.length > 0 && (
                      <div className={styles.calUnscheduledBlock}>
                        <div className={styles.calSlotLabel}>Unscheduled</div>
                        <div className={styles.calSlotTasks}>
                          {unscheduled.map(t => (
                            <button key={t.id}
                              onClick={() => t.completed ? uncompleteTask(t) : completeTask(t)}
                              className={`${styles.calTaskChip} ${t.completed ? styles.calTaskChipDone : ''} ${t.consequence_level === 'external' ? styles.calTaskChipExt : ''}`}>
                              <span className={styles.calChipCheck}>{t.completed ? '✓' : ''}</span>
                              <span className={styles.calChipTitle}>{t.title}</span>
                              <div className={styles.calChipBadges}>
                                {t.consequence_level === 'external' && <span className={styles.calChipExtBadge}>Ext</span>}
                                {t.rollover_count > 0 && <span className={styles.calChipRollover}>↷{t.rollover_count}</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {HOURS.map(h => {
                      const slotTasks = tasksByHour[h] || []
                      const ampm = h < 12 ? 'am' : 'pm'
                      const label = h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`
                      return (
                        <div key={h} className={`${styles.calHourSlot} ${slotTasks.length > 0 ? styles.calHourSlotFilled : ''}`}>
                          <div className={styles.calHourLabel}>{label}</div>
                          <div className={styles.calHourLine} />
                          <div className={styles.calHourTasks}>
                            {slotTasks.map(t => (
                              <button key={t.id}
                                onClick={() => t.completed ? uncompleteTask(t) : completeTask(t)}
                                className={`${styles.calTaskChip} ${t.completed ? styles.calTaskChipDone : ''} ${t.consequence_level === 'external' ? styles.calTaskChipExt : ''}`}>
                                <span className={styles.calChipCheck}>{t.completed ? '✓' : ''}</span>
                                <span className={styles.calChipTitle}>{t.title}</span>
                                <div className={styles.calChipBadges}>
                                  {t.consequence_level === 'external' && <span className={styles.calChipExtBadge}>Ext</span>}
                                  {t.rollover_count > 0 && <span className={styles.calChipRollover}>↷{t.rollover_count}</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }

            // ── MONTH VIEW ──
            return (
              <div className={styles.calViewWrap}>
                <div className={styles.calMonthNav}>
                  <button className={styles.calNavBtn} onClick={calPrevMonth}>‹</button>
                  <h2 className={styles.calMonthLabel}>{monthName} {year}</h2>
                  <button className={styles.calNavBtn} onClick={calNextMonth}>›</button>
                </div>

                <div className={styles.calDayHeaders}>
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={i} className={styles.calDayHeaderCell}>{d}</div>
                  ))}
                </div>

                <div className={styles.calGrid}>
                  {cells.map((day, idx) => {
                    if (!day) return <div key={idx} className={styles.calCellEmpty} />
                    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                    const dayTasks = calTasksForDate(dStr)
                    const isToday = dStr === todayDStr
                    return (
                      <div key={idx}
                        className={`${styles.calCell} ${isToday ? styles.calCellToday : ''}`}
                        onClick={() => { setCalDay(new Date(year, month, day)); setCalView('day') }}>
                        <span className={styles.calCellNum}>{day}</span>
                        {dayTasks.length > 0 && (
                          <div className={styles.calDots}>
                            {dayTasks.slice(0, 3).map((t, di) => (
                              <span key={di} className={styles.calDot}
                                style={{ background: t.consequence_level === 'external' ? '#ff4d1c' : 'rgba(240,234,214,0.4)' }} />
                            ))}
                            {dayTasks.length > 3 && <span className={styles.calDotMore}>+</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* JOURNAL */}
          {activeTab === 'journal' && (
            <div className={styles.view}>
              <div className={styles.header}>
                <h1 className={styles.greetingText}>Journal</h1>
                <p className={styles.headerSub}>Your private reflection space.</p>
              </div>
              <div className={styles.stubCard}>
                <div className={styles.stubIcon}>📓</div>
                <p className={styles.stubText}>Journal coming soon.</p>
                <p className={styles.stubSubtext}>Brain dump, reflect, think out loud. No structure required.</p>
              </div>
            </div>
          )}

        </main>

        {/* BOTTOM NAV */}
        <nav className={styles.bottomNav}>
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={`${styles.bottomNavItem} ${activeTab === item.id ? styles.bottomNavItemActive : ''}`}>
              <span className={styles.bottomNavIcon}>{item.icon}</span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* ADD TASK MODAL */}
        {showAddModal && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>New task</h2>
                <div className={styles.modalHeaderRight}>
                  {/* MIC BUTTON */}
                  <button
                    type="button"
                    onClick={listening ? stopListening : startListening}
                    className={`${styles.micBtn} ${listening ? styles.micBtnActive : ''}`}
                    title={listening ? 'Stop recording' : 'Speak your task'}
                  >
                    {listening ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    )}
                  </button>
                  <button onClick={() => { setShowAddModal(false); resetForm() }} className={styles.modalClose}>×</button>
                </div>
              </div>

              {/* VOICE STATE */}
              {(listening || parsing || voiceTranscript) && (
                <div className={styles.voiceState}>
                  {listening && (
                    <div className={styles.voiceListening}>
                      <span className={styles.voiceDot} /><span className={styles.voiceDot} /><span className={styles.voiceDot} />
                      <span className={styles.voiceListeningText}>Listening...</span>
                    </div>
                  )}
                  {parsing && (
                    <div className={styles.voiceParsing}>Working out the details...</div>
                  )}
                  {voiceTranscript && !listening && !parsing && (
                    <div className={styles.voiceTranscript}>"{voiceTranscript}"</div>
                  )}
                </div>
              )}

              <form onSubmit={addTask} className={styles.modalForm}>

                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>What needs to get done?</label>
                  <input
                    ref={titleInputRef}
                    type="text"
                    placeholder="e.g. Call the insurance company"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className={styles.fieldInput}
                    required
                  />
                </div>

                {/* DATE */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Due date</label>
                  <div className={styles.quickRow}>
                    <button type="button"
                      onClick={() => setNewDueDate(todayStr())}
                      className={`${styles.quickBtn} ${newDueDate === todayStr() ? styles.quickBtnActive : ''}`}>
                      Today
                    </button>
                    <button type="button"
                      onClick={() => setNewDueDate(tomorrowStr())}
                      className={`${styles.quickBtn} ${newDueDate === tomorrowStr() ? styles.quickBtnActive : ''}`}>
                      Tomorrow
                    </button>
                    <input type="date" value={newDueDate}
                      onChange={e => setNewDueDate(e.target.value)}
                      className={styles.fieldInputCompact}
                    />
                  </div>
                </div>

                {/* TIME */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Due time</label>
                  <div className={styles.quickRow}>
                    {[['Morning', '09:00'], ['Afternoon', '14:00'], ['Evening', '18:00']].map(([label, val]) => (
                      <button key={val} type="button"
                        onClick={() => { setNewDueTime(val); if (!newDueDate) setNewDueDate(todayStr()) }}
                        className={`${styles.quickBtn} ${newDueTime === val ? styles.quickBtnActive : ''}`}
                        disabled={!newDueDate}>
                        {label}
                      </button>
                    ))}
                    <input type="time" value={newDueTime}
                      onChange={e => setNewDueTime(e.target.value)}
                      className={styles.fieldInputCompact}
                      disabled={!newDueDate}
                    />
                  </div>
                </div>

                {/* COMMITMENT TYPE */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Type</label>
                  <div className={styles.toggleRow}>
                    <button type="button" onClick={() => setNewConsequence('self')}
                      className={`${styles.toggleBtn} ${newConsequence === 'self' ? styles.toggleBtnActive : ''}`}>
                      Personal
                    </button>
                    <button type="button" onClick={() => setNewConsequence('external')}
                      className={`${styles.toggleBtn} ${newConsequence === 'external' ? styles.toggleBtnActive : ''}`}>
                      External commitment
                    </button>
                  </div>
                  <p className={styles.fieldHint}>
                    {newConsequence === 'external'
                      ? 'Someone else is counting on this — it gets priority.'
                      : 'This is for you — still important, context matters.'}
                  </p>
                </div>

                {/* RECURRENCE */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Repeat</label>
                  <div className={styles.toggleRow}>
                    {RECURRENCE_OPTIONS.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => setNewRecurrence(opt.value)}
                        className={`${styles.toggleBtn} ${newRecurrence === opt.value ? styles.toggleBtnActive : ''}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* NOTES */}
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>
                    Notes <span className={styles.fieldLabelOptional}>(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Context that makes this easier to start"
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    className={styles.fieldInput}
                  />
                </div>

                <button type="submit" disabled={adding || !newTitle.trim()} className={styles.modalSubmit}>
                  {adding ? 'Adding...' : 'Add to my list'}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    </>
  )
}
