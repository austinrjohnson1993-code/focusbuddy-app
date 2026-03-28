import React, { useState, useEffect, useRef } from 'react'
import { localDateStr, generateGreetingLine } from './shared'
import { supabase } from '../../lib/supabase'
import CinisMark from '../../lib/CinisMark'
import styles from '../../styles/TabDashboard.module.css'

/* ── Helpers ──────────────────────────────────────────────────────────────── */
const isToday = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr); const now = new Date()
  d.setHours(0,0,0,0); now.setHours(0,0,0,0)
  return d.getTime() === now.getTime()
}

const isPast = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr); const now = new Date()
  d.setHours(0,0,0,0); now.setHours(0,0,0,0)
  return d < now
}

const isTomorrow = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr); const tom = new Date()
  d.setHours(0,0,0,0); tom.setDate(tom.getDate() + 1); tom.setHours(0,0,0,0)
  return d.getTime() === tom.getTime()
}

const daysOverdue = (dateStr) => {
  if (!dateStr) return 0
  const d = new Date(dateStr); const now = new Date()
  d.setHours(0,0,0,0); now.setHours(0,0,0,0)
  return Math.floor((now - d) / 86400000)
}

const getTimeOfDay = () => {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const CIRCUMFERENCE = 2 * Math.PI * 19 // ~119.38

/* ── Insight generator (deterministic from profile) ───────────────────────── */
const INSIGHTS = [
  'You complete 2\u00D7 more tasks on days you check in first.',
  'Your best focus sessions happen before noon.',
  'Starring a task makes you 3\u00D7 more likely to finish it.',
  'You\u2019ve been most productive on Tuesdays.',
  'Short focus sessions (15m) have your highest completion rate.',
  'Check-in streaks correlate with your best weeks.',
]

function pickInsight(profile) {
  const seed = (profile?.total_xp || 0) + (profile?.current_streak || 0)
  return INSIGHTS[seed % INSIGHTS.length]
}

/* ── Component ────────────────────────────────────────────────────────────── */
export default function TabDashboard({
  user, profile, tasks = [], setTasks, showToast, loggedFetch, switchTab,
}) {
  const [coachMsg, setCoachMsg] = useState('')
  const [doneConfirm, setDoneConfirm] = useState(false)
  const [countdown, setCountdown] = useState('')
  const countdownRef = useRef(null)

  // ── Coach message (cached per day) ─────────────────────────────────────
  useEffect(() => {
    const todayKey = localDateStr(new Date())
    const cacheKey = `cinis_dashboard_greeting_${todayKey}`
    const cached = typeof localStorage !== 'undefined' && localStorage.getItem(cacheKey)
    if (cached) {
      setCoachMsg(cached)
    } else {
      const msg = generateGreetingLine(tasks)
      setCoachMsg(msg)
      try { localStorage.setItem(cacheKey, msg) } catch {}
    }
  }, [tasks])

  // ── Derived data ───────────────────────────────────────────────────────
  const todayStr = localDateStr(new Date())

  const activeTasks = tasks.filter(t => !t.completed && !t.archived)
  const doneTasks = tasks.filter(t => t.completed && t.completed_at && t.completed_at.slice(0, 10) === todayStr)
  const overdueTasks = activeTasks.filter(t => isPast(t.scheduled_for))
  const todayTasks = activeTasks.filter(t => isToday(t.scheduled_for))

  const totalToday = todayTasks.length + doneTasks.length
  const tasksDoneLabel = `${doneTasks.length}/${Math.max(totalToday, 1)}`
  const tasksRatio = totalToday > 0 ? doneTasks.length / totalToday : 0

  const focusMins = profile?.focus_minutes_today ?? 0
  const focusLabel = focusMins > 0 ? `${focusMins}m` : '0m'
  const focusRatio = Math.min(focusMins / 60, 1)

  const xp = profile?.total_xp || 0
  const xpLabel = xp >= 1000 ? `${(xp / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(xp)

  // Habits — derive from tasks with task_type 'habit' or recurrence
  const habits = tasks.filter(t => t.task_type === 'habit' || t.task_type === 'routine')
  const doneHabits = habits.filter(t => t.completed && t.completed_at && t.completed_at.slice(0, 10) === todayStr)
  const totalHabits = Math.max(habits.length, 1)
  const habitsLabel = `${doneHabits.length}/${habits.length || 0}`
  const habitsLeft = habits.length - doneHabits.length

  const streak = profile?.current_streak || 0

  // Priority task
  const priorityTask = activeTasks.find(t => t.starred) || activeTasks[0]

  // Countdown for priority task due_time
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (!priorityTask?.due_time) { setCountdown(''); return }
    const update = () => {
      const now = new Date()
      const target = new Date(priorityTask.due_time)
      if (target.toDateString() !== now.toDateString()) { setCountdown(''); return }
      const diff = target - now
      if (diff <= 0) { setCountdown('Due now'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setCountdown(h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`)
    }
    update()
    countdownRef.current = setInterval(update, 60000)
    return () => clearInterval(countdownRef.current)
  }, [priorityTask?.id, priorityTask?.due_time])

  // Up next logic
  const upNext = [
    overdueTasks[0],
    todayTasks.sort((a, b) => (a.due_time || '').localeCompare(b.due_time || ''))[0],
    activeTasks.find(t => isTomorrow(t.scheduled_for)),
  ].filter(Boolean)
  // Deduplicate
  const seen = new Set()
  const upNextDeduped = upNext.filter(t => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  }).slice(0, 3)

  // Bills
  const todayDate = new Date().getDate()
  const bills = tasks.filter(t => t.task_type === 'bill' && !t.archived)
  const todayBills = bills.filter(b => {
    if (b.due_day === todayDate) return true
    if (b.scheduled_for && isToday(b.scheduled_for)) return true
    return false
  }).slice(0, 3)

  // Insight
  const insight = pickInsight(profile)

  // ── Formatters ─────────────────────────────────────────────────────────
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const greetingText = `Good ${getTimeOfDay()}, ${firstName}.`

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleCompletePriority = async () => {
    if (!priorityTask) return
    if (!doneConfirm) {
      setDoneConfirm(true)
      setTimeout(() => setDoneConfirm(false), 2000)
      return
    }
    await supabase.from('tasks').update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', priorityTask.id)
    if (setTasks) {
      setTasks(prev => prev.map(t =>
        t.id === priorityTask.id
          ? { ...t, completed: true, completed_at: new Date().toISOString() }
          : t
      ))
    }
    setDoneConfirm(false)
  }

  const handleFocusPriority = () => {
    if (switchTab) switchTab('focus')
  }

  // ── Ring offsets ───────────────────────────────────────────────────────
  const tasksOffset = CIRCUMFERENCE * (1 - tasksRatio)
  const focusOffset = CIRCUMFERENCE * (1 - focusRatio)

  return (
    <div className={styles.wrap}>
      {/* ── ROW 1: Greeting + Streak ────────────────────────────── */}
      <div className={styles.greetRow}>
        <div className={styles.greetLeft}>
          <div className={styles.greetDate}>{dateStr}</div>
          <div className={styles.greetName}>{greetingText}</div>
        </div>
        <div className={styles.streakBlock}>
          <div className={styles.streakNum}>{streak}</div>
          <div className={styles.streakLabel}>day streak</div>
        </div>
      </div>

      {/* ── ROW 2: Coach message ────────────────────────────────── */}
      <div className={styles.coachCard}>
        <div className={styles.coachMark}>
          <CinisMark size={9} />
        </div>
        <div className={styles.coachText}>{coachMsg}</div>
      </div>

      {/* ── ROW 3: Stats strip ──────────────────────────────────── */}
      <div className={styles.statsStrip}>
        <div className={styles.statPill}>
          <div className={styles.statVal} style={{ color: '#4CAF50' }}>{tasksDoneLabel}</div>
          <div className={styles.statLbl}>tasks</div>
        </div>
        <div className={styles.statPill}>
          <div className={styles.statVal} style={{ color: '#3B8BD4' }}>{focusLabel}</div>
          <div className={styles.statLbl}>focus</div>
        </div>
        <div className={styles.statPill}>
          <div className={styles.statVal} style={{ color: '#FFB800' }}>{xpLabel}</div>
          <div className={styles.statLbl}>XP</div>
        </div>
        <div className={styles.statPill}>
          <div className={styles.statVal} style={{ color: '#4CAF50' }}>{habitsLabel}</div>
          <div className={styles.statLbl}>habits</div>
        </div>
      </div>

      {/* ── ROW 4: Rings + Priority/Insight ─────────────────────── */}
      <div className={styles.row4}>
        {/* Rings block */}
        <div className={styles.ringsBlock}>
          <div className={styles.ringsTop}>
            {/* Tasks ring */}
            <div className={styles.ringWrap}>
              <svg width="48" height="48" viewBox="0 0 48 48" className={styles.ringSvg}>
                <circle cx="24" cy="24" r="19" className={styles.ringTrack} />
                <circle
                  cx="24" cy="24" r="19"
                  className={styles.ringFill}
                  stroke="#FF6644"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={tasksOffset}
                  style={{ '--ring-offset': tasksOffset }}
                />
                <text
                  x="24" y="24"
                  textAnchor="middle" dominantBaseline="central"
                  className={styles.ringCenter}
                  fill="#FF6644"
                  transform="rotate(90 24 24)"
                >
                  {tasksDoneLabel}
                </text>
              </svg>
              <div className={styles.ringLabel}>Tasks</div>
            </div>

            {/* Focus ring */}
            <div className={styles.ringWrap}>
              <svg width="48" height="48" viewBox="0 0 48 48" className={styles.ringSvg}>
                <circle cx="24" cy="24" r="19" className={styles.ringTrack} />
                <circle
                  cx="24" cy="24" r="19"
                  className={styles.ringFill}
                  stroke="#3B8BD4"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={focusOffset}
                  style={{ '--ring-offset': focusOffset }}
                />
                <text
                  x="24" y="24"
                  textAnchor="middle" dominantBaseline="central"
                  className={styles.ringCenter}
                  fill="#3B8BD4"
                  transform="rotate(90 24 24)"
                >
                  {focusLabel}
                </text>
              </svg>
              <div className={styles.ringLabel}>Focus</div>
            </div>
          </div>

          {/* Habit dots */}
          <div className={styles.habitDotsSection}>
            <div className={styles.habitDots}>
              {habits.slice(0, 6).map((h, i) => {
                const done = h.completed && h.completed_at && h.completed_at.slice(0, 10) === todayStr
                return <div key={h.id || i} className={done ? styles.habitDotDone : styles.habitDotUndone} />
              })}
              {habits.length === 0 && (
                <>
                  <div className={styles.habitDotUndone} />
                  <div className={styles.habitDotUndone} />
                  <div className={styles.habitDotUndone} />
                </>
              )}
            </div>
            <div className={styles.habitDotsLabel}>
              {habitsLeft > 0 ? `${habitsLeft} habits left` : habits.length > 0 ? 'All done' : 'No habits'}
            </div>
          </div>
        </div>

        {/* Right: Priority + Insight */}
        <div className={styles.rightCol}>
          {/* Priority card */}
          <div className={styles.priorityCard}>
            <div className={styles.priorityHeader}>
              <span className={styles.priorityLabel}>PRIORITY</span>
              {countdown && <span className={styles.priorityCountdown}>{countdown}</span>}
            </div>
            {priorityTask ? (
              <>
                <div className={styles.priorityName}>{priorityTask.title}</div>
                <div className={styles.priorityBtns}>
                  <button className={styles.priorityFocusBtn} onClick={handleFocusPriority}>Focus</button>
                  <button
                    className={doneConfirm ? styles.priorityDoneBtnCheck : styles.priorityDoneBtn}
                    onClick={handleCompletePriority}
                  >
                    {doneConfirm ? '\u2713' : 'Done'}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.noPriority}>No priority task</div>
            )}
          </div>

          {/* Insight card */}
          <div className={styles.insightCard}>
            <div className={styles.insightLabel}>PATTERN</div>
            <div className={styles.insightText}>{insight}</div>
            <button className={styles.insightCta} onClick={() => switchTab?.('checkin')}>
              Check in &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* ── ROW 5: Up next + Bills ──────────────────────────────── */}
      <div className={styles.row5}>
        {/* Up next */}
        <div className={styles.upNextCol}>
          <div className={styles.sectionLabel}>UP NEXT</div>
          {upNextDeduped.length === 0 && (
            <div className={styles.noPriority}>Nothing upcoming</div>
          )}
          {upNextDeduped.map(t => {
            const overdue = isPast(t.scheduled_for) && !isToday(t.scheduled_for)
            const days = daysOverdue(t.scheduled_for)
            const tomorrow = isTomorrow(t.scheduled_for)
            let sub = 'Today'
            if (overdue) sub = `${days} day${days !== 1 ? 's' : ''} overdue`
            else if (tomorrow) sub = 'Tomorrow'
            else if (t.due_time) {
              const time = new Date(t.due_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              sub = `Today \u00B7 ${time}`
            }

            return (
              <div key={t.id} className={overdue ? styles.upNextOverdue : styles.upNextRegular}>
                <div className={styles.upNextTitle}>{t.title}</div>
                <div className={overdue ? styles.upNextSubOverdue : styles.upNextSub}>{sub}</div>
              </div>
            )
          })}
        </div>

        {/* Bills due */}
        {todayBills.length > 0 && (
          <div className={styles.billsCol}>
            <div className={styles.sectionLabel}>BILLS DUE</div>
            {todayBills.map(b => {
              const isAuto = b.autopay || b.payment_method === 'auto'
              const amount = b.amount ? ` \u00B7 $${Number(b.amount).toFixed(0)}` : ''
              return (
                <div key={b.id} className={isAuto ? styles.billRowAuto : styles.billRow}>
                  <div className={styles.billName}>{b.title}{amount}</div>
                  <div className={styles.billSub}>Today \u00B7 {isAuto ? 'autopay' : 'manual'}</div>
                  {isAuto ? (
                    <span className={styles.billAutoBadge}>AUTO</span>
                  ) : (
                    <button className={styles.billPayLink} onClick={() => switchTab?.('finance')}>
                      Pay &rarr;
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
