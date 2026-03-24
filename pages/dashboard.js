import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Dashboard.module.css'
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd'
import { applyAccentColor, DEFAULT_ACCENTS } from '../lib/accentColor'
import { saveTaskOrder } from '../lib/taskOrder'
import { isDueSoon as billIsDueSoon, formatBillAmount, getBillCategory, getNextDueDate } from '../lib/billUtils'
import { CHORE_PRESETS, getChoresByPreset } from '../lib/chores'
import { requestNotificationPermission, disablePushNotifications } from '../lib/pushNotifications'
import { CheckSquare, ChatCircle, Target, CalendarBlank, Notebook, Wallet, ChartLineUp, Plus, Trash, Archive, Star, Gear, MagnifyingGlass, X, CaretLeft, CaretRight, CaretDown, Receipt, Scales, Books, Robot, List, Timer, ChartBar, Lightning, ArrowCounterClockwise, CheckCircle, Microphone, UsersThree, Fire } from '@phosphor-icons/react'
import { showToast as libShowToast, ToastContainer } from '../lib/toast.js'

const THEMES = [
  { id: 'orange-bronze', name: 'Classic', accent: '#FF6644', gradient: 'radial-gradient(ellipse at top left, rgba(101,60,10,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(80,45,8,0.35) 0%, transparent 60%)', logo: '#FF6644', dataTheme: 'classic' },
  { id: 'teal-ocean', name: 'Ocean', accent: '#2dd4bf', gradient: 'radial-gradient(ellipse at top left, rgba(15,80,90,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(10,60,70,0.35) 0%, transparent 60%)', logo: '#2dd4bf' },
  { id: 'purple-cosmos', name: 'Cosmos', accent: '#8b5cf6', gradient: 'radial-gradient(ellipse at top left, rgba(60,20,120,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(40,10,90,0.35) 0%, transparent 60%)', logo: '#8b5cf6' },
  { id: 'blue-arctic', name: 'Arctic', accent: '#3b82f6', gradient: 'radial-gradient(ellipse at top left, rgba(15,40,100,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(10,30,80,0.35) 0%, transparent 60%)', logo: '#3b82f6' },
  { id: 'green-forest', name: 'Forest', accent: '#22c55e', gradient: 'radial-gradient(ellipse at top left, rgba(10,70,30,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(8,50,20,0.35) 0%, transparent 60%)', logo: '#22c55e' },
  { id: 'rose-sunset', name: 'Sunset', accent: '#f43f5e', gradient: 'radial-gradient(ellipse at top left, rgba(120,20,40,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(90,15,30,0.35) 0%, transparent 60%)', logo: '#f43f5e' },
  { id: 'amber-desert', name: 'Desert', accent: '#f59e0b', gradient: 'radial-gradient(ellipse at top left, rgba(120,70,5,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(90,50,5,0.35) 0%, transparent 60%)', logo: '#f59e0b' },
  { id: 'cyan-electric', name: 'Electric', accent: '#06b6d4', gradient: 'radial-gradient(ellipse at top left, rgba(5,70,100,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(5,50,80,0.35) 0%, transparent 60%)', logo: '#06b6d4' },
  { id: 'indigo-night', name: 'Night', accent: '#6366f1', gradient: 'radial-gradient(ellipse at top left, rgba(30,20,100,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(20,15,80,0.35) 0%, transparent 60%)', logo: '#6366f1' },
  { id: 'drill-sergeant', name: 'Command', accent: '#ef4444', gradient: 'radial-gradient(ellipse at top left, rgba(100,10,10,0.5) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(80,5,5,0.4) 0%, transparent 60%)', logo: '#ef4444' },
  { id: 'midnight', name: 'Midnight', accent: '#FF6644', gradient: 'radial-gradient(ellipse at top left, rgba(101,60,10,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(80,45,8,0.35) 0%, transparent 60%)', logo: '#FF6644', dataTheme: 'midnight' },
  { id: 'warm', name: 'Warm', accent: '#FF6644', gradient: 'radial-gradient(ellipse at top left, rgba(101,60,10,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(80,45,8,0.35) 0%, transparent 60%)', logo: '#FF6644', dataTheme: 'warm' },
]

function applyTheme(theme) {
  if (!theme || typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-gradient', theme.gradient)
  root.style.setProperty('--logo-color', theme.logo)
  // Set data-theme attribute to enable CSS variable sets for midnight/warm
  if (theme.dataTheme) {
    root.setAttribute('data-theme', theme.dataTheme)
  } else {
    root.removeAttribute('data-theme')
  }
  // Override background/text for themes that need it (Midnight)
  root.style.setProperty('--night', theme.bg || '#0d1117')
  root.style.setProperty('--cream', theme.textColor || '#f0ead6')
  root.style.setProperty('--bg-color', '#110d06')
  root.style.setProperty('--card-bg', '#221608')
  root.style.setProperty('--text-color', '#f0ead6')
  root.style.setProperty('--text-muted', 'rgba(240,234,214,0.5)')
  root.style.setProperty('--border-color', 'rgba(255,200,120,0.12)')
  // also set --accent-rgb so rgba(var(--accent-rgb), opacity) works with this theme
  applyAccentColor(theme.accent, theme.id)
}

function loadChatHistory(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null } catch { return null }
}
function saveChatHistory(key, messages) {
  try { localStorage.setItem(key, JSON.stringify(messages.slice(-50))) } catch {}
}

const NAV_ITEMS = [
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={22} /> },
  { id: 'checkin', label: 'Check-in', icon: <ChatCircle size={22} /> },
  { id: 'focus', label: 'Focus', icon: <Target size={22} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarBlank size={22} /> },
  { id: 'habits', label: 'Habits', icon: <ArrowCounterClockwise size={22} /> },
  { id: 'tagteam', label: 'Tag Team', icon: <UsersThree size={22} /> },
  { id: 'finance', label: 'Finance', icon: <Wallet size={22} /> },
  { id: 'progress', label: 'Progress', icon: <ChartLineUp size={22} /> },
  { id: 'guide', label: 'Guide', icon: <Books size={22} /> },
  { id: 'settings', label: 'Settings', icon: <Gear size={22} /> },
]

const NAV_PRIMARY_IDS = ['tasks', 'checkin', 'focus', 'calendar']
const NAV_MORE_IDS = ['habits', 'tagteam', 'finance', 'progress', 'guide', 'settings']

// ── GUIDE TAB STRATEGIES ────────────────────────────────────────────────────────
const GUIDE_STRATEGIES = [
  // Cinis tag
  { id: 'c1', tag: 'Cinis', icon: '✦', title: 'Set your coaching blend', body: 'Go to Settings → Coaching Blend. Pick up to 3 personas that match how you want to be coached. Your coach changes tone immediately.' },
  { id: 'c2', tag: 'Cinis', icon: '⭐', title: 'Use star for your #1 task', body: 'Star exactly one task per day. It becomes your priority card with a countdown. One task. That\'s the whole system.' },
  { id: 'c3', tag: 'Cinis', icon: '💬', title: 'The morning check-in is your launch pad', body: 'Don\'t open your task list cold. Open Check-in first. Let your coach orient you. Then go. The first message is the hardest — the chip buttons do it for you.' },
  // Quick Wins tag
  { id: 'q1', tag: 'Quick Wins', icon: '⚡', title: 'The 2-minute sweep', body: 'Scan your task list. Do every task that takes under 2 minutes right now, back to back. Don\'t schedule them — just do them. This clears cognitive load faster than any planning session.' },
  { id: 'q2', tag: 'Quick Wins', icon: '🔪', title: 'Shrink the first step', body: 'The task isn\'t \'write the report.\' The task is \'open the document.\' Make the first step so small it\'s embarrassing to skip.' },
  // Focus tag
  { id: 'f1', tag: 'Focus', icon: '👥', title: 'Body doubles work', body: 'Working alongside someone — even silently, even virtually — dramatically increases follow-through for ADHD brains. Use Focus co-session when it launches, or just open a video call with anyone.' },
  { id: 'f2', tag: 'Focus', icon: '🕐', title: 'Time blocks, not lists', body: 'A to-do list with no time attached is a wish list. Assign every important task a specific block on the calendar. Unscheduled = undone.' },
  // Momentum tag
  { id: 'm1', tag: 'Momentum', icon: '🔥', title: 'Never miss twice', body: 'Missing once is an accident. Missing twice is a new pattern. If you break a streak, the only move is to get one rep in today, no matter how small.' },
  { id: 'm2', tag: 'Momentum', icon: '🎯', title: 'Done beats perfect', body: 'A completed task at 70% is worth more than a perfect task that never ships. Mark it done. Move forward. Refinement is a future task.' },
  // Systems tag
  { id: 's1', tag: 'Systems', icon: '📋', title: 'Weekly review in 5 minutes', body: 'Every Sunday: archive anything more than 2 weeks old with no progress. Reschedule anything you\'re actually going to do. Delete everything else. A clean list is a usable list.' },
]

// ── Pure helpers ──────────────────────────────────────────────────────────────

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

function sortBySchedule(tasks) {
  const now = new Date()
  const todayLocal = localDateStr(now)
  return [...tasks].sort((a, b) => {
    const getEffective = (t) => {
      if (t.due_time) return new Date(t.due_time)
      if (t.scheduled_for) return new Date(t.scheduled_for)
      return null
    }
    const aDate = getEffective(a)
    const bDate = getEffective(b)
    const aIsToday = aDate && localDateStr(aDate) === todayLocal
    const bIsToday = bDate && localDateStr(bDate) === todayLocal
    if (aIsToday && !bIsToday) return -1
    if (!aIsToday && bIsToday) return 1
    if (aIsToday && bIsToday) {
      if (a.due_time && b.due_time) return new Date(a.due_time) - new Date(b.due_time)
      if (a.due_time && !b.due_time) return -1
      if (!a.due_time && b.due_time) return 1
      const aOrd = a.sort_order ?? 999999
      const bOrd = b.sort_order ?? 999999
      return aOrd - bOrd
    }
    if (aDate && !bDate) return -1
    if (!aDate && bDate) return 1
    if (aDate && bDate) return aDate - bDate
    const aOrd = a.sort_order ?? 999999
    const bOrd = b.sort_order ?? 999999
    return aOrd - bOrd
  })
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

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function todayStr() { return localDateStr(new Date()) }
function tomorrowStr() {
  const t = new Date(); t.setDate(t.getDate() + 1); return localDateStr(t)
}

function taskBaseDate(task) {
  if (task.due_date) {
    const [y, m, d] = task.due_date.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  if (task.due_time) {
    const dt = new Date(task.due_time)
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  }
  if (task.scheduled_for) {
    const dt = new Date(task.scheduled_for)
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  }
  return null
}

function getTasksForDate(tasks, date) {
  return tasks.filter(t => {
    if (t.archived) return false
    const base = taskBaseDate(t)
    if (!base) return false
    if (t.recurrence === 'daily') return date >= base
    if (t.recurrence === 'weekly') {
      if (date < base) return false
      const diffDays = Math.round((date - base) / 86400000)
      return diffDays % 7 === 0
    }
    if (t.recurrence === 'monthly') {
      if (date < base) return false
      return date.getDate() === base.getDate()
    }
    return localDateStr(base) === localDateStr(date)
  })
}

function getTaskOccurrencesForMonth(tasks, year, month) {
  const result = {}
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const matches = getTasksForDate(tasks, date)
    if (matches.length > 0) result[localDateStr(date)] = matches
  }
  return result
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(n) || 0)
}

function getTaskDateLabel(task) {
  if (!task.scheduled_for && !task.due_time) return null
  const date = new Date(task.scheduled_for || task.due_time)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(today.getDate() + 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const diffDays = Math.ceil((date - today) / (1000 * 60 * 60 * 24))
  if (diffDays <= 7) return days[date.getDay()]
  return `${days[date.getDay()].slice(0,3)} ${months[date.getMonth()]} ${date.getDate()}`
}

// Custom hook for live countdowns — ticks every second for today's tasks
function useCountdown(targetTime) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    if (!targetTime) { setTimeLeft(''); return }
    const update = () => {
      const now = new Date()
      const target = new Date(targetTime)
      if (target.toDateString() !== now.toDateString()) { setTimeLeft(''); return }
      const diff = target - now
      if (diff <= 0) { setTimeLeft('Due now'); return }
      const totalSecs = Math.floor(diff / 1000)
      const h = Math.floor(totalSecs / 3600)
      const m = Math.floor((totalSecs % 3600) / 60)
      const s = totalSecs % 60
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetTime])
  return timeLeft
}

// Compute countdown string inline (for use inside map — not a hook)
function getCountdownDisplay(due_time, now) {
  if (!due_time) return null
  const target = new Date(due_time)
  if (target.toDateString() !== now.toDateString()) return null
  const diff = target - now
  if (diff <= 0) return 'Due Now'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `Due in ${hours}h ${mins}m`
  return `Due in ${mins}m`
}

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
]

const PERSONAS_LIST = [
  { key: 'drill_sergeant', label: 'The Drill Sergeant', desc: 'Blunt, direct, zero fluff. Gets you moving.' },
  { key: 'coach', label: 'The Coach', desc: 'Warm, strategic, keeps you moving forward.' },
  { key: 'thinking_partner', label: 'The Thinking Partner', desc: 'Collaborative, asks questions, helps you decide.' },
  { key: 'hype_person', label: 'The Hype Person', desc: 'Energetic, celebratory, makes wins feel huge.' },
  { key: 'strategist', label: 'The Strategist', desc: 'Logical, pragmatic, systems-focused.' },
  { key: 'empath', label: 'The Empath', desc: 'Emotionally attuned, meets you where you are.' },
]
const PERSONA_BADGE = ['Primary', 'Supporting', 'Accent']

const BILL_CATEGORIES = ['Housing', 'Utilities', 'Subscriptions', 'Insurance', 'Transport', 'Food', 'Health', 'Other']


function getCheckinType() {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 16) return 'midday'
  return 'evening'
}

function sanitizeInsight(raw) {
  if (!raw) return ''
  // Strip markdown header lines (# ...)
  const lines = raw.split('\n').filter(l => !l.trim().startsWith('#'))
  // Strip remaining markdown bold/italic
  const text = lines.join(' ').replace(/\*\*?([^*]+)\*\*?/g, '$1').replace(/_([^_]+)_/g, '$1').trim()
  if (!text) return ''
  // Truncate to 2 sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  if (sentences.length <= 2) return text
  return sentences.slice(0, 2).join(' ') + '...'
}

// ── QC Debug Panel ────────────────────────────────────────────────────────────

function DebugPanel({ user, profile, tasks, bills, journalEntries, activeTab, debugRef,
  showAddModal, showPersonaModal, showSessionEndModal, showAddBillModal, showGuideModal, showAlarmsModal }) {
  const [minimized, setMinimized] = useState(false)
  const [, forceUpdate] = useState(0)

  const openModal = [
    showAddModal && 'addTask',
    showPersonaModal && 'persona',
    showSessionEndModal && 'sessionEnd',
    showAddBillModal && 'addBill',
    showGuideModal && 'guide',
    showAlarmsModal && 'alarms',
  ].filter(Boolean).join(', ') || 'none'

  const cssVars = typeof document !== 'undefined' ? {
    accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    bgColor: (getComputedStyle(document.documentElement).getPropertyValue('--bg-color') || getComputedStyle(document.documentElement).getPropertyValue('--night')).trim(),
    textColor: (getComputedStyle(document.documentElement).getPropertyValue('--text-color') || getComputedStyle(document.documentElement).getPropertyValue('--cream')).trim(),
  } : {}

  const last = debugRef.current.lastCall
  const lastErr = debugRef.current.lastError

  const copyState = () => {
    const data = {
      user_id: user?.id,
      theme_id: profile?.accent_color,
      persona_voice: profile?.persona_voice,
      persona_blend: profile?.persona_blend,
      onboarded: profile?.onboarded,
      tasks: tasks.length,
      bills: bills.length,
      journalEntries: journalEntries.length,
      activeTab,
      openModal,
      lastCall: last,
      lastError: lastErr,
      cssVars,
    }
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).catch(() => {})
  }

  return (
    <div className={styles.debugPanel}>
      <div className={styles.debugHeader}>
        <span>🔧 QC Debug</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className={styles.debugBtn} onClick={() => { debugRef.current.lastError = null; forceUpdate(n => n + 1) }}>CLR ERR</button>
          <button className={styles.debugBtn} onClick={copyState}>COPY</button>
          <button className={styles.debugBtn} onClick={() => setMinimized(m => !m)}>{minimized ? '▲' : '▼'}</button>
        </div>
      </div>
      {!minimized && (
        <div className={styles.debugBody}>
          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>IDENTITY</div>
            <div>uid: {user?.id ? user.id.slice(0, 8) + '…' : '—'}</div>
            <div>theme: {profile?.accent_color || '—'}</div>
            <div>voice: {profile?.persona_voice || '—'}</div>
            <div>personas: {Array.isArray(profile?.persona_blend) ? profile.persona_blend.join(', ') : profile?.persona_blend || '—'}</div>
            <div>onboarded: {String(profile?.onboarded ?? '—')}</div>
          </div>
          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>STATE COUNTS</div>
            <div>tasks: {tasks.length} | bills: {bills.length} | journal: {journalEntries.length}</div>
          </div>
          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>LAST API CALL</div>
            {last ? (
              <>
                <div>{last.method} {last.endpoint}</div>
                <div>status: {last.status} | {last.ms}ms</div>
                <div className={styles.debugPreview}>{last.preview}</div>
              </>
            ) : <div>—</div>}
          </div>
          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>LAST ERROR</div>
            <div className={styles.debugError}>{lastErr || '—'}</div>
          </div>
          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>CSS VARS</div>
            <div>--accent: {cssVars.accent || '—'}</div>
            <div>--bg: {cssVars.bgColor || '—'}</div>
            <div>--text: {cssVars.textColor || '—'}</div>
          </div>
          <div className={styles.debugSection}>
            <div className={styles.debugLabel}>UI STATE</div>
            <div>tab: {activeTab}</div>
            <div>modal: {openModal}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Error Boundary ─────────────────────────────────────────────────────────────

class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('[TabErrorBoundary]', this.props.tabName, error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.tabErrorFallback}>
          <p className={styles.tabErrorTitle}>
            Something went wrong loading {this.props.tabName}.
          </p>
          <p className={styles.tabErrorDetail}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button
            className={styles.tabErrorRetry}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── S17 helper ────────────────────────────────────────────────────────────────

function generateGreetingLine(tasks) {
  const todayD = new Date(); todayD.setHours(0,0,0,0)
  const yStr = (() => { const d = new Date(); d.setDate(d.getDate()-1); return localDateStr(d) })()
  const yesterdayDone = tasks.filter(t => t.completed && t.completed_at && localDateStr(new Date(t.completed_at)) === yStr).length
  const overdue = tasks.filter(t => {
    if (t.completed || t.archived || !t.scheduled_for) return false
    const sf = new Date(t.scheduled_for); sf.setHours(0,0,0,0)
    return sf < todayD
  })
  if (overdue.length > 0) {
    const oldest = overdue.reduce((p,c) => new Date(p.scheduled_for) < new Date(c.scheduled_for) ? p : c)
    const days = Math.floor((todayD - new Date(oldest.scheduled_for).setHours(0,0,0,0)) / 86400000)
    if (days >= 2) return `"${oldest.title}" has been waiting ${days} days. Today's a good time.`
    return `"${oldest.title}" was on yesterday's list. Still there.`
  }
  const starred = tasks.find(t => t.starred && !t.completed && !t.archived)
  if (starred) return `"${starred.title}" is your priority. You've got this.`
  if (yesterdayDone > 0) return `${yesterdayDone} thing${yesterdayDone !== 1 ? 's' : ''} done yesterday. Let's keep going.`
  const pending = tasks.filter(t => !t.completed && !t.archived)
  if (pending.length === 0) return "You're all caught up. Seriously — that's rare."
  return `${pending.length} thing${pending.length !== 1 ? 's' : ''} on your plate today.`
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

const CINIS_MARK_SVG = (
  <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
    <polygon points="32,2 56,15 56,43 32,56 8,43 8,15" fill="none" stroke="#FF6644" strokeWidth="1.1" opacity="0.45"/>
    <path d="M 12.63,14.56 L 29.37,5.44 Q 32,4 34.63,5.44 L 51.37,14.56 Q 54,16 54,19 L 54,39 Q 54,42 51.37,43.44 L 34.63,52.56 Q 32,54 29.37,52.56 L 12.63,43.44 Q 10,42 10,39 L 10,19 Q 10,16 12.63,14.56 Z" fill="#FF6644"/>
    <path d="M 14.9,16.1 L 29.8,7.8 Q 32,6.6 34.2,7.8 L 49.1,16.1 Q 51.4,17.4 51.4,20 L 51.4,38 Q 51.4,40.6 49.1,41.9 L 34.2,50.2 Q 32,51.4 29.8,50.2 L 14.9,41.9 Q 12.6,40.6 12.6,38 L 12.6,20 Q 12.6,17.4 14.9,16.1 Z" fill="#120704"/>
    <polygon points="32,14 46,22 46,40 32,48 18,40 18,22" fill="#5A1005"/>
    <polygon points="32,20 42,26 42,40 32,45 22,40 22,26" fill="#A82010"/>
    <polygon points="32,26 38,29 38,40 32,43 26,40 26,29" fill="#E8321A"/>
    <polygon points="32,29 45,40 40,43 32,47 24,43 19,40" fill="#FF6644" opacity="0.92"/>
    <polygon points="32,33 41,40 38,42 32,45 26,42 23,40" fill="#FFD0C0" opacity="0.76"/>
    <polygon points="32,36 37,40 36,41 32,43 28,41 27,40" fill="#FFF0EB" opacity="0.60"/>
  </svg>
)

function EmptyState({ headline, subtext, ctaLabel, onCtaClick, useMarkIcon, customIcon }) {
  return (
    <div className={styles.emptyState}>
      {customIcon ? <div className={styles.emptyMarkIcon}>{customIcon}</div> : useMarkIcon && <div className={styles.emptyMarkIcon}>{CINIS_MARK_SVG}</div>}
      <p className={styles.emptyHeadline}>{headline}</p>
      {subtext && <p className={styles.emptySubtext}>{subtext}</p>}
      {ctaLabel && onCtaClick && (
        <button className={styles.emptyCtaBtn} onClick={onCtaClick}>{ctaLabel}</button>
      )}
    </div>
  )
}

const SKELETON_LINE_WIDTHS = ['70%', '50%', '85%', '40%']

function SkeletonCard({ lines = 2, showAvatar = false }) {
  return (
    <div className={styles.skeletonCard}>
      {showAvatar && <div className={styles.skeletonCircle} />}
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={styles.skeletonBar} style={{ width: SKELETON_LINE_WIDTHS[i % 4] }} />
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className={styles.errorState}>
      <span style={{ fontSize: 24 }}>⚠️</span>
      <p className={styles.errorMessage}>{message}</p>
      {onRetry && (
        <button className={styles.errorRetryBtn} onClick={onRetry}>Try again</button>
      )}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [detailTask, setDetailTask] = useState(null)
  const [detailNoteEdit, setDetailNoteEdit] = useState('')
  const [detailNoteEditing, setDetailNoteEditing] = useState(false)
  const [toast, setToast] = useState(null)

  // Check-in
  const [checkinMessages, setCheckinMessages] = useState([])
  const [checkinInput, setCheckinInput] = useState('')
  const [checkinLoading, setCheckinLoading] = useState(false)
  const [checkinInitialized, setCheckinInitialized] = useState(false)
  const checkinEndRef = useRef(null)
  const [ciAiRateLocal, setCiAiRateLocal] = useState(null)
  const [ciRateLimitMsg, setCiRateLimitMsg] = useState(null)
  const [ciError, setCiError] = useState(null)
  const [dismissedProactiveBadge, setDismissedProactiveBadge] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const key = `cinis_dismissed_badge_${user?.id}_${new Date().toLocaleDateString('en-CA')}`
      return localStorage.getItem(key) === 'true'
    } catch {
      return false
    }
  })

  // Persona settings modal
  const [showPersonaModal, setShowPersonaModal] = useState(false)
  const [personaSelection, setPersonaSelection] = useState([])
  const [personaVoice, setPersonaVoice] = useState('female')
  const [personaSaving, setPersonaSaving] = useState(false)

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
  const dragSrcRef = useRef(null)

  // Voice FAB
  const [voiceFabState, setVoiceFabState] = useState('idle') // 'idle' | 'recording' | 'processing'
  const voiceFabRecognitionRef = useRef(null)

  // Check-in voice input
  const [checkinVoiceListening, setCheckinVoiceListening] = useState(false)
  const checkinVoiceRecognitionRef = useRef(null)
  const checkinVoiceSilenceTimerRef = useRef(null)

  // Calendar
  const [calView, setCalView] = useState('month')
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [calDay, setCalDay] = useState(null)
  const [dragOverHour, setDragOverHour] = useState(null)

  // Journal
  const [journalInput, setJournalInput] = useState('')
  const [journalMessages, setJournalMessages] = useState([])
  const [journalLoading, setJournalLoading] = useState(false)
  const [journalEntries, setJournalEntries] = useState([])
  const [journalEntriesLoaded, setJournalEntriesLoaded] = useState(false)
  const [journalExpandedEntry, setJournalExpandedEntry] = useState(null)
  const [journalPendingTasks, setJournalPendingTasks] = useState([])
  const journalEndRef = useRef(null)

  // Focus mode
  const [focusPhase, setFocusPhase] = useState('setup') // setup | active | stuck
  const [focusDuration, setFocusDuration] = useState(25)
  const [focusCustom, setFocusCustom] = useState('')
  const [focusTimeLeft, setFocusTimeLeft] = useState(0)
  const [focusRunning, setFocusRunning] = useState(false)
  const [focusAiResponse, setFocusAiResponse] = useState('')
  const [focusAiLoading, setFocusAiLoading] = useState(false)
  const focusIntervalRef = useRef(null)
  const [showSessionEndModal, setShowSessionEndModal] = useState(false)
  const [sessionEndType, setSessionEndType] = useState('complete') // 'complete' | 'abandoned'
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const [showStuckModal, setShowStuckModal] = useState(false)
  const [stuckConfirmRemove, setStuckConfirmRemove] = useState(false)
  const [stuckTask, setStuckTask] = useState(null)
  const [routinesExpanded, setRoutinesExpanded] = useState(false)
  const [electedTaskId, setElectedTaskId] = useState(null) // user-starred priority task (UI only)

  // Progress
  const [weeklySummary, setWeeklySummary] = useState('')
  const [weeklySummaryLoading, setWeeklySummaryLoading] = useState(false)
  const [weeklySummaryInitialized, setWeeklySummaryInitialized] = useState(false)
  const [monthlySummary, setMonthlySummary] = useState('')
  const [monthlySummaryLoading, setMonthlySummaryLoading] = useState(false)
  const [monthlySummaryInitialized, setMonthlySummaryInitialized] = useState(false)
  const [progressSnapshots, setProgressSnapshots] = useState([])

  // Finance
  const [bills, setBills] = useState([])
  const [billsLoaded, setBillsLoaded] = useState(false)
  const [showAddBillModal, setShowAddBillModal] = useState(false)
  const [newBillName, setNewBillName] = useState('')
  const [newBillAmount, setNewBillAmount] = useState('')
  const [newBillDueDay, setNewBillDueDay] = useState('')
  const [newBillFrequency, setNewBillFrequency] = useState('monthly')
  const [newBillCategory, setNewBillCategory] = useState('')
  const [newBillAutoTask, setNewBillAutoTask] = useState(true)
  const [addingBill, setAddingBill] = useState(false)

  // Mobile more drawer
  const [showMoreDrawer, setShowMoreDrawer] = useState(false)

  // Themes
  const [activeTheme, setActiveTheme] = useState(THEMES[0])

  // Focus subtab (kept for any legacy refs)
  const [focusSubTab, setFocusSubTab] = useState('session')
  // Focus accordion section
  const [focusSection, setFocusSection] = useState('session')

  // Progress time band
  const [progressBand, setProgressBand] = useState('week')
  const [progressTodayError, setProgressTodayError] = useState(false)

  // Calendar day panel
  const [calDayPanelOpen, setCalDayPanelOpen] = useState(false)

  // Progress insights
  const [progressInsights, setProgressInsights] = useState([])
  const [progressInsightsLoading, setProgressInsightsLoading] = useState(false)
  const [progressInsightsLoaded, setProgressInsightsLoaded] = useState(false)

  // Guide modal
  const [showGuideModal, setShowGuideModal] = useState(false)

  // Alarms
  const [alarms, setAlarms] = useState([])
  const [alarmsLoaded, setAlarmsLoaded] = useState(false)
  const [showAlarmsModal, setShowAlarmsModal] = useState(false)
  const [newAlarmTime, setNewAlarmTime] = useState('')
  const [newAlarmTitle, setNewAlarmTitle] = useState('')
  const [newAlarmRepeat, setNewAlarmRepeat] = useState('once')
  const [addingAlarm, setAddingAlarm] = useState(false)
  const [activeAlarmBanner, setActiveAlarmBanner] = useState(null)
  const alarmIntervalRef = useRef(null)

  // Journal reminder + hint
  const [journalReminderShown, setJournalReminderShown] = useState(false)
  const [showJournalReminder, setShowJournalReminder] = useState(false)
  const [journalHintVisible, setJournalHintVisible] = useState(false)
  const prevTabRef = useRef(null)

  // FIX 1: Drag hint
  const [dragHintDismissed, setDragHintDismissed] = useState(false)

  const [titleInputError, setTitleInputError] = useState(false)

  // FIX 2: Task edit mode
  const [detailEditing, setDetailEditing] = useState(false)
  const [detailEditTitle, setDetailEditTitle] = useState('')
  const [detailEditDueDate, setDetailEditDueDate] = useState('')
  const [detailEditDueTime, setDetailEditDueTime] = useState('')
  const [detailEditConsequence, setDetailEditConsequence] = useState('self')
  const [detailEditRecurrence, setDetailEditRecurrence] = useState('none')
  const [detailEditNotes, setDetailEditNotes] = useState('')
  const [detailSaving, setDetailSaving] = useState(false)

  // FIX 3: Bulk task import
  const [addMode, setAddMode] = useState('single')
  const [bulkText, setBulkText] = useState('')
  const [bulkParsing, setBulkParsing] = useState(false)
  const [bulkPreview, setBulkPreview] = useState([])
  const [bulkListening, setBulkListening] = useState(false)
  const bulkRecognitionRef = useRef(null)

  // FIX 4: Tutorial
  const [showTutorial, setShowTutorial] = useState(false)
  const [tutorialStep, setTutorialStep] = useState(0)

  // Finance sub-tabs
  const [financeSub, setFinanceSub] = useState('bills')
  const [expandedLearnCard, setExpandedLearnCard] = useState(null)
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [monthlyIncomeInput, setMonthlyIncomeInput] = useState('')
  const [learnReferral, setLearnReferral] = useState(null)
  const [incomeFrequency, setIncomeFrequency] = useState('monthly')
  const [billType, setBillType] = useState('bill')
  const [billInterestRate, setBillInterestRate] = useState('')

  // Journal history (up to 20 past entries)
  const [journalHistory, setJournalHistory] = useState([])

  // Habits tab
  const [habits, setHabits] = useState([])
  const [habitCompletions, setHabitCompletions] = useState([])
  const [habitsLoaded, setHabitsLoaded] = useState(false)
  const [showAddHabitOverlay, setShowAddHabitOverlay] = useState(false)
  const [newHabitName, setNewHabitName] = useState('')
  const [newHabitType, setNewHabitType] = useState('build')
  const [addingHabit, setAddingHabit] = useState(false)
  const [habitJournalExpanded, setHabitJournalExpanded] = useState(false)
  const [habitJournalMood, setHabitJournalMood] = useState(null)
  const [habitJournalText, setHabitJournalText] = useState('')
  const [habitJournalSending, setHabitJournalSending] = useState(false)
  const [habitJournalAiReply, setHabitJournalAiReply] = useState(null)

  // Tag Team tab
  const [crews, setCrews] = useState([])
  const [crewsLoaded, setCrewsLoaded] = useState(false)
  const [crewsLoading, setCrewsLoading] = useState(false)
  const [showCreateCrewOverlay, setShowCreateCrewOverlay] = useState(false)
  const [showJoinCrewOverlay, setShowJoinCrewOverlay] = useState(false)
  const [newCrewName, setNewCrewName] = useState('')
  const [newCrewType, setNewCrewType] = useState('crew')
  const [creatingCrew, setCreatingCrew] = useState(false)
  const [crewInviteCode, setCrewInviteCode] = useState(null)
  const [joinCode, setJoinCode] = useState('')
  const [joiningCrew, setJoiningCrew] = useState(false)
  const [nudgeSending, setNudgeSending] = useState(false)
  const [nudgeSent, setNudgeSent] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // Tab error states
  const [tasksError, setTasksError] = useState(false)
  const [habitsLoading, setHabitsLoading] = useState(false)
  const [habitsError, setHabitsError] = useState(false)
  const [billsLoading, setBillsLoading] = useState(false)
  const [billsError, setBillsError] = useState(false)
  const [progressError, setProgressError] = useState(false)

  // Check-in input ref (for CTA focus)
  const checkinInputRef = useRef(null)

  // S17 Tasks tab
  const [greetingDismissed, setGreetingDismissed] = useState(false)
  const greetCardHasAnimated = useRef(false)
  const [greetCardAnimate, setGreetCardAnimate] = useState(false)
  const [sectionCollapsed, setSectionCollapsed] = useState({ overdue: false, today: false, tomorrow: false, thisWeek: false, later: false, completedToday: true })

  // Streak celebration
  const [showStreakCelebration, setShowStreakCelebration] = useState(false)
  const [streakCelebMilestone, setStreakCelebMilestone] = useState(0)
  const [xpFloat, setXpFloat] = useState(null) // { taskId, amount }
  const [taskDragOver, setTaskDragOver] = useState(null)
  const [newTaskType, setNewTaskType] = useState('task')
  const [newTaskDates, setNewTaskDates] = useState([])
  const [calPickerMonth, setCalPickerMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [taskTimeHour, setTaskTimeHour] = useState(9)
  const [taskTimeMinute, setTaskTimeMinute] = useState(0)
  const [taskTimeEnabled, setTaskTimeEnabled] = useState(false)
  const [taskEstimated, setTaskEstimated] = useState('')
  const [addingTaskOverlay, setAddingTaskOverlay] = useState(false)

  // Live tick for countdown displays in task list
  const [tickNow, setTickNow] = useState(() => new Date())

  // Settings
  const [settingsName, setSettingsName] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [notifMorning, setNotifMorning] = useState(true)
  const [notifMidday, setNotifMidday] = useState(false)
  const [notifEvening, setNotifEvening] = useState(true)
  const [notifPermission, setNotifPermission] = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'default')
  const [checkinMorningTime, setCheckinMorningTime] = useState('08:00')
  const [checkinMiddayTime, setCheckinMiddayTime] = useState('12:00')
  const [checkinEveningTime, setCheckinEveningTime] = useState('21:00')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Bill voice input
  const [billListening, setBillListening] = useState(false)
  const [billVoiceTranscript, setBillVoiceTranscript] = useState('')
  const [billParsing, setBillParsing] = useState(false)
  const billRecognitionRef = useRef(null)

  // Next move
  const [nextMoveLoading, setNextMoveLoading] = useState(false)
  const [nextMoveResult, setNextMoveResult] = useState(null) // { raw, taskName, taskId }

  // Guide tab
  const [guideExpandedCard, setGuideExpandedCard] = useState(null)
  const [guideSelectedFilter, setGuideSelectedFilter] = useState('All')
  const [guideBookmarks, setGuideBookmarks] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cinis_guide_bookmarks')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })
  const [guideTried, setGuideTried] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('cinis_guide_tried')
        return saved ? JSON.parse(saved) : []
      } catch {
        return []
      }
    }
    return []
  })

  // Debug overlay
  const debugRef = useRef({ lastCall: null, lastError: null })
  const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=true')

  const loggedFetch = useCallback(async (url, opts = {}) => {
    const t0 = Date.now()
    try {
      const res = await fetch(url, opts)
      const clone = res.clone()
      const text = await clone.text().catch(() => '')
      debugRef.current.lastCall = {
        endpoint: url,
        method: opts.method || 'GET',
        status: res.status,
        ms: Date.now() - t0,
        preview: text.slice(0, 120),
      }
      // Return a new Response so callers can still call .json() etc.
      return new Response(text, { status: res.status, headers: res.headers })
    } catch (err) {
      debugRef.current.lastCall = { endpoint: url, method: opts.method || 'GET', status: 'ERR', ms: Date.now() - t0, preview: String(err) }
      debugRef.current.lastError = String(err)
      throw err
    }
  }, [])

  // ── Effects ──────────────────────────────────────────────────────────────

  // Restore theme immediately on mount from localStorage to avoid orange flash
  // while profile loads from Supabase (profile effect will correct it if needed)
  useEffect(() => {
    try {
      const savedColor = localStorage.getItem('fb_accent_color')
      if (savedColor) {
        const theme = THEMES.find(t => t.id === savedColor) || THEMES.find(t => t.accent === savedColor)
        if (theme) applyTheme(theme)
        else applyAccentColor(savedColor)
      }
    } catch {}
  }, [])

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good morning')
    else if (hour < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
  }, [])

  useEffect(() => {
    const hasSession = { current: false }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        hasSession.current = true
        setUser(session.user)
        // Only load data on initial session or explicit sign-in — not on token refresh,
        // which would overwrite in-flight optimistic updates (e.g. persona chip saves).
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          fetchProfile(session.user.id)
          fetchTasks(session.user.id)
          fetchProgressSnapshots(session.user.id)
        }
      } else if (event === 'SIGNED_OUT' && hasSession.current) {
        router.push('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (showAddModal) setTimeout(() => titleInputRef.current?.focus(), 50)
  }, [showAddModal])

  useEffect(() => {
    if (detailTask) {
      setDetailNoteEdit(detailTask.notes || '')
      setDetailNoteEditing(false)
      setDetailEditing(false)
    }
  }, [detailTask?.id])

  useEffect(() => {
    if (!profile) return
    const themeId = profile.accent_color && profile.accent_color.startsWith('#')
      ? null // legacy hex color, map to closest or default
      : profile.accent_color
    // Fallback: check localStorage if profile has no accent_color
    const resolvedId = themeId || (typeof localStorage !== 'undefined' ? localStorage.getItem('fb_accent_color') : null)
    const theme = THEMES.find(t => t.id === resolvedId) || THEMES.find(t => t.accent === profile.accent_color) || THEMES[0]
    setActiveTheme(theme)
    applyTheme(theme)
    if (profile.full_name) setSettingsName(profile.full_name)
    if (profile.morning_time) setCheckinMorningTime(profile.morning_time)
    if (profile.midday_time) setCheckinMiddayTime(profile.midday_time)
    if (profile.evening_time) setCheckinEveningTime(profile.evening_time)
    if (Array.isArray(profile.checkin_times)) {
      setNotifMorning(profile.checkin_times.includes('morning'))
      setNotifMidday(profile.checkin_times.includes('midday'))
      setNotifEvening(profile.checkin_times.includes('evening'))
    }
    // Streak celebration
    const STREAK_MILESTONES = [7, 14, 30, 60, 90, 365]
    const streak = profile.current_streak || 0
    if (STREAK_MILESTONES.includes(streak) && typeof localStorage !== 'undefined') {
      const celebKey = `streak_celebrated_${streak}`
      if (!localStorage.getItem(celebKey)) {
        localStorage.setItem(celebKey, '1')
        setStreakCelebMilestone(streak)
        setShowStreakCelebration(true)
      }
    }
  }, [profile])

  useEffect(() => {
    if (activeTab === 'checkin' && !checkinInitialized && user) {
      setCheckinInitialized(true)
      const chatKey = `cinis_checkin_${user.id}`
      const saved = loadChatHistory(chatKey)
      if (saved && saved.length > 0) {
        setCheckinMessages(saved)
        return
      }
      setCheckinLoading(true)
      loggedFetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, checkInType: getCheckinType(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      })
        .then(r => r.json())
        .then(data => {
          if (data.error === 'rate_limit_reached') {
            setCiRateLimitMsg("You've used all your check-ins for today. Upgrade to Pro for more.")
            return
          }
          if (data.message) {
            const msgs = [{ role: 'assistant', content: data.message }]
            setCheckinMessages(msgs)
            saveChatHistory(chatKey, msgs)
            setCiAiRateLocal(prev => (prev ?? (profile?.ai_interactions_today || 0)) + 1)
          }
          fetchTasks(user.id)
        })
        .catch(() => setCheckinMessages([{ role: 'assistant', content: "Hey — how are you doing today?" }]))
        .finally(() => setCheckinLoading(false))
    }
  }, [activeTab, user])

  useEffect(() => {
    checkinEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [checkinMessages, checkinLoading])

  useEffect(() => {
    journalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [journalMessages, journalLoading])

  useEffect(() => {
    if (activeTab === 'journal' && user) {
      fetchJournalEntries(user.id)
      fetchJournalHistory(user.id)
      const journalKey = `cinis_journal_history_${user.id}`
      const saved = loadChatHistory(journalKey)
      if (saved && saved.length > 0) setJournalMessages(saved)
    }
  }, [activeTab, user])

  // Auto-save journal session and show toast when leaving the journal tab
  useEffect(() => {
    if (prevTabRef.current === 'journal' && activeTab !== 'journal') {
      if (journalMessages && journalMessages.length > 0) {
        if (user) fetchJournalEntries(user.id)
        showToast('Journal session saved')
      }
    }
    prevTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'progress' && user && !progressInsightsLoaded) {
      fetchProgressInsights()
    }
  }, [activeTab, user])

  // Global Escape key → close topmost modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (showSessionEndModal) { setShowSessionEndModal(false); return }
      if (calDayPanelOpen) { setCalDayPanelOpen(false); return }
      if (showPersonaModal) { setShowPersonaModal(false); return }
      if (showAlarmsModal) { setShowAlarmsModal(false); return }
      if (showGuideModal) { setShowGuideModal(false); return }
      if (showAddBillModal) { setShowAddBillModal(false); return }
      if (detailTask) { setDetailTask(null); setDetailEditing(false); return }
      if (showAddModal) { setShowAddModal(false); return }
      if (showMoreDrawer) { setShowMoreDrawer(false); return }
      if (showTutorial) { setShowTutorial(false); return }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSessionEndModal, showPersonaModal, showAlarmsModal, showGuideModal,
      showAddBillModal, detailTask, showAddModal, showMoreDrawer, showTutorial])

  useEffect(() => {
    if (activeTab === 'progress' && user) {
      if (!weeklySummaryInitialized) fetchWeeklySummary()
      fetchJournalEntries(user.id) // refresh so Today journalCount is current
    }
  }, [activeTab, user])

  useEffect(() => {
    if (activeTab === 'progress' && progressBand === 'month' && user && !monthlySummaryInitialized) {
      fetchMonthlySummary()
    }
  }, [progressBand, activeTab, user])

  useEffect(() => {
    if (activeTab === 'finance' && user && !billsLoaded) {
      fetchBills(user.id)
    }
  }, [activeTab, user])

  useEffect(() => {
    if (activeTab === 'habits' && user && !habitsLoaded) {
      fetchHabits(user.id)
    }
  }, [activeTab, user])

  useEffect(() => {
    if (activeTab === 'tagteam' && user && !crewsLoaded) {
      fetchCrews(user.id)
    }
  }, [activeTab, user])

  // Cleanup focus timer on unmount
  useEffect(() => {
    return () => clearInterval(focusIntervalRef.current)
  }, [])

  // Auto-scroll calendar day view to current time
  useEffect(() => {
    if (calView === 'day' && calDay) {
      setTimeout(() => {
        const nowSlot = document.getElementById('time-slot-now')
        if (nowSlot) nowSlot.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [calView, calDay])

  // Tick every 30s so getCountdownDisplay stays fresh in task list
  useEffect(() => {
    const interval = setInterval(() => setTickNow(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  // Alarm checking
  useEffect(() => {
    if (!user) return
    alarmIntervalRef.current = setInterval(() => checkAlarms(), 60000)
    return () => clearInterval(alarmIntervalRef.current)
  }, [user, alarms])

  useEffect(() => {
    if (activeTab === 'checkin' && user && !alarmsLoaded) {
      fetchAlarms(user.id)
    }
  }, [activeTab, user])

  // FIX 1: load drag hint dismissed state from localStorage
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('fb_drag_hint_dismissed')) {
      setDragHintDismissed(true)
    }
  }, [])

  // Finance: load monthly income + frequency from localStorage
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = parseFloat(localStorage.getItem('fb_monthly_income') || '0') || 0
      setMonthlyIncome(saved)
      setMonthlyIncomeInput(saved > 0 ? String(saved) : '')
      const freq = localStorage.getItem('fb_income_frequency') || 'monthly'
      setIncomeFrequency(freq)
    }
  }, [])

  // FIX 4: show tutorial for new users
  useEffect(() => {
    if (profile && profile.tutorial_completed === false) {
      setShowTutorial(true)
    }
  }, [profile])

  // S17: Load greeting dismissed + section collapse state from localStorage
  useEffect(() => {
    if (typeof localStorage === 'undefined') return
    if (localStorage.getItem(`greeting_dismissed_${todayStr()}`)) setGreetingDismissed(true)
    const collapsed = {}
    ;['overdue','today','tomorrow','thisWeek','later','completedToday'].forEach(s => {
      const v = localStorage.getItem(`task_section_collapsed_${s}`)
      if (v !== null) collapsed[s] = v === 'true'
    })
    if (Object.keys(collapsed).length > 0) setSectionCollapsed(prev => ({ ...prev, ...collapsed }))
  }, [])

  // Greeting card animation — play once per session when tasks tab opens with card visible
  useEffect(() => {
    if (activeTab === 'tasks' && !greetingDismissed && !greetCardHasAnimated.current) {
      greetCardHasAnimated.current = true
      setGreetCardAnimate(true)
    }
  }, [activeTab, greetingDismissed])

  // ── Seed / reset QC helpers (only active when ?debug=true is in URL) ──────

  useEffect(() => {
    if (!user || !isDebug) return
    const url = new URLSearchParams(window.location.search)
    const doSeed = url.get('seed') === 'true'
    const doReset = url.get('reset') === 'true'
    if (!doSeed && !doReset) return

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      }

      const cleanUrl = () => {
        const u = new URLSearchParams(window.location.search)
        u.delete('seed')
        u.delete('reset')
        const qs = u.toString()
        window.history.replaceState({}, '', qs ? `?${qs}` : window.location.pathname)
      }

      if (doSeed) {
        fetch('/api/seed-test-data', { method: 'POST', headers })
          .then(r => r.json())
          .then(data => {
            console.log('[QC] seed complete', data)
            cleanUrl()
            loadAllData(user.id)
          })
          .catch(err => console.error('[QC] seed error', err))
      }

      if (doReset) {
        fetch('/api/reset-test-data', { method: 'POST', headers })
          .then(r => r.json())
          .then(data => {
            console.log('[QC] reset complete', data)
            cleanUrl()
            loadAllData(user.id)
          })
          .catch(err => console.error('[QC] reset error', err))
      }
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data fetching ─────────────────────────────────────────────────────────

  const loadAllData = (userId) => {
    fetchTasks(userId)
    fetchBills(userId)
    fetchJournalEntries(userId)
  }

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
      // Apply theme immediately from loaded profile to prevent race condition
      if (data.accent_color) {
        const savedTheme = THEMES.find(t => t.id === data.accent_color) || THEMES.find(t => t.accent === data.accent_color) || THEMES[0]
        applyTheme(savedTheme)
        if (typeof localStorage !== 'undefined') localStorage.setItem('fb_accent_color', savedTheme.id)
      }
    }
    else router.push('/onboarding')
  }

  const fetchTasks = async (userId) => {
    setTasksError(false)
    try {
      const { data, error } = await supabase
        .from('tasks').select('*').eq('user_id', userId).eq('archived', false)
        .order('sort_order', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      setTasks(data || [])
    } catch {
      setTasksError(true)
    } finally {
      setLoading(false)
    }
  }

  const fetchJournalEntries = async (userId) => {
    setJournalEntriesLoaded(true)
    const { data } = await supabase
      .from('journal_entries').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(5)
    setJournalEntries(data || [])
  }

  const fetchJournalHistory = async (userId) => {
    const { data } = await supabase
      .from('journal_entries').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(20)
    setJournalHistory(data || [])
  }

  const fetchHabits = async (userId) => {
    setHabitsLoaded(true)
    setHabitsLoading(true)
    setHabitsError(false)
    try {
      const res = await loggedFetch(`/api/habits?userId=${userId}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setHabits(data.habits || [])
      setHabitCompletions(data.completions || [])
    } catch {
      setHabitsError(true)
    } finally {
      setHabitsLoading(false)
    }
  }

  const fetchCrews = async (userId) => {
    setCrewsLoaded(true)
    setCrewsLoading(true)
    try {
      const res = await loggedFetch(`/api/crews?userId=${userId}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setCrews(data.crews || [])
    } catch {
      // silently fail — non-critical tab
    } finally {
      setCrewsLoading(false)
    }
  }

  const createCrew = async (e) => {
    e.preventDefault()
    if (!newCrewName.trim() || !user) return
    setCreatingCrew(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await loggedFetch('/api/crews/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: newCrewName.trim(), crew_type: newCrewType }),
      })
      const data = await res.json()
      if (data.crew) {
        setCrewInviteCode(data.crew.invite_code)
        setCrews(prev => [...prev, { ...data.crew, members: [{ user_id: user.id, role: 'owner', full_name: profile?.full_name || null }], activity: [] }])
        setNewCrewName('')
        setNewCrewType('crew')
      }
    } catch { /* no-op */ }
    setCreatingCrew(false)
  }

  const joinCrew = async (e) => {
    e.preventDefault()
    if (!joinCode.trim() || !user) return
    setJoiningCrew(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const res = await loggedFetch('/api/crews/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ invite_code: joinCode.trim() }),
      })
      const data = await res.json()
      if (data.crew) {
        setJoinCode('')
        setShowJoinCrewOverlay(false)
        fetchCrews(user.id)
      }
    } catch { /* no-op */ }
    setJoiningCrew(false)
  }

  const nudgeCrew = async (crewId) => {
    if (!user || nudgeSending) return
    setNudgeSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      await loggedFetch('/api/crews/nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ crew_id: crewId, emoji: '👋' }),
      })
      setNudgeSent(true)
      setTimeout(() => setNudgeSent(false), 2500)
      // Refresh activity
      fetchCrews(user.id)
    } catch { /* no-op */ }
    setNudgeSending(false)
  }

  const fetchProgressInsights = async () => {
    if (!user) return
    setProgressInsightsLoaded(true)
    setProgressInsightsLoading(true)
    try {
      const res = await loggedFetch(`/api/progress/insights?userId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        setProgressInsights(data.insights || [])
      } else {
        setProgressError(true)
      }
    } catch {
      setProgressError(true)
    }
    setProgressInsightsLoading(false)
  }

  const fetchWeeklySummary = async () => {
    if (!user) return
    setWeeklySummaryInitialized(true)
    setWeeklySummaryLoading(true)
    try {
      const res = await loggedFetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, checkInType: 'weekly_summary', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      })
      const data = await res.json()
      setWeeklySummary(data.message || '')
    } catch {
      setWeeklySummary('')
    }
    setWeeklySummaryLoading(false)
  }

  const fetchMonthlySummary = async () => {
    if (!user) return
    setMonthlySummaryInitialized(true)
    setMonthlySummaryLoading(true)
    try {
      const res = await loggedFetch(`/api/progress?type=monthly&userId=${user.id}`)
      const data = await res.json()
      setMonthlySummary(data.insight || '')
    } catch {
      setMonthlySummary('')
    }
    setMonthlySummaryLoading(false)
  }

  const fetchProgressSnapshots = async (userId) => {
    try {
      const { data } = await supabase
        .from('progress_snapshots').select('*').eq('user_id', userId)
        .order('snapshot_date', { ascending: false })
      setProgressSnapshots(data || [])
    } catch {
      setProgressSnapshots([])
    }
  }

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

  const fetchAlarms = async (userId) => {
    setAlarmsLoaded(true)
    const { data } = await supabase.from('alarms').select('*').eq('user_id', userId).eq('triggered', false).order('alarm_time', { ascending: true })
    setAlarms(data || [])
  }

  const addAlarm = async (e) => {
    e.preventDefault()
    if (!newAlarmTime || !newAlarmTitle.trim() || !user) return
    setAddingAlarm(true)
    const alarm = {
      user_id: user.id,
      alarm_time: new Date(newAlarmTime).toISOString(),
      title: newAlarmTitle.trim(),
      repeat: newAlarmRepeat,
      triggered: false,
      created_at: new Date().toISOString(),
    }
    const { data } = await supabase.from('alarms').insert(alarm).select().single()
    if (data) setAlarms(prev => [...prev, data])
    setNewAlarmTime(''); setNewAlarmTitle(''); setNewAlarmRepeat('once')
    setAddingAlarm(false)
  }

  const deleteAlarm = async (id) => {
    await supabase.from('alarms').delete().eq('id', id)
    setAlarms(prev => prev.filter(a => a.id !== id))
  }

  const checkAlarms = () => {
    const now = new Date()
    setAlarms(prev => {
      let changed = false
      const updated = prev.map(alarm => {
        if (alarm.triggered) return alarm
        const alarmTime = new Date(alarm.alarm_time)
        if (now >= alarmTime) {
          changed = true
          // Fire alarm
          fireAlarm(alarm)
          return { ...alarm, triggered: true }
        }
        return alarm
      })
      if (changed) {
        // Mark triggered in DB
        updated.filter(a => a.triggered && !prev.find(p => p.id === a.id)?.triggered).forEach(a => {
          supabase.from('alarms').update({ triggered: true }).eq('id', a.id)
        })
      }
      return updated
    })
  }

  const fireAlarm = (alarm) => {
    // In-app banner
    setActiveAlarmBanner(alarm)
    // Browser notification
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(alarm.title, { body: 'Cinis reminder', icon: '/favicon.ico' })
    }
    // Web Audio beep
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 520; osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 1.2)
    } catch {}
  }

  // ── Task form ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setNewTitle(''); setNewDueDate(''); setNewDueTime('')
    setNewConsequence('self'); setNewNotes(''); setNewRecurrence('none')
    setVoiceTranscript('')
  }

  const addTask = async (e) => {
    e.preventDefault()
    if (!user) return
    if (!newTitle.trim()) {
      showToast('Please enter a task name')
      setTitleInputError(true)
      setTimeout(() => setTitleInputError(false), 1200)
      return
    }
    setAdding(true)
    let due_time = null
    if (newDueDate) {
      const dateStr = newDueTime ? `${newDueDate}T${newDueTime}` : `${newDueDate}T23:59`
      due_time = new Date(dateStr).toISOString()
    }
    const task = {
      user_id: user.id, title: newTitle.trim(), completed: false, archived: false,
      due_time, consequence_level: newConsequence, notes: newNotes.trim() || null,
      recurrence: newRecurrence, rollover_count: 0, priority_score: 0,
      created_at: new Date().toISOString(), scheduled_for: new Date().toISOString(),
      starred: false, task_type: 'regular', estimated_minutes: null
    }
    const { data } = await supabase.from('tasks').insert(task).select().single()
    if (data) setTasks(prev => [data, ...prev])
    resetForm(); setAdding(false); setShowAddModal(false)
  }

  const addTaskQuick = async (title) => {
    if (!title || !user) return
    const task = {
      user_id: user.id, title, completed: false, archived: false, due_time: null,
      consequence_level: 'self', notes: null, recurrence: 'none', rollover_count: 0,
      priority_score: 0, created_at: new Date().toISOString(), scheduled_for: new Date().toISOString(),
      starred: false, task_type: 'regular', estimated_minutes: null
    }
    const { data } = await supabase.from('tasks').insert(task).select().single()
    if (data) setTasks(prev => [data, ...prev])
    showToast('Task added ✓')
  }

  // ── Voice input ───────────────────────────────────────────────────────────

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { alert('Voice input not supported. Try Chrome or Safari.'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = false
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onresult = async (event) => {
      const transcript = event.results[0][0].transcript
      setVoiceTranscript(transcript); setParsing(true)
      try {
        const res = await loggedFetch('/api/parse-task', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript })
        })
        const parsed = await res.json()
        if (parsed.title) setNewTitle(parsed.title)
        if (parsed.due_date) setNewDueDate(parsed.due_date)
        if (parsed.due_time) setNewDueTime(parsed.due_time)
        if (parsed.consequence_level) setNewConsequence(parsed.consequence_level)
        if (parsed.notes) setNewNotes(parsed.notes)
        if (parsed.recurrence) setNewRecurrence(parsed.recurrence)
      } catch (err) { console.error('[voice] Parse error:', err) }
      setParsing(false)
    }
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition; recognition.start()
  }

  const stopListening = () => { recognitionRef.current?.stop(); setListening(false) }

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

  // ── Voice FAB ─────────────────────────────────────────────────────────────

  const startVoiceFab = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      libShowToast('Voice input not supported in this browser.', { type: 'error' })
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onstart = () => setVoiceFabState('recording')
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setVoiceFabState('processing')
      handleVoiceInput(transcript)
    }
    recognition.onerror = () => {
      setVoiceFabState('idle')
      libShowToast('Could not hear you. Try again.', { type: 'error' })
    }
    recognition.onend = () => {
      setVoiceFabState(prev => prev === 'recording' ? 'idle' : prev)
    }
    voiceFabRecognitionRef.current = recognition
    recognition.start()
  }

  const stopVoiceFab = () => {
    voiceFabRecognitionRef.current?.stop()
  }

  const handleVoiceFabClick = () => {
    if (voiceFabState === 'idle') startVoiceFab()
    else if (voiceFabState === 'recording') stopVoiceFab()
  }

  const handleVoiceInput = async (transcript) => {
    try {
      const res = await loggedFetch('/api/voice/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript })
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed')
      setVoiceFabState('idle')
      if (user) fetchTasks(user.id)
      libShowToast(`Created: ${data.message}`, {
        type: 'undo',
        duration: 5000,
        undoCallback: () => handleUndoVoiceTask(data.record.id, data.type)
      })
    } catch {
      setVoiceFabState('idle')
      libShowToast('Could not create task. Try again.', { type: 'error' })
    }
  }

  const handleUndoVoiceTask = async (id, type) => {
    try {
      if (type === 'bill') {
        await loggedFetch(`/api/bills/${id}`, { method: 'DELETE' })
      } else {
        await loggedFetch(`/api/tasks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: true })
        })
      }
      if (user) fetchTasks(user.id)
      libShowToast('Undone.', { type: 'success', duration: 2000 })
    } catch {
      libShowToast('Could not undo. Try again.', { type: 'error' })
    }
  }

  // ── Check-in voice input ───────────────────────────────────────────────────

  const startCheckinVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      libShowToast('Voice input not supported in this browser.', { type: 'error' })
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let isFirstResult = true
    let silenceTimeout

    recognition.onstart = () => setCheckinVoiceListening(true)

    recognition.onresult = (event) => {
      let interimTranscript = ''
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }
      if (finalTranscript) {
        setCheckinInput(prev => (prev + ' ' + finalTranscript).trim())
        isFirstResult = false
        // Reset silence timer when we get final results
        clearTimeout(silenceTimeout)
        silenceTimeout = setTimeout(() => {
          recognition.stop()
        }, 1500)
      }
    }

    recognition.onerror = () => {
      setCheckinVoiceListening(false)
      libShowToast('Could not hear you. Try again.', { type: 'error' })
    }

    recognition.onend = () => {
      setCheckinVoiceListening(false)
      clearTimeout(silenceTimeout)
    }

    checkinVoiceRecognitionRef.current = recognition
    recognition.start()
  }

  const stopCheckinVoice = () => {
    checkinVoiceRecognitionRef.current?.stop()
  }

  const handleCheckinVoiceClick = () => {
    if (checkinVoiceListening) {
      stopCheckinVoice()
    } else {
      startCheckinVoice()
    }
  }

  // ── Task actions ──────────────────────────────────────────────────────────

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
    tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0)
    const updated = {
      ...task, scheduled_for: tomorrow.toISOString(),
      due_time: task.due_time ? tomorrow.toISOString() : null,
      rollover_count: (task.rollover_count || 0) + 1
    }
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    await supabase.from('tasks').update({
      scheduled_for: updated.scheduled_for, due_time: updated.due_time, rollover_count: updated.rollover_count
    }).eq('id', task.id)
  }

  const archiveTask = async (task) => {
    await supabase.from('tasks').update({ archived: true }).eq('id', task.id)
    setTasks(prev => prev.filter(t => t.id !== task.id))
  }

  // ── Check-in ──────────────────────────────────────────────────────────────

  const sendCheckinMsg = async (text) => {
    if (!text.trim() || checkinLoading || !user) return
    const chatKey = `cinis_checkin_${user.id}`
    const userMsg = { role: 'user', content: text.trim() }
    const updated = [...checkinMessages, userMsg]
    setCheckinMessages(updated)
    setCheckinInput('')
    setCheckinLoading(true)
    setCiError(null)
    setCiRateLimitMsg(null)
    try {
      const res = await loggedFetch('/api/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, checkInType: getCheckinType(), messages: updated, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      })
      const data = await res.json()
      if (data.error === 'rate_limit_reached') {
        setCiRateLimitMsg("You've used all your check-ins for today. Upgrade to Pro for more.")
      } else if (data.message) {
        setCheckinMessages(prev => {
          const next = [...prev, { role: 'assistant', content: data.message }]
          saveChatHistory(chatKey, next)
          return next
        })
        setCiAiRateLocal(prev => (prev ?? (profile?.ai_interactions_today || 0)) + 1)
      } else {
        saveChatHistory(chatKey, updated)
      }
      fetchTasks(user.id)
      if (billsLoaded) fetchBills(user.id)
      fetchAlarms(user.id)
    } catch {
      setCiError("Something went wrong. Try again.")
    }
    setCheckinLoading(false)
  }

  const sendCheckinMessage = async (e) => {
    e.preventDefault()
    await sendCheckinMsg(checkinInput)
  }

  // ── Journal ───────────────────────────────────────────────────────────────

  const sendJournalMessage = async (e) => {
    e.preventDefault()
    if (!journalInput.trim() || journalLoading) return
    const journalKey = `cinis_journal_history_${user.id}`
    const content = journalInput.trim()
    const newMsg = { role: 'user', content }
    setJournalMessages(prev => [...prev, newMsg])
    setJournalInput(''); setJournalLoading(true)
    try {
      const res = await loggedFetch('/api/journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content, conversationHistory: journalMessages })
      })
      const data = await res.json()
      if (!res.ok) {
        setJournalMessages(prev => [...prev, { role: 'assistant', content: "I'm here. Keep going." }])
      } else if (data.message) {
        setJournalMessages(prev => {
          const next = [...prev, { role: 'assistant', content: data.message }]
          saveChatHistory(journalKey, next)
          return next
        })
        const userMsgCount = journalMessages.filter(m => m.role === 'user').length + 1
        if (!journalReminderShown && userMsgCount >= 3) { setJournalReminderShown(true); setShowJournalReminder(true) }
        if (data.detectedTasks?.length > 0) {
          const existingTitles = tasks
            .filter(t => !t.completed && !t.archived)
            .map(t => t.title.toLowerCase())
          const newPending = data.detectedTasks.filter(dt =>
            !existingTitles.some(et => et.includes(dt.title.toLowerCase()) || dt.title.toLowerCase().includes(et))
          )
          if (newPending.length > 0) setJournalPendingTasks(newPending)
        }
      }
    } catch {
      setJournalMessages(prev => [...prev, { role: 'assistant', content: "I'm here. Keep going." }])
    }
    setJournalLoading(false)
  }

  const addJournalDetectedTask = async (task) => {
    if (!task || !user) return
    const todayNoon = new Date(); todayNoon.setHours(12, 0, 0, 0)
    const { data: inserted } = await supabase.from('tasks').insert({
      user_id: user.id,
      title: task.title,
      task_type: task.task_type || 'task',
      scheduled_for: task.scheduled_for || todayNoon.toISOString(),
      completed: false,
      archived: false,
      rollover_count: 0,
      starred: false,
      sort_order: 0,
    }).select().single()
    if (inserted) setTasks(prev => [inserted, ...prev])
    setJournalPendingTasks(prev => prev.filter(t => t.title !== task.title))
  }

  const newJournalEntry = async () => {
    // Save current conversation to DB (already saved per message by API, just clear UI)
    setJournalMessages([])
    setJournalPendingTasks([])
    setJournalInput('')
    fetchJournalEntries(user.id)
  }

  // ── Focus mode ────────────────────────────────────────────────────────────

  const startFocus = () => {
    const dur = focusCustom ? parseInt(focusCustom) : focusDuration
    if (!dur || dur < 1) return
    const secs = dur * 60
    setFocusTimeLeft(secs); setFocusPhase('active'); setFocusRunning(true)
    focusIntervalRef.current = setInterval(() => {
      setFocusTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(focusIntervalRef.current)
          setFocusRunning(false); setFocusPhase('setup')
          setSessionEndType('complete'); setShowSessionEndModal(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const toggleFocusPause = () => {
    if (focusRunning) {
      clearInterval(focusIntervalRef.current); setFocusRunning(false)
    } else {
      focusIntervalRef.current = setInterval(() => {
        setFocusTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(focusIntervalRef.current)
            setFocusRunning(false); setFocusPhase('setup')
            setSessionEndType('complete'); setShowSessionEndModal(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      setFocusRunning(true)
    }
  }

  const handleFocusResult = async (result) => {
    const dur = focusCustom ? parseInt(focusCustom) : focusDuration
    setShowSessionEndModal(false)
    if (result === 'complete') {
      if (topTask) completeTask(topTask)
      setFocusPhase('setup'); setFocusCustom('')
      showToast('Task complete ✓')
    } else if (result === 'progress') {
      if (topTask) {
        await supabase.from('tasks').update({ notes: 'In progress' }).eq('id', topTask.id)
        setTasks(prev => prev.map(t => t.id === topTask.id ? { ...t, notes: 'In progress' } : t))
      }
      setFocusPhase('setup'); setFocusCustom('')
    } else if (result === 'stuck') {
      setFocusPhase('stuck'); setFocusAiLoading(true)
      switchTab('checkin')
      try {
        const res = await loggedFetch('/api/focus', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, outcome: 'stuck', taskTitle: topTask?.title, focusDuration: dur })
        })
        const data = await res.json()
        setFocusAiResponse(data.message || "What felt hardest about starting that?")
      } catch {
        setFocusAiResponse("What felt hardest about starting that?")
      }
      setFocusAiLoading(false)
    }
  }

  const handleAbandonSession = () => {
    setShowAbandonConfirm(true)
  }

  const confirmAbandon = () => {
    setShowAbandonConfirm(false)
    clearInterval(focusIntervalRef.current)
    setFocusRunning(false)
    setFocusPhase('setup')
    setSessionEndType('abandoned')
    setShowSessionEndModal(true)
  }

  // ── Finance ───────────────────────────────────────────────────────────────

  const addBill = async (e) => {
    e.preventDefault()
    if (!newBillName.trim() || !newBillAmount || !user) return
    setAddingBill(true)
    const bill = {
      user_id: user.id, name: newBillName.trim(),
      amount: parseFloat(newBillAmount),
      due_day: newBillDueDay ? parseInt(newBillDueDay) : null,
      frequency: newBillFrequency, category: newBillCategory || 'Other',
      auto_task: newBillAutoTask, created_at: new Date().toISOString(),
      bill_type: billType,
      ...(billInterestRate ? { interest_rate: parseFloat(billInterestRate) } : {}),
    }
    const { data } = await supabase.from('bills').insert(bill).select().single()
    if (data) setBills(prev => [data, ...prev])
    setNewBillName(''); setNewBillAmount(''); setNewBillDueDay('')
    setNewBillFrequency('monthly'); setNewBillCategory(''); setNewBillAutoTask(true)
    setBillType('bill'); setBillInterestRate('')
    setAddingBill(false); setShowAddBillModal(false)
  }

  const deleteBill = async (id) => {
    await supabase.from('bills').delete().eq('id', id)
    setBills(prev => prev.filter(b => b.id !== id))
  }

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

  const saveSettings = async () => {
    if (!user || !settingsName.trim()) return
    setSettingsSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      console.error('[settings] No session token available')
      setSettingsSaving(false)
      return
    }
    const payload = { userId: user.id, updates: { full_name: settingsName.trim() } }
    const response = await fetch('/api/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    })
    console.log('[settings] saved successfully', response.status)
    setProfile(prev => ({ ...prev, full_name: settingsName.trim() }))
    setSettingsSaving(false)
    showToast('Settings saved')
  }

  const saveTheme = async (theme) => {
    setActiveTheme(theme)
    setProfile(prev => ({ ...prev, accent_color: theme.id }))
    if (typeof localStorage !== 'undefined') localStorage.setItem('fb_accent_color', theme.id)
    if (user) {
      const themeId = theme.name?.toLowerCase() || theme.id
      const ok = await patchSettings({ accent_color: theme.id, theme_id: themeId })
      if (ok) applyTheme(theme)
    } else {
      applyTheme(theme)
    }
  }

  const handleExportData = async () => {
    setExportLoading(true)
    setExportError(null)
    try {
      const res = await fetch('/api/export', {
        method: 'GET',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const today = new Date().toISOString().split('T')[0]
      const a = document.createElement('a')
      a.href = url
      a.download = `cinis-export-${today}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Data exported successfully')
    } catch (err) {
      setExportError('Export failed — try again')
    } finally {
      setExportLoading(false)
    }
  }

  // ── Push notification toggle ───────────────────────────────────────────────

  const handleEnablePush = async () => {
    try {
      const sub = await requestNotificationPermission()
      if (sub) {
        await patchSettings({
          push_notifications_enabled: true,
          push_subscription: sub.toJSON(),
        })
        try { localStorage.setItem('fb_push_enabled', 'true') } catch {}
        setProfile(prev => ({ ...prev, push_notifications_enabled: true }))
        setNotifPermission('granted')
        showToast('Push notifications enabled')
      } else {
        setNotifPermission('denied')
        showToast('Notifications blocked in browser settings')
      }
    } catch (err) {
      console.error('[push] enable error:', err)
      showToast('Could not enable notifications')
    }
  }

  const handleDisablePush = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        const existingSub = await reg.pushManager.getSubscription()
        if (existingSub) await existingSub.unsubscribe()
      }
      await patchSettings({ push_notifications_enabled: false, push_subscription: null })
      setProfile(prev => ({ ...prev, push_notifications_enabled: false }))
      try { localStorage.removeItem('fb_push_enabled') } catch {}
      showToast('Push notifications disabled')
    } catch (err) {
      console.error('[push] disable error:', err)
      showToast('Could not disable notifications')
    }
  }

  // ── Persona ───────────────────────────────────────────────────────────────

  const openPersonaModal = () => {
    const raw = profile?.persona_blend || []
    // Normalize: onboarding may have stored labels; Settings stores keys — handle both
    const normalized = raw.map(v => {
      if (PERSONAS_LIST.find(p => p.key === v)) return v
      const byLabel = PERSONAS_LIST.find(p => p.label === v || p.label.toLowerCase() === v?.toLowerCase())
      return byLabel ? byLabel.key : null
    }).filter(Boolean)
    setPersonaSelection(normalized.length ? normalized : raw)
    setPersonaVoice(profile?.persona_voice || 'female')
    setShowPersonaModal(true)
  }

  const savePersona = async () => {
    if (!personaSelection.length || !user) return
    setPersonaSaving(true)
    const ok = await patchSettings({ persona_blend: personaSelection, persona_voice: personaVoice, persona_set: true })
    setPersonaSaving(false)
    if (ok) {
      setProfile(prev => ({ ...prev, persona_blend: personaSelection, persona_voice: personaVoice, persona_set: true }))
      setShowPersonaModal(false)
      showToast('Persona updated')
    } else {
      showToast('Could not save persona — try again')
    }
  }

  const togglePersonaSelection = (key) => {
    setPersonaSelection(prev => {
      if (prev.includes(key)) return prev.length > 1 ? prev.filter(k => k !== key) : prev
      return prev.length < 3 ? [...prev, key] : prev
    })
  }

  // ── Misc ──────────────────────────────────────────────────────────────────

  const saveDetailNote = async () => {
    const notes = detailNoteEdit.trim() || null
    const updated = { ...detailTask, notes }
    setTasks(prev => prev.map(t => t.id === detailTask.id ? updated : t))
    setDetailTask(updated)
    await supabase.from('tasks').update({ notes }).eq('id', detailTask.id)
  }

  // FIX 1
  const dismissDragHint = () => {
    setDragHintDismissed(true)
    if (typeof localStorage !== 'undefined') localStorage.setItem('fb_drag_hint_dismissed', '1')
  }

  // FIX 2: Task edit mode
  const openDetailEdit = () => {
    const t = detailTask
    setDetailEditTitle(t.title)
    const due = t.due_time ? new Date(t.due_time) : null
    const existingDate = due ? due.toISOString().split('T')[0] : (t.scheduled_for ? new Date(t.scheduled_for).toISOString().split('T')[0] : '')
    setDetailEditDueDate(existingDate)
    setDetailEditDueTime(due ? `${String(due.getHours()).padStart(2,'0')}:${String(due.getMinutes()).padStart(2,'0')}` : '')
    setDetailEditConsequence(t.consequence_level || 'self')
    setDetailEditRecurrence(t.recurrence || 'none')
    setDetailEditNotes(t.notes || '')
    setDetailEditing(true)
  }

  const saveDetailEdit = async () => {
    if (!detailEditTitle.trim()) return
    setDetailSaving(true)
    let due_time = null
    if (detailEditDueDate) {
      const dateStr = detailEditDueTime ? `${detailEditDueDate}T${detailEditDueTime}` : `${detailEditDueDate}T23:59`
      due_time = new Date(dateStr).toISOString()
    }
    const updates = {
      title: detailEditTitle.trim(),
      due_time,
      consequence_level: detailEditConsequence,
      recurrence: detailEditRecurrence,
      notes: detailEditNotes.trim() || null,
    }
    await supabase.from('tasks').update(updates).eq('id', detailTask.id)
    const updated = { ...detailTask, ...updates }
    setTasks(prev => prev.map(t => t.id === detailTask.id ? updated : t))
    setDetailTask(updated)
    setDetailEditing(false)
    setDetailSaving(false)
    showToast('Task updated')
  }

  // FIX 3: Bulk task import
  const parseBulkTasks = async () => {
    if (!bulkText.trim()) { showToast('Paste or speak your tasks first'); return }
    setBulkParsing(true)
    try {
      const res = await loggedFetch('/api/parse-bulk-tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bulkText })
      })
      const data = await res.json()
      setBulkPreview((data.tasks || []).map((t, i) => ({ ...t, _id: i })))
    } catch { showToast('Parse failed — try again') }
    setBulkParsing(false)
  }

  const addAllBulkTasks = async () => {
    if (!bulkPreview.length || !user) return
    const inserts = bulkPreview.map(t => {
      let due_time = null
      if (t.due_date) {
        const dateStr = t.due_time ? `${t.due_date}T${t.due_time}` : `${t.due_date}T23:59`
        due_time = new Date(dateStr).toISOString()
      }
      return {
        user_id: user.id, title: t.title, completed: false, archived: false,
        due_time, consequence_level: t.consequence_level || 'self',
        notes: t.notes || null, recurrence: t.recurrence || 'none',
        rollover_count: 0, priority_score: 0,
        created_at: new Date().toISOString(), scheduled_for: t.due_date ? new Date(`${t.due_date}T09:00`).toISOString() : new Date().toISOString(),
        starred: false, task_type: 'regular', estimated_minutes: null
      }
    })
    const { data } = await supabase.from('tasks').insert(inserts).select()
    if (data) setTasks(prev => [...data, ...prev])
    setBulkPreview([]); setBulkText(''); setAddMode('single'); setShowAddModal(false)
    showToast(`${inserts.length} task${inserts.length !== 1 ? 's' : ''} added`)
  }

  const startBulkListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input not supported. Try Chrome or Safari.'); return }
    const recognition = new SR()
    recognition.lang = 'en-US'; recognition.continuous = false; recognition.interimResults = false
    recognition.onstart = () => setBulkListening(true)
    recognition.onend = () => setBulkListening(false)
    recognition.onresult = (e) => {
      const t = e.results[0][0].transcript
      setBulkText(prev => prev ? prev + '\n' + t : t)
    }
    recognition.onerror = () => setBulkListening(false)
    bulkRecognitionRef.current = recognition; recognition.start()
  }

  // FIX 4: Tutorial
  const dismissTutorial = async (complete) => {
    setShowTutorial(false)
    if (complete && user) {
      await supabase.from('profiles').update({ tutorial_completed: true }).eq('id', user.id)
      setProfile(prev => ({ ...prev, tutorial_completed: true }))
    }
  }

  const handleRunRollover = async () => {
    try {
      const res = await loggedFetch('/api/rollover-tasks', { method: 'POST' })
      const data = await res.json()
      showToast(`Rolled ${data.rolled} task${data.rolled !== 1 ? 's' : ''}`)
      if (data.rolled > 0) fetchTasks(user.id)
    } catch { showToast('Rollover failed') }
  }

  const fetchNextMove = async () => {
    if (!user || nextMoveLoading) return
    setNextMoveLoading(true)
    setNextMoveResult(null)
    try {
      const pending = tasks.filter(t => !t.completed && !t.archived)
      const res = await loggedFetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'NEXT_MOVE_REQUEST',
          tasks: pending,
          userId: user.id,
          checkInType: 'next_move',
        })
      })
      const data = await res.json()
      const raw = data.message || ''
      // Extract bolded task name if present (**task name**)
      const boldMatch = raw.match(/\*\*(.+?)\*\*/)
      const taskName = boldMatch ? boldMatch[1] : null
      // Find matching task id
      const matchedTask = taskName
        ? pending.find(t => t.title.toLowerCase().includes(taskName.toLowerCase()))
        : null
      setNextMoveResult({ raw, taskName, taskId: matchedTask?.id || null })
    } catch {
      setNextMoveResult({ raw: 'Something went wrong. Try again.', taskName: null, taskId: null })
    } finally {
      setNextMoveLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut(); router.push('/')
  }

  const showToast = (msg) => {
    setToast(msg); setTimeout(() => setToast(null), 2500)
  }

  const handleDropOnTimeSlot = async (e, hour) => {
    e.preventDefault()
    setDragOverHour(null)
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId || !calDay) return
    const label = hour === 0 ? '12:00 AM' : hour === 12 ? '12:00 PM' : hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`
    const iso = new Date(calDay.getFullYear(), calDay.getMonth(), calDay.getDate(), hour, 0, 0, 0).toISOString()
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_time: iso, scheduled_for: iso } : t))
    const { error } = await supabase.from('tasks').update({ due_time: iso, scheduled_for: iso }).eq('id', taskId)
    if (error) {
      console.error('[calDrop] update error:', error)
      showToast('Failed to move task')
    } else {
      showToast(`Task moved to ${label}`)
    }
  }

  const switchTab = (id) => {
    setActiveTab(id); setShowMoreDrawer(false)
  }

  const handleDragEnd = async (result) => {
    if (!result.destination) return
    if (result.destination.index === result.source.index) return
    if (!dragHintDismissed) dismissDragHint()
    const reordered = Array.from(allPendingTasks)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    setTasks([...reordered, ...completedTasks])
    await saveTaskOrder(supabase, reordered)
    console.log('[dnd] reordered:', reordered.map(t => t.title))
  }

  // ── S17 handlers ──────────────────────────────────────────────────────────

  const completeTaskWithXP = async (task) => {
    setCompleting(task.id)
    // FIX 5: show XP float immediately on click — don't wait for API
    setXpFloat({ taskId: task.id, amount: 10 })
    let xpFloatTimer = setTimeout(() => setXpFloat(null), 2200)
    try {
      await new Promise(r => setTimeout(r, 320))
      const completedAt = new Date().toISOString()
      await supabase.from('tasks').update({ completed: true, completed_at: completedAt }).eq('id', task.id)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: true, completed_at: completedAt } : t))
    } finally {
      // FIX 1: always clear completing regardless of supabase errors
      setCompleting(null)
    }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
      const xpRes = await loggedFetch('/api/tasks/xp', { method: 'POST', headers, body: JSON.stringify({ taskId: task.id }) })
      const xpData = await xpRes.json()
      if (xpData.xpAwarded) {
        // Update float with actual amount if different from optimistic 10
        clearTimeout(xpFloatTimer)
        setXpFloat({ taskId: task.id, amount: xpData.xpAwarded })
        setTimeout(() => setXpFloat(null), 2200)
      }
      if (xpData.totalXp != null) setProfile(prev => prev ? { ...prev, total_xp: xpData.totalXp } : prev)
      const sRes = await loggedFetch('/api/tasks/streak', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const sData = await sRes.json()
      if (sData.currentStreak != null) setProfile(prev => prev ? { ...prev, current_streak: sData.currentStreak } : prev)
    } catch (err) { console.error('[completeTaskWithXP]', err) }
  }

  const toggleStarDB = async (task) => {
    const newStarred = !task.starred
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, starred: newStarred } : t))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return
      await loggedFetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ starred: newStarred })
      })
    } catch { setTasks(prev => prev.map(t => t.id === task.id ? { ...t, starred: task.starred } : t)) }
  }

  const toggleSection = (section) => {
    setSectionCollapsed(prev => {
      const newVal = !prev[section]
      try { localStorage.setItem(`task_section_collapsed_${section}`, String(newVal)) } catch {}
      return { ...prev, [section]: newVal }
    })
  }

  const handleTaskDragStart = (e, task, sectionTasks, sectionId) => {
    dragSrcRef.current = { id: task.id, sectionId, index: sectionTasks.findIndex(t => t.id === task.id) }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(task.id))
  }

  const handleTaskDragOver = (e, taskId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setTaskDragOver(taskId)
  }

  const handleTaskDrop = async (e, targetTask, sectionTasks) => {
    e.preventDefault()
    setTaskDragOver(null)
    const src = dragSrcRef.current
    if (!src || src.id === targetTask.id) return
    const updated = [...sectionTasks]
    const srcIdx = updated.findIndex(t => t.id === src.id)
    const dstIdx = updated.findIndex(t => t.id === targetTask.id)
    if (srcIdx === -1 || dstIdx === -1) return
    const [moved] = updated.splice(srcIdx, 1)
    updated.splice(dstIdx, 0, moved)
    const sectionIds = new Set(sectionTasks.map(t => t.id))
    setTasks(prev => {
      const nonSection = prev.filter(t => !sectionIds.has(t.id))
      return [...updated, ...nonSection]
    })
    dragSrcRef.current = null
    await saveTaskOrder(supabase, updated)
  }

  const addTaskFromOverlay = async (e) => {
    e?.preventDefault()
    if (!user || !newTitle.trim()) {
      showToast('Enter a task name')
      setTitleInputError(true)
      setTimeout(() => setTitleInputError(false), 1200)
      return
    }
    setAddingTaskOverlay(true)
    const datesToCreate = newTaskDates.length > 0 ? newTaskDates : [todayStr()]
    const makeTime = (dateStr) => {
      if (taskTimeEnabled) {
        const h = String(taskTimeHour).padStart(2, '0')
        const m = String(taskTimeMinute).padStart(2, '0')
        return new Date(`${dateStr}T${h}:${m}`).toISOString()
      }
      return new Date(`${dateStr}T23:59`).toISOString()
    }
    const taskBase = {
      user_id: user.id, title: newTitle.trim(), completed: false, archived: false,
      consequence_level: newConsequence, notes: newNotes.trim() || null,
      recurrence: newRecurrence, rollover_count: 0, priority_score: 0,
      starred: false, task_type: newTaskType,
      estimated_minutes: taskEstimated ? parseInt(taskEstimated) : null,
    }
    if (datesToCreate.length > 1) {
      const inserts = datesToCreate.map(d => ({
        ...taskBase, due_time: makeTime(d),
        scheduled_for: new Date(`${d}T09:00`).toISOString(),
        created_at: new Date().toISOString(),
      }))
      const { data } = await supabase.from('tasks').insert(inserts).select()
      if (data) setTasks(prev => [...data, ...prev])
      showToast(`${inserts.length} tasks added`)
    } else {
      const d = datesToCreate[0]
      const task = {
        ...taskBase,
        due_time: newTaskDates.length > 0 ? makeTime(d) : null,
        scheduled_for: new Date(`${d}T09:00`).toISOString(),
        created_at: new Date().toISOString(),
      }
      const { data } = await supabase.from('tasks').insert(task).select().single()
      if (data) setTasks(prev => [data, ...prev])
    }
    resetForm()
    setNewTaskType('task'); setNewTaskDates([]); setTaskTimeEnabled(false)
    setTaskTimeHour(9); setTaskTimeMinute(0); setTaskEstimated('')
    setAddingTaskOverlay(false); setShowAddModal(false)
  }

  const toggleCalDate = (dateStr) => {
    setNewTaskDates(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr])
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────

  function calTasksForDay(dStr) {
    const [y, m, d] = dStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return getTasksForDate(tasks, date)
  }

  function calPrevMonth() { setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function calNextMonth() { setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  // ── Derived values ────────────────────────────────────────────────────────

  // Chore identification: match titles from active chore preset
  const choreTitleSet = (() => {
    if (!profile?.chore_preset) return new Set()
    const preset = getChoresByPreset(profile.chore_preset)
    return preset ? new Set(preset.chores.map(c => c.title)) : new Set()
  })()
  const isChoreTask = (t) => choreTitleSet.size > 0 && choreTitleSet.has(t.title)

  const allPendingTasks = sortBySchedule(tasks.filter(t => !t.completed && !isChoreTask(t)))
  const pendingChores = sortBySchedule(tasks.filter(t => !t.completed && isChoreTask(t) && (() => {
    if (!t.scheduled_for) return false
    const sf = new Date(t.scheduled_for)
    const now = new Date()
    return sf.getFullYear() === now.getFullYear() && sf.getMonth() === now.getMonth() && sf.getDate() === now.getDate()
  })()))
  const completedTasks = tasks.filter(t => t.completed && !isChoreTask(t))

  // S17: section buckets
  const s17Today = new Date(); s17Today.setHours(0,0,0,0)
  const s17Tomorrow = new Date(s17Today); s17Tomorrow.setDate(s17Today.getDate()+1)
  const s17WeekEnd = new Date(s17Today); s17WeekEnd.setDate(s17Today.getDate()+7)
  const s17TodayStr = localDateStr(s17Today)
  const s17TomStr = localDateStr(s17Tomorrow)
  const s17Pending = tasks.filter(t => !t.completed && !t.archived)
  const s17Overdue = sortByPriority(s17Pending.filter(t => {
    if (!t.scheduled_for) return false
    const sf = new Date(t.scheduled_for); sf.setHours(0,0,0,0)
    return sf < s17Today
  }))
  const s17TodayTasks = sortBySchedule(s17Pending.filter(t => {
    const base = taskBaseDate(t)
    return base && localDateStr(base) === s17TodayStr
  }))
  const s17TomorrowTasks = sortBySchedule(s17Pending.filter(t => {
    const base = taskBaseDate(t)
    return base && localDateStr(base) === s17TomStr
  }))
  const s17WeekTasks = sortBySchedule(s17Pending.filter(t => {
    const base = taskBaseDate(t)
    if (!base) return false
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
    return d > s17Tomorrow && d <= s17WeekEnd
  }))
  const s17LaterTasks = sortBySchedule(s17Pending.filter(t => {
    const base = taskBaseDate(t)
    if (!base) return true
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate())
    return d > s17WeekEnd
  }))
  const s17CompletedToday = tasks.filter(t => t.completed && t.completed_at && localDateStr(new Date(t.completed_at)) === s17TodayStr)
  // Priority: first starred task with earliest due_time
  const s17StarredTask = (() => {
    const starred = tasks.filter(t => t.starred && !t.completed && !t.archived)
    if (!starred.length) return null
    return starred.reduce((best, t) => {
      if (!best.due_time && t.due_time) return t
      if (best.due_time && t.due_time && new Date(t.due_time) < new Date(best.due_time)) return t
      return best
    })
  })()
  // Momentum
  const s17TodayAll = [...s17TodayTasks, ...s17Overdue.filter(t => localDateStr(taskBaseDate(t) || s17Today) === s17TodayStr)]
  const s17CompletedCount = s17CompletedToday.length
  const s17TotalToday = s17CompletedCount + s17TodayTasks.length
  const rawName = profile?.full_name || ''
  const firstName = rawName.includes('@') ? 'there' : (rawName.split(' ')[0] || 'there')
  const electedTask = electedTaskId ? (allPendingTasks.find(t => t.id === electedTaskId) || null) : null
  const todayLocalStr = localDateStr(new Date())
  // Focus task: elected → earliest due-time today → first pending
  const topTask = electedTask ||
    allPendingTasks.find(t => t.due_time && localDateStr(new Date(t.due_time)) === todayLocalStr) ||
    allPendingTasks[0] || null
  const focusLabel = electedTask
    ? (electedTask.due_time ? 'Time sensitive task' : 'Priority focus')
    : 'Next up'
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const topTaskCountdown = useCountdown(topTask?.due_time)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const s17StarredCountdown = useCountdown(s17StarredTask?.due_time)

  // Progress calculations
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const completedThisWeek = tasks.filter(t => t.completed && t.completed_at && new Date(t.completed_at) > sevenDaysAgo)
  const getStreak = () => {
    let streak = 0
    for (let i = 0; i < 30; i++) {
      const day = new Date(); day.setDate(day.getDate() - i)
      const ds = day.toDateString()
      if (tasks.some(t => t.completed && t.completed_at && new Date(t.completed_at).toDateString() === ds)) {
        streak++
      } else if (i > 0) break
    }
    return streak
  }
  const getBestDay = () => {
    const dayCounts = {}
    tasks.filter(t => t.completed && t.completed_at).forEach(t => {
      const dayFull = new Date(t.completed_at).toLocaleDateString('en-US', { weekday: 'long' })
      dayCounts[dayFull] = (dayCounts[dayFull] || 0) + 1
    })
    if (!Object.keys(dayCounts).length) return null
    const [day, count] = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0]
    return { day, count }
  }

  // Finance calculations
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

  // "Coming up" — bills due within 3 days + recurring tasks due within 3 days (non-daily)
  const comingUpItems = (() => {
    const items = []
    const today = new Date(); today.setHours(0,0,0,0)
    const threeDays = new Date(today); threeDays.setDate(today.getDate() + 3)
    // Bills
    bills.forEach(b => {
      if (b.due_day == null) return
      const next = getNextDueDate(b)
      if (next && next >= today && next <= threeDays) {
        const daysUntil = Math.round((next - today) / 86400000)
        items.push({
          type: 'bill', id: `bill-${b.id}`, title: `Pay: ${b.name}`,
          amount: b.amount, dueDate: next, daysUntil,
          label: daysUntil === 0 ? 'due today' : daysUntil === 1 ? 'due tomorrow' : `due in ${daysUntil} days`,
          bill: b,
        })
      }
    })
    // Recurring tasks (weekly only — daily tasks don't show in coming up)
    tasks.filter(t => !t.completed && !t.archived && t.recurrence === 'weekly').forEach(t => {
      const base = taskBaseDate(t)
      if (!base) return
      // Find next weekly occurrence
      const now = new Date(); now.setHours(0,0,0,0)
      for (let i = 0; i <= 7; i++) {
        const candidate = new Date(base); candidate.setDate(base.getDate() + i * 7)
        if (candidate >= now && candidate <= threeDays) {
          const daysUntil = Math.round((candidate - today) / 86400000)
          items.push({
            type: 'task', id: `task-${t.id}`, title: t.title,
            dueDate: candidate, daysUntil,
            label: daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`,
            task: t,
          })
          break
        }
      }
    })
    return items.sort((a, b) => a.daysUntil - b.daysUntil)
  })()

  // Weekly wins grouped by day
  const completedByDay = {}
  completedThisWeek.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at)).forEach(t => {
    const day = new Date(t.completed_at).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    if (!completedByDay[day]) completedByDay[day] = []
    completedByDay[day].push(t)
  })

  if (loading) return (
    <div className={styles.loadingPage}>
      <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '1.3rem', letterSpacing: '0.16em', color: '#F0EAD6' }}>CINIS</span>
    </div>
  )

  return (
    <>
      <Head><title>Dashboard — Cinis</title></Head>
      <div className={styles.appShell}>

        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLogo}>
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <polygon points="32,2 56,15 56,43 32,56 8,43 8,15" fill="none" stroke="#FF6644" strokeWidth="1.1" opacity="0.45"/>
              <path d="M 12.63,14.56 L 29.37,5.44 Q 32,4 34.63,5.44 L 51.37,14.56 Q 54,16 54,19 L 54,39 Q 54,42 51.37,43.44 L 34.63,52.56 Q 32,54 29.37,52.56 L 12.63,43.44 Q 10,42 10,39 L 10,19 Q 10,16 12.63,14.56 Z" fill="#FF6644"/>
              <path d="M 14.9,16.1 L 29.8,7.8 Q 32,6.6 34.2,7.8 L 49.1,16.1 Q 51.4,17.4 51.4,20 L 51.4,38 Q 51.4,40.6 49.1,41.9 L 34.2,50.2 Q 32,51.4 29.8,50.2 L 14.9,41.9 Q 12.6,40.6 12.6,38 L 12.6,20 Q 12.6,17.4 14.9,16.1 Z" fill="#120704"/>
              <polygon points="32,14 46,22 46,40 32,48 18,40 18,22" fill="#5A1005"/>
              <polygon points="32,20 42,26 42,40 32,45 22,40 22,26" fill="#A82010"/>
              <polygon points="32,26 38,29 38,40 32,43 26,40 26,29" fill="#E8321A"/>
              <polygon points="32,29 45,40 40,43 32,47 24,43 19,40" fill="#FF6644" opacity="0.92"/>
              <polygon points="32,33 41,40 38,42 32,45 26,42 23,40" fill="#FFD0C0" opacity="0.76"/>
              <polygon points="32,36 37,40 36,41 32,43 28,41 27,40" fill="#FFF0EB" opacity="0.60"/>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.16em', color: '#F0EAD6' }}>CINIS</span>
              <span style={{ fontFamily: "'Figtree', sans-serif", fontSize: '0.62rem', color: 'rgba(240,234,214,0.3)', letterSpacing: '0.01em', lineHeight: 1 }}>Where start meets finished.</span>
            </div>
          </div>
          <nav className={styles.sidebarNav}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => switchTab(item.id)}
                className={`${styles.sidebarNavItem} ${activeTab === item.id ? styles.sidebarNavItemActive : ''}`}>
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className={styles.sidebarFooter}>
            <span className={styles.sidebarEmail}>{user?.email}</span>
            <button onClick={handleSignOut} className={styles.signOutBtn}>Sign out</button>
            <button onClick={handleRunRollover} className={styles.rolloverDevBtn}>Run rollover</button>
          </div>
        </aside>

        {/* MAIN */}
        <main className={styles.main}>

          {/* ── TASKS ── */}
          {activeTab === 'tasks' && (
          <TabErrorBoundary tabName="Tasks">
          {(() => {
            const HP = '#FF6644'
            const EMBER = '#E8321A'
            const ASH = '#F0EAD6'
            const CHAR = '#3E3228'
            const greetLine = generateGreetingLine(tasks)

            const renderSection = (sectionId, label, sectionTasks, opts = {}) => {
              if (sectionTasks.length === 0) return null
              const collapsed = sectionCollapsed[sectionId]
              const isOverdue = opts.isOverdue
              const isDone = opts.isDone
              return (
                <div key={sectionId} style={{ marginBottom: 4 }}>
                  <button
                    className={styles.s17SectionHeader}
                    onClick={() => toggleSection(sectionId)}
                    style={{ color: isOverdue ? EMBER : undefined }}
                  >
                    <span className={styles.s17SectionLabel}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={styles.s17SectionBadge}
                        style={{ background: isOverdue ? `${EMBER}22` : `${HP}18`, color: isOverdue ? EMBER : HP }}>
                        {sectionTasks.length}
                      </span>
                      <span style={{ color: 'rgba(240,234,214,0.3)', fontSize: 16, transform: collapsed ? 'rotate(0deg)' : 'rotate(90deg)', display: 'inline-block', transition: 'transform 0.2s' }}>›</span>
                    </div>
                  </button>
                  {!collapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                      {sectionTasks.map(task => {
                        const isCompleting = completing === task.id
                        const isDragOver = taskDragOver === task.id
                        const hasXP = xpFloat?.taskId === task.id
                        const countdown = getCountdownDisplay(task.due_time, tickNow)
                        const typeBadge = task.task_type && task.task_type !== 'task' && task.task_type !== 'regular' ? task.task_type : null
                        return (
                          <div
                            key={task.id}
                            className={styles.s17TaskCard}
                            style={{
                              opacity: isCompleting ? 0 : 1,
                              transform: isCompleting ? 'translateX(80px)' : 'none',
                              transition: 'opacity 0.3s ease, transform 0.3s ease',
                              pointerEvents: isCompleting ? 'none' : undefined,
                              borderTop: isDragOver ? `2px solid ${HP}` : undefined,
                              background: isDone ? 'transparent' : undefined,
                            }}
                            draggable={!isDone}
                            onDragStart={e => !isDone && handleTaskDragStart(e, task, sectionTasks, sectionId)}
                            onDragOver={e => !isDone && handleTaskDragOver(e, task.id)}
                            onDrop={e => !isDone && handleTaskDrop(e, task, sectionTasks)}
                            onDragLeave={() => setTaskDragOver(null)}
                            onDragEnd={() => { setTaskDragOver(null); dragSrcRef.current = null }}
                          >
                            {hasXP && (
                              <div className={styles.xpFloat}>+{xpFloat.amount} XP</div>
                            )}
                            {isDone ? (
                              <button
                                className={styles.s17CheckCircleDone}
                                onClick={() => uncompleteTask(task)}
                                aria-label="Undo complete"
                              >✓</button>
                            ) : (
                              <button
                                className={`${styles.s17CheckCircle} ${isCompleting ? styles.s17CheckCircleFilling : ''}`}
                                onClick={() => completeTaskWithXP(task)}
                                aria-label="Complete task"
                              />
                            )}
                            <div
                              style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, cursor: 'pointer' }}
                              onClick={() => setDetailTask(task)}
                            >
                              <span className={isDone ? styles.s17TaskTitleDone : styles.s17TaskTitle}>{task.title}</span>
                              {!isDone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  {typeBadge && (
                                    <span className={styles.s17TypeBadge}
                                      style={{ background: typeBadge === 'appointment' ? '#1a3a4a' : typeBadge === 'bill' ? '#2a1a0a' : `${CHAR}cc`, color: typeBadge === 'appointment' ? '#66d4f0' : typeBadge === 'bill' ? '#FFB800' : ASH }}>
                                      {typeBadge}
                                    </span>
                                  )}
                                  {countdown ? (
                                    <span style={{ fontSize: 11, color: HP, fontFamily: "'Sora', sans-serif", fontWeight: 600 }}>{countdown}</span>
                                  ) : task.due_time && (
                                    <span style={{ fontSize: 11, color: 'rgba(240,234,214,0.4)', fontFamily: "'Sora', sans-serif" }}>
                                      {new Date(task.due_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                  )}
                                  {task.rollover_count > 0 && (
                                    <span style={{ fontSize: 10, color: 'rgba(240,234,214,0.28)', fontFamily: "'Sora', sans-serif" }}>↷ {task.rollover_count}×</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {!isDone && (
                              <button
                                className={`${styles.s17StarBtn} ${task.starred ? styles.s17StarBtnActive : ''}`}
                                onClick={e => { e.stopPropagation(); toggleStarDB(task) }}
                                aria-label={task.starred ? 'Unstar' : 'Star'}
                                style={{ color: task.starred ? HP : 'rgba(240,234,214,0.2)' }}
                              >{task.starred ? '★' : '☆'}</button>
                            )}
                            {isDone && (
                              <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete?')) return; archiveTask(task) }} className={styles.taskActionDelete} title="Remove">×</button>
                            )}
                            {!isDone && (
                              <span className={styles.s17DragGrip} title="Drag to reorder">⠿</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            if (loading) return (
              <div style={{ padding: '12px 14px', paddingBottom: 80, maxWidth: 680, margin: '0 auto', overflowY: 'auto', minHeight: '100%' }}>
                <SkeletonCard lines={3} />
                <SkeletonCard lines={3} />
                <SkeletonCard lines={3} />
              </div>
            )

            if (tasksError) return (
              <div style={{ padding: '12px 14px', paddingBottom: 80, maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
                <ErrorState message="Couldn't load your data." onRetry={() => { setTasksError(false); setLoading(true); fetchTasks(user.id) }} />
              </div>
            )

            return (
              <div style={{ padding: '12px 14px', paddingBottom: 80, maxWidth: 680, margin: '0 auto', overflowY: 'auto', minHeight: '100%' }}>

                {/* 1 — Morning Greeting Card */}
                {!greetingDismissed && (
                  <div className={`${styles.s17GreetCard} ${greetCardAnimate ? styles.s17GreetCardAnimate : ''}`}>
                    <button
                      className={styles.s17GreetDismiss}
                      onClick={() => {
                        setGreetingDismissed(true)
                        try { localStorage.setItem(`greeting_dismissed_${todayStr()}`, '1') } catch {}
                      }}
                      aria-label="Dismiss"
                    >×</button>
                    <div className={styles.s17GreetHeadline}>{greeting}, {firstName}</div>
                    <div className={styles.s17GreetLine}>{greetLine}</div>
                  </div>
                )}

                {/* 2 — Overdue Card */}
                {s17Overdue.length > 0 && (() => {
                  const worst = s17Overdue[0]
                  const daysOver = Math.floor((s17Today - new Date(worst.scheduled_for).setHours(0,0,0,0)) / 86400000)
                  return (
                    <div className={styles.s17OverdueCard}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: EMBER, marginBottom: 4, fontFamily: "'Figtree', sans-serif" }}>Overdue</div>
                          <div style={{ fontSize: 15, fontWeight: 600, color: ASH, fontFamily: "'Figtree', sans-serif", lineHeight: 1.3, marginBottom: 4 }}>{worst.title}</div>
                          <div style={{ fontSize: 12, color: EMBER, fontFamily: "'Sora', sans-serif", fontWeight: 600 }}>{daysOver} day{daysOver !== 1 ? 's' : ''} overdue</div>
                          {s17Overdue.length > 1 && (
                            <div style={{ fontSize: 12, color: 'rgba(240,234,214,0.45)', marginTop: 4, fontFamily: "'Sora', sans-serif" }}>+{s17Overdue.length - 1} more overdue</div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button className={styles.s17OverdueDoNow} onClick={() => completeTaskWithXP(worst)}>Do now</button>
                        <button className={styles.s17OverdueReschedule} onClick={() => rescheduleTask(worst)}>Reschedule →</button>
                      </div>
                    </div>
                  )
                })()}

                {/* 3 — Priority Card */}
                {s17StarredTask && (
                  <div className={styles.s17PriorityCard}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: HP, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: HP, display: 'inline-block', animation: 'pulse 2s infinite' }} />
                          Your #1 priority
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: ASH, fontFamily: "'Figtree', sans-serif", lineHeight: 1.3 }}>{s17StarredTask.title}</div>
                        {s17StarredCountdown && (
                          <div style={{ fontSize: 13, color: HP, fontFamily: "'Sora', sans-serif", fontWeight: 600, marginTop: 4 }}>{s17StarredCountdown}</div>
                        )}
                      </div>
                    </div>
                    <button
                      className={styles.s17StartTimerBtn}
                      onClick={() => { setElectedTaskId(s17StarredTask.id); switchTab('focus') }}
                    >Start timer →</button>
                  </div>
                )}

                {/* 4 — Momentum Bar */}
                <div className={styles.s17MomentumWrap}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontFamily: "'Figtree', sans-serif", color: 'rgba(240,234,214,0.5)', fontWeight: 600 }}>
                      🔥 {profile?.current_streak || 0} streak
                    </span>
                    <span style={{ fontSize: 11, fontFamily: "'Figtree', sans-serif", color: 'rgba(240,234,214,0.4)', fontWeight: 600 }}>
                      {profile?.total_xp || 0} XP
                    </span>
                  </div>
                  <div className={styles.s17MomentumTrack}>
                    <div
                      className={styles.s17MomentumFill}
                      style={{ width: s17TotalToday > 0 ? `${Math.min(100, (s17CompletedCount / s17TotalToday) * 100)}%` : '0%' }}
                    />
                  </div>
                </div>

                {/* 5 — Collapsible task sections */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                  {renderSection('overdue', 'Overdue', s17Overdue, { isOverdue: true })}
                  {renderSection('today', 'Today', s17TodayTasks)}
                  {renderSection('tomorrow', 'Tomorrow', s17TomorrowTasks)}
                  {renderSection('thisWeek', 'This Week', s17WeekTasks)}
                  {renderSection('later', 'Later', s17LaterTasks)}
                  {renderSection('completedToday', 'Completed Today', s17CompletedToday, { isDone: true })}
                </div>

                {/* Empty state */}
                {s17Pending.length === 0 && s17CompletedToday.length === 0 && (
                  <EmptyState
                    useMarkIcon
                    headline="Your day is a blank slate."
                    subtext="Add your first task and let's get moving."
                    ctaLabel="Add a task"
                    onCtaClick={() => setShowAddModal(true)}
                  />
                )}

                {/* 8 — Add task button */}
                <button className={styles.s17AddFab} onClick={() => setShowAddModal(true)}>
                  <span style={{ fontSize: 20, lineHeight: 1 }}>+</span> Add task
                </button>

              </div>
            )
          })()}
          </TabErrorBoundary>
          )}



          {/* ── CHECK-IN ── */}
          {activeTab === 'checkin' && (
          <TabErrorBoundary tabName="Check-in">
          {(() => {
            const PERSONA_NAMES = { drill_sergeant: 'Drill Sergeant', coach: 'Coach', thinking_partner: 'Thinking Partner', hype_person: 'Hype Person', strategist: 'Strategist', empath: 'Empath' }
            const personaBlend = profile?.persona_blend || []
            const personaLabel = personaBlend.length > 0 ? personaBlend.map(p => PERSONA_NAMES[p] || p).join(' · ') : null
            const primaryPersonaName = personaBlend[0] ? (PERSONA_NAMES[personaBlend[0]] || personaBlend[0]) : 'Coach'

            const aiRate = ciAiRateLocal ?? (profile?.ai_interactions_today || 0)
            const tierLimit = (() => {
              const s = profile?.subscription_status || 'free'
              if (s === 'unlimited') return 40
              if (s === 'pro_sms') return 20
              if (s === 'pro') return 15
              return 5
            })()

            const todayLocalStr = new Date().toLocaleDateString('en-CA')
            const todayTasks = tasks.filter(t => !t.archived && !t.completed && t.scheduled_for && t.scheduled_for.slice(0, 10) === todayLocalStr)
            const overdueTasks = tasks.filter(t => !t.archived && !t.completed && t.scheduled_for && t.scheduled_for.slice(0, 10) < todayLocalStr)

            const lastCheckinAt = profile?.last_checkin_at
            const showProactiveBadge = lastCheckinAt && new Date(lastCheckinAt).toLocaleDateString('en-CA') === todayLocalStr
            const checkinTimeStr = lastCheckinAt ? new Date(lastCheckinAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

            return (
              <div className={styles.ciView}>

                {/* 1 — Context ribbon */}
                <div className={styles.ciRibbonWrap}>
                  <span className={styles.ciRibbonLabel}>Cinis {personaLabel ? `· ${personaLabel}` : ''}</span>
                  <div className={styles.ciRibbon}>
                    <span className={`${styles.ciPill} ${styles.ciPillHot}`} style={{ animationDelay: '0ms' }}>
                      {todayTasks.length} task{todayTasks.length !== 1 ? 's' : ''}
                    </span>
                    {overdueTasks.length > 0 && (
                      <span className={`${styles.ciPill} ${styles.ciPillEmber}`} style={{ animationDelay: '50ms' }}>
                        {overdueTasks.length} overdue
                      </span>
                    )}
                    <span className={`${styles.ciPill} ${styles.ciPillGreen}`} style={{ animationDelay: '100ms' }}>
                      🔥 {profile?.current_streak || 0} day{(profile?.current_streak || 0) !== 1 ? 's' : ''}
                    </span>
                    <span className={`${styles.ciPill} ${styles.ciPillGhost}`} style={{ animationDelay: '150ms' }}>
                      {aiRate} / {tierLimit} today
                    </span>
                  </div>
                </div>

                {/* 2 — Persona badge */}
                <div className={styles.ciPersonaBadgeWrap}>
                  {personaLabel
                    ? <span className={styles.ciPersonaBadge}>✦ Cinis · {personaLabel}</span>
                    : <span className={styles.ciPersonaEmpty}>No persona set — configure in Settings</span>
                  }
                </div>

                {/* 3 — Rate counter bar */}
                <div className={styles.ciRateBarTrack}>
                  <div className={styles.ciRateBarFill} style={{ width: `${Math.min((aiRate / tierLimit) * 100, 100)}%` }} />
                </div>

                {/* 4 — Proactive check-in badge */}
                {showProactiveBadge && !dismissedProactiveBadge && (
                  <div className={styles.ciCheckinBadge}>
                    <span className={styles.ciCheckinDot} />
                    {getCheckinType() === 'morning' ? 'Morning' : getCheckinType() === 'midday' ? 'Midday' : 'Evening'} check-in · {checkinTimeStr}
                    <button
                      onClick={() => {
                        try {
                          const key = `cinis_dismissed_badge_${user.id}_${new Date().toLocaleDateString('en-CA')}`
                          localStorage.setItem(key, 'true')
                        } catch {}
                        setDismissedProactiveBadge(true)
                      }}
                      className={styles.ciCheckinBadgeClose}
                      aria-label="Dismiss check-in badge"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* 5 — Conversation area */}
                <div className={styles.ciMessages}>
                  {checkinLoading && checkinMessages.length === 0 && (
                    <><SkeletonCard lines={2} /><SkeletonCard lines={2} /></>
                  )}
                  {checkinMessages.length === 0 && !checkinLoading && (
                    <EmptyState
                      useMarkIcon
                      headline="Your coach is here."
                      subtext="Ask anything, share what's on your plate, or just say you're stuck."
                      ctaLabel="Start check-in"
                      onCtaClick={() => checkinInputRef.current?.focus()}
                    />
                  )}
                  {checkinMessages.map((msg, i) => (
                    <div key={i} className={msg.role === 'assistant' ? styles.ciBubbleWrap : styles.ciBubbleUserWrap}>
                      {msg.role === 'assistant' && (
                        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '6px' }}>
                          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '11px', color: '#FF6644', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cinis</span>
                          <span style={{ fontSize: '10px', color: 'rgba(240,234,214,0.35)', marginTop: '2px' }}>· {primaryPersonaName}</span>
                        </div>
                      )}
                      <div className={msg.role === 'assistant' ? styles.ciBubbleAI : styles.ciBubbleUser}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {checkinLoading && (
                    <div className={styles.ciBubbleWrap}>
                      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '6px' }}>
                        <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '11px', color: '#FF6644', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cinis</span>
                        <span style={{ fontSize: '10px', color: 'rgba(240,234,214,0.35)', marginTop: '2px' }}>· {primaryPersonaName}</span>
                      </div>
                      <div className={styles.ciBubbleAI}><span className={styles.checkinTyping}>···</span></div>
                    </div>
                  )}
                  <div ref={checkinEndRef} />
                </div>

                {/* Rate limit inline message */}
                {ciRateLimitMsg && (
                  <div className={styles.ciRateLimitMsg}>
                    {ciRateLimitMsg}{' '}
                    <a href="/upgrade" className={styles.ciUpgradeLink}>Upgrade</a>
                  </div>
                )}

                {/* Error inline message */}
                {ciError && <div className={styles.ciErrorMsg}>{ciError}</div>}

                {/* 6 — Quick chips */}
                <div className={styles.ciChips}>
                  {["What's my next move?", "I'm stuck", "What did I miss?", "Hype me up"].map(chip => (
                    <button key={chip} className={styles.ciChip} onClick={() => sendCheckinMsg(chip)}>
                      {chip}
                    </button>
                  ))}
                </div>

                {/* 7 — Input bar */}
                <form onSubmit={sendCheckinMessage} className={styles.ciInputBar}>
                  <input
                    ref={checkinInputRef}
                    type="text"
                    placeholder="Message your coach..."
                    value={checkinInput}
                    onChange={e => setCheckinInput(e.target.value)}
                    className={styles.ciInput}
                    autoFocus
                  />
                  {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
                    <button
                      type="button"
                      onClick={handleCheckinVoiceClick}
                      disabled={checkinLoading}
                      className={styles.ciMicBtn}
                      style={{
                        background: checkinVoiceListening ? '#FF6644' : 'transparent',
                        opacity: checkinLoading ? 0.5 : 1,
                        cursor: checkinLoading ? 'not-allowed' : 'pointer'
                      }}
                      aria-label={checkinVoiceListening ? 'Stop listening' : 'Start voice input'}
                      title={checkinVoiceListening ? 'Stop listening' : 'Start voice input'}
                    >
                      <span style={{
                        fontSize: 18,
                        lineHeight: 1,
                        color: checkinVoiceListening ? '#211A14' : '#F0EAD6',
                        animation: checkinVoiceListening ? 'pulse 1.5s infinite' : 'none'
                      }}>
                        🎤
                      </span>
                    </button>
                  )}
                  <button type="submit" disabled={checkinLoading || !checkinInput.trim()} className={styles.ciSendBtn}>
                    {checkinLoading
                      ? <span className={styles.ciSendSpinner} />
                      : <span style={{ fontSize: 18, lineHeight: 1 }}>↑</span>
                    }
                  </button>
                </form>

                {/* Clear history */}
                {checkinMessages.length > 1 && (
                  <button className={styles.clearHistoryBtn} onClick={() => {
                    try { localStorage.removeItem(`cinis_checkin_${user.id}`) } catch {}
                    setCheckinMessages([])
                    setCheckinInitialized(false)
                    setCiRateLimitMsg(null)
                    setCiError(null)
                  }}>Clear history</button>
                )}

              </div>
            )
          })()}
          </TabErrorBoundary>
          )}

          {/* ── FOCUS ── */}
          {activeTab === 'focus' && (
          <TabErrorBoundary tabName="Focus">
            <div className={styles.focusView}>
              <div className={styles.focusAccordion}>

                {/* ── ⏱ SESSION — always expanded ── */}
                <div className={`${styles.focusAccordionCard} ${styles.focusAccordionCardOpen}`}>
                  <div className={styles.focusAccordionHeader}>
                    <span className={styles.focusAccordionEmoji}>⏱</span>
                    <span className={styles.focusAccordionTitle}>Session</span>
                  </div>
                  {(
                    <div className={styles.focusAccordionContent}>
                      {focusPhase === 'setup' && (
                        <div className={styles.focusSetup}>
                          {!topTask ? (
                            <div className={styles.focusIdleEmpty}>
                              <p className={styles.focusIdleHeadline}>Ready to lock in?</p>
                              <p className={styles.focusIdleSub}>Pick a task, set your timer, and get into flow.</p>
                              <button onClick={() => switchTab('tasks')} className={styles.focusStartBtn}>Pick a Task →</button>
                              <button onClick={() => setShowAddModal(true)} className={styles.focusIdleAddLink}>or add a new task</button>
                            </div>
                          ) : (
                            <>
                              <p className={styles.focusSetupLabel}>{focusLabel}</p>
                              <h2 className={styles.focusSetupTask}>{topTask.title}</h2>
                              {topTaskCountdown && (
                                <p style={{ fontSize: '13px', color: 'var(--accent)', opacity: 0.8, margin: '-8px 0 16px', fontWeight: 600 }}>{topTaskCountdown}</p>
                              )}
                              <p className={styles.focusDurationLabel}>Session length</p>
                              <div className={styles.focusDurationRow}>
                                {[5, 15, 25, 45, 60].map(d => (
                                  <button key={d}
                                    onClick={() => { setFocusDuration(d); setFocusCustom('') }}
                                    className={`${styles.focusDurationBtn} ${focusDuration === d && !focusCustom ? styles.focusDurationBtnActive : ''}`}>
                                    {d}m
                                  </button>
                                ))}
                                <button
                                  onClick={() => { setFocusDuration(0); setFocusCustom('') }}
                                  className={`${styles.focusDurationBtn} ${focusDuration === 0 ? styles.focusDurationBtnActive : ''}`}>
                                  Custom
                                </button>
                              </div>
                              {focusDuration === 0 && (
                                <input type="number" placeholder="Minutes" value={focusCustom}
                                  onChange={e => setFocusCustom(e.target.value)}
                                  className={styles.focusCustomInput} min="1" max="180"
                                  autoFocus />
                              )}
                              <button onClick={startFocus} className={styles.focusStartBtn}>Start session →</button>
                            </>
                          )}
                          <div className={styles.focusMusicStub}>
                            🎵 Music — connect Spotify, Apple Music, or YouTube in Settings
                          </div>
                        </div>
                      )}
                      {focusPhase === 'active' && (
                        <div className={styles.focusActive}>
                          <p className={styles.focusActiveTask}>{topTask?.title}</p>
                          <div className={`${styles.focusTimerDisplay} ${styles.timerDisplay}`}>{formatTimer(focusTimeLeft)}</div>
                          <button onClick={toggleFocusPause} className={styles.focusPauseBtn}>{focusRunning ? 'Pause' : 'Resume'}</button>
                          {showAbandonConfirm ? (
                            <div className={styles.abandonConfirmRow}>
                              <span className={styles.abandonConfirmText}>Abandon session?</span>
                              <button onClick={confirmAbandon} className={styles.abandonYesBtn}>Yes, stop</button>
                              <button onClick={() => setShowAbandonConfirm(false)} className={styles.abandonNoBtn}>Keep going</button>
                            </div>
                          ) : (
                            <button onClick={handleAbandonSession} className={styles.focusAbandonBtn}>Abandon session</button>
                          )}
                        </div>
                      )}
                      {focusPhase === 'complete' && (
                        <div className={styles.focusComplete}>
                          <p className={styles.focusCompleteHeading}>Time's up.</p>
                          <p className={styles.focusCompleteTask}>{topTask?.title}</p>
                          <p className={styles.focusCompletePrompt}>How'd it go?</p>
                          <div className={styles.focusResultBtns}>
                            <button onClick={() => handleFocusResult('complete')} className={styles.focusResultBtn}>Nailed it ✓</button>
                            <button onClick={() => handleFocusResult('progress')} className={`${styles.focusResultBtn} ${styles.focusResultBtnSecondary}`}>Made progress →</button>
                            <button onClick={() => handleFocusResult('stuck')} className={`${styles.focusResultBtn} ${styles.focusResultBtnSecondary}`}>Got stuck, help me</button>
                          </div>
                        </div>
                      )}
                      {focusPhase === 'stuck' && (
                        <div className={styles.focusStuck}>
                          <p className={styles.focusStuckLabel}>Cinis</p>
                          {focusAiLoading ? <div className={styles.focusStuckBubble}><span className={styles.checkinTyping}>···</span></div>
                            : <div className={styles.focusStuckBubble}>{focusAiResponse}</div>}
                          <div className={styles.focusStuckActions}>
                            <button onClick={() => setFocusPhase('setup')} className={styles.focusStuckBtn}>Try again</button>
                            <button onClick={() => switchTab('tasks')} className={`${styles.focusStuckBtn} ${styles.focusStuckBtnGhost}`}>Back to tasks</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── FOCUS STATS ── */}
                <div className={styles.focusStatsContainer}>
                  <div className={styles.focusStatCard}>
                    <div className={styles.focusStatLabel}>Day streak</div>
                    <div className={styles.focusStatValue}>{(() => {
                      const today = new Date()
                      const todayStr = localDateStr(today)
                      const yesterdayStr = localDateStr(new Date(today.getTime() - 86400000))
                      const todayCompleted = tasks.filter(t => t.completed && localDateStr(new Date(t.updated_at || t.created_at)) === todayStr).length
                      const yesterdayCompleted = tasks.filter(t => t.completed && localDateStr(new Date(t.updated_at || t.created_at)) === yesterdayStr).length
                      if (todayCompleted === 0 && yesterdayCompleted === 0) return '0'
                      let streak = todayCompleted > 0 ? 1 : 0
                      let checkDate = yesterdayStr
                      for (let i = 1; i < 365; i++) {
                        const checkDateObj = new Date(today.getTime() - i * 86400000)
                        const checkDateStr = localDateStr(checkDateObj)
                        const completed = tasks.filter(t => t.completed && localDateStr(new Date(t.updated_at || t.created_at)) === checkDateStr).length
                        if (completed > 0) streak++
                        else break
                      }
                      return streak
                    })()}</div>
                  </div>
                  <div className={styles.focusStatCard}>
                    <div className={styles.focusStatLabel}>Total focus time</div>
                    <div className={styles.focusStatValue}>{(() => {
                      const totalMinutes = tasks.reduce((sum, t) => sum + (t.estimated_minutes || 0), 0)
                      if (totalMinutes < 60) return `${totalMinutes}m`
                      const hours = Math.floor(totalMinutes / 60)
                      const mins = totalMinutes % 60
                      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
                    })()}</div>
                  </div>
                  <div className={styles.focusStatCard}>
                    <div className={styles.focusStatLabel}>Sessions today</div>
                    <div className={styles.focusStatValue}>{(() => {
                      const today = new Date()
                      const todayStr = localDateStr(today)
                      return tasks.filter(t => t.completed && localDateStr(new Date(t.updated_at || t.created_at)) === todayStr).length
                    })()}</div>
                  </div>
                </div>

                {/* ── 🥗 FUEL ── */}
                <div className={`${styles.focusAccordionCard} ${focusSection === 'fuel' ? styles.focusAccordionCardOpen : ''}`}>
                  <div className={styles.focusAccordionHeader} onClick={() => setFocusSection(focusSection === 'fuel' ? null : 'fuel')}>
                    <span className={styles.focusAccordionEmoji}>🥗</span>
                    <span className={styles.focusAccordionTitle}>Fuel Your Focus</span>
                    <span className={styles.focusAccordionChevron}><CaretDown size={16} style={{ transform: focusSection === 'fuel' ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }} /></span>
                  </div>
                  {focusSection === 'fuel' && (
                    <div className={styles.focusAccordionContent}>
                      <div className={styles.focusContentCards}>
                        <h2 className={styles.focusContentTitle}>Fuel your focus</h2>
                        <p className={styles.focusContentSub}>What you eat before a session matters. Keep it simple.</p>
                        {[
                          { icon: '🥚', title: 'Protein first', body: 'Eggs, Greek yogurt, or a handful of nuts before a session. Protein stabilizes blood sugar and prevents the mid-session crash that hits ~90 minutes after a high-carb meal.' },
                          { icon: '🍠', title: 'Complex carbs for sustained energy', body: 'Oats, sweet potato, or whole grain bread 1-2 hours before a long session. They release energy slowly — no spike, no crash. Avoid simple carbs right before starting.' },
                          { icon: '💧', title: 'Hydration is non-negotiable', body: "Even mild dehydration (1-2%) measurably impairs cognitive function. Drink 500ml of water before your session starts. Keep a glass nearby — you'll drink more if it's visible." },
                          { icon: '☕', title: 'Caffeine timing', body: 'Wait 90 minutes after waking before your first coffee. This avoids crashing through your cortisol peak. Caffeine peaks at 30-60 min — time it to start just before your session. Cut off by 2pm to protect sleep.' },
                          { icon: '🚫', title: 'What to avoid', body: 'Heavy meals right before a session send blood flow to your gut. Alcohol the night before fragments sleep and tanks focus the next day. Ultra-processed foods cause inflammation that slows thinking.' },
                        ].map(({ icon, title, body }) => (
                          <div key={title} className={styles.focusContentCard}>
                            <span className={styles.focusContentCardIcon}>{icon}</span>
                            <div>
                              <p className={styles.focusContentCardTitle}>{title}</p>
                              <p className={styles.focusContentCardBody}>{body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 🏃 MOVE ── */}
                <div className={`${styles.focusAccordionCard} ${focusSection === 'move' ? styles.focusAccordionCardOpen : ''}`}>
                  <div className={styles.focusAccordionHeader} onClick={() => setFocusSection(focusSection === 'move' ? null : 'move')}>
                    <span className={styles.focusAccordionEmoji}>🏃</span>
                    <span className={styles.focusAccordionTitle}>Move</span>
                    <span className={styles.focusAccordionChevron}><CaretDown size={16} style={{ transform: focusSection === 'move' ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }} /></span>
                  </div>
                  {focusSection === 'move' && (
                    <div className={styles.focusAccordionContent}>
                      <div className={styles.focusContentCards}>
                        <h2 className={styles.focusContentTitle}>Move to think better</h2>
                        <p className={styles.focusContentSub}>Physical activity directly improves executive function. Here's how to use it.</p>
                        {[
                          { icon: '🚶', title: '10-minute walk before a hard task', body: "A brisk 10-minute walk before a focus session increases BDNF (brain-derived neurotrophic factor) and blood flow to the prefrontal cortex. It's the single most evidence-backed pre-work ritual for cognitive performance." },
                          { icon: '🪑', title: 'Desk stretches every 45 minutes', body: 'Neck rolls, shoulder circles, chest opener, hip flexor stretch. Takes 2 minutes. Sitting compresses the spine and restricts blood flow — brief movement resets your posture and attention.' },
                          { icon: '⏱️', title: 'Exercise timing for focus', body: "Morning exercise improves attention for 2-4 hours after. Afternoon exercise (3-5pm) can extend peak focus into the evening. Avoid intense exercise within 3 hours of a critical cognitive task — you'll feel great but your working memory takes a temporary hit." },
                          { icon: '🧘', title: '5-minute breathing reset', body: "Box breathing: 4 counts in, 4 hold, 4 out, 4 hold. 5 rounds. Activates the parasympathetic nervous system and lowers cortisol. Use this before a session you've been dreading or when you hit a wall." },
                          { icon: '🏃', title: 'Exercise and ADHD', body: 'Regular aerobic exercise is one of the most powerful non-pharmacological interventions for attention and impulse control. Even 20 minutes of moderate-intensity cardio produces dopamine and norepinephrine — the same targets as stimulant medications.' },
                        ].map(({ icon, title, body }) => (
                          <div key={title} className={styles.focusContentCard}>
                            <span className={styles.focusContentCardIcon}>{icon}</span>
                            <div>
                              <p className={styles.focusContentCardTitle}>{title}</p>
                              <p className={styles.focusContentCardBody}>{body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ── 💊 SUPPLEMENTS ── */}
                <div className={`${styles.focusAccordionCard} ${focusSection === 'supplements' ? styles.focusAccordionCardOpen : ''}`}>
                  <div className={styles.focusAccordionHeader} onClick={() => setFocusSection(focusSection === 'supplements' ? null : 'supplements')}>
                    <span className={styles.focusAccordionEmoji}>💊</span>
                    <span className={styles.focusAccordionTitle}>Supplements</span>
                    <span className={styles.focusAccordionChevron}><CaretDown size={16} style={{ transform: focusSection === 'supplements' ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }} /></span>
                  </div>
                  {focusSection === 'supplements' && (
                    <div className={styles.focusAccordionContent}>
                      <div className={styles.focusContentCards}>
                        <h2 className={styles.focusContentTitle}>Evidence-based supplements</h2>
                        <p className={styles.focusContentSub}>Always consult your doctor before starting any supplement, especially if you take medication.</p>
                        {[
                          { icon: '🐟', title: 'Omega-3 (EPA/DHA)', body: 'The most studied supplement for cognitive function. EPA and DHA are structural components of brain cell membranes and support communication between neurons. 1-2g of combined EPA/DHA daily. Effects build over weeks, not days.' },
                          { icon: '🧲', title: 'Magnesium glycinate', body: 'Most people are deficient. Magnesium plays a role in over 300 enzymatic reactions, including those involved in energy production and nerve function. Glycinate form is best absorbed and gentlest on the stomach. 200-400mg before bed also improves sleep quality.' },
                          { icon: '🍵', title: 'L-Theanine + Caffeine', body: 'The gold standard focus stack. L-theanine (100-200mg) taken with caffeine smooths out the jitteriness, extends the focus window, and reduces the crash. Found naturally together in green tea. Widely studied, consistently well-tolerated.' },
                          { icon: '🌿', title: 'Bacopa monnieri', body: 'An adaptogenic herb with some of the strongest evidence for improving memory consolidation and reducing cognitive anxiety. Effects take 8-12 weeks to build. Take with fat. Recommended dose: 300-450mg of a 55% bacosides extract.' },
                          { icon: '⚠️', title: 'A word on stacking', body: "More is not better. Start with one supplement, give it 4-6 weeks, evaluate honestly. Supplements work best on top of fundamentals — sleep, exercise, and nutrition. No supplement compensates for poor sleep. Talk to your doctor, especially if you take any medications." },
                        ].map(({ icon, title, body }) => (
                          <div key={title} className={styles.focusContentCard}>
                            <span className={styles.focusContentCardIcon}>{icon}</span>
                            <div>
                              <p className={styles.focusContentCardTitle}>{title}</p>
                              <p className={styles.focusContentCardBody}>{body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </TabErrorBoundary>
          )}

          {/* ── CALENDAR ── */}
          {activeTab === 'calendar' && (
          <TabErrorBoundary tabName="Calendar">
          {(() => {
            const todayDStr = todayStr()
            const year = calMonth.getFullYear()
            const month = calMonth.getMonth()
            const monthName = calMonth.toLocaleDateString('en-US', { month: 'long' })
            const firstDayOfWeek = new Date(year, month, 1).getDay()
            const daysInMonth = new Date(year, month + 1, 0).getDate()
            const cells = []
            for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
            for (let d = 1; d <= daysInMonth; d++) cells.push(d)
            while (cells.length % 7 !== 0) cells.push(null)
            const monthOccurrences = getTaskOccurrencesForMonth(tasks, year, month)
            const billDueDays = {}
            bills.forEach(b => {
              if (b.due_day) {
                const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(b.due_day).padStart(2, '0')}`
                if (!billDueDays[dStr]) billDueDays[dStr] = []
                billDueDays[dStr].push(b)
              }
            })

            // Upcoming — next 7 days using scheduled_for
            const upStart = new Date(); upStart.setHours(0,0,0,0)
            const upEnd = new Date(upStart); upEnd.setDate(upStart.getDate() + 7)
            const upcomingTasks = tasks
              .filter(t => !t.completed && !t.archived && t.scheduled_for)
              .filter(t => { const sf = new Date(t.scheduled_for); sf.setHours(0,0,0,0); return sf >= upStart && sf <= upEnd })
              .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
            const upcomingByDate = {}
            upcomingTasks.forEach(t => {
              const d = t.scheduled_for.slice(0, 10)
              if (!upcomingByDate[d]) upcomingByDate[d] = []
              upcomingByDate[d].push(t)
            })
            const todayD = todayStr()
            const tomD = tomorrowStr()
            const fmtUpDate = (dStr) => {
              if (dStr === todayD) return 'Today'
              if (dStr === tomD) return 'Tomorrow'
              const [y, m, day] = dStr.split('-').map(Number)
              return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
            }

            // Day panel data
            const panelDayTasks = calDay ? calTasksForDay(localDateStr(calDay)) : []
            const panelScheduled = panelDayTasks.filter(t => t.due_time).sort((a, b) => new Date(a.due_time) - new Date(b.due_time))
            const panelUnscheduled = panelDayTasks.filter(t => !t.due_time)
            const panelBills = calDay ? bills.filter(b => b.due_day === calDay.getDate()) : []
            const panelDayLabel = calDay ? calDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : ''

            if (loading) return (
              <div className={styles.calView2}>
                <SkeletonCard lines={4} />
              </div>
            )

            if (tasksError) return (
              <div className={styles.calView2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
                <ErrorState message="Couldn't load your data." onRetry={() => { setTasksError(false); setLoading(true); fetchTasks(user.id) }} />
              </div>
            )

            const hasAnyMonthTasks = Object.keys(monthOccurrences).length > 0

            return (
              <div className={styles.calView2}>

                {/* Month grid card */}
                <div className={styles.calCard}>
                  <div className={styles.calMonthNav}>
                    <button className={styles.calNavBtn} onClick={calPrevMonth}><CaretLeft size={18} /></button>
                    <h2 className={styles.calMonthLabel}>{monthName} {year}</h2>
                    <button className={styles.calNavBtn} onClick={calNextMonth}><CaretRight size={18} /></button>
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
                      const dayTaskList = monthOccurrences[dStr] || []
                      const dayBillList = billDueDays[dStr] || []
                      const isToday = dStr === todayDStr
                      const isSelected = calDay && localDateStr(calDay) === dStr
                      return (
                        <div key={idx}
                          className={`${styles.calCell} ${isToday ? styles.calCellToday : ''} ${isSelected ? styles.calCellSelected : ''}`}
                          onClick={() => { setCalDay(new Date(year, month, day)); setCalDayPanelOpen(true) }}>
                          <span className={styles.calCellNum}>{day}</span>
                          <div className={styles.calDots}>
                            {dayTaskList.length > 0 && <span className={styles.calDotTask} />}
                            {dayBillList.length > 0 && <span className={styles.calDotBill} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Upcoming tasks hero */}
                <div className={styles.calUpcoming2}>
                  <p className={styles.calUpcoming2Label}>Coming up</p>
                  {Object.keys(upcomingByDate).length === 0 ? (
                    !hasAnyMonthTasks
                      ? <EmptyState useMarkIcon headline="Nothing scheduled." subtext="Tasks you add will show up here by date." />
                      : <p className={styles.calUpcoming2Empty}>You're clear for the next 7 days.</p>
                  ) : (
                    Object.entries(upcomingByDate).map(([dStr, dayList]) => (
                      <div key={dStr}>
                        <p className={styles.calUpcoming2DateHeader}>{fmtUpDate(dStr)}</p>
                        {dayList.map(t => (
                          <div key={t.id} className={styles.calUpcoming2Row} onClick={() => setDetailTask(t)}>
                            <div className={styles.calUpcoming2Left}>
                              <span className={styles.calUpcoming2Title}>{t.title}</span>
                              {t.due_time && (
                                <span className={styles.calUpcoming2Time}>
                                  {new Date(t.due_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            {t.consequence_level === 'external' && <span className={styles.calUpcoming2ExtBadge}>Ext</span>}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>

                {/* Day Panel slide-up sheet */}
                {calDayPanelOpen && calDay && (
                  <>
                    <div className={styles.calPanelBg} onClick={() => setCalDayPanelOpen(false)} />
                    <div className={styles.calPanel}>
                      <div className={styles.calPanelHandle} />
                      <div className={styles.calPanelHeader}>
                        <h3 className={styles.calPanelTitle}>{panelDayLabel}</h3>
                        <button className={styles.calPanelClose} onClick={() => setCalDayPanelOpen(false)}>✕</button>
                      </div>
                      <div className={styles.calPanelBody}>
                        {panelScheduled.length > 0 && (
                          <div className={styles.calPanelSection}>
                            {panelScheduled.map(t => (
                              <div key={t.id} className={styles.calPanelTaskRow} onClick={() => { setDetailTask(t); setCalDayPanelOpen(false) }}>
                                <span className={styles.calPanelTaskTime}>
                                  {new Date(t.due_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                </span>
                                <span className={styles.calPanelTaskTitle}>{t.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {panelUnscheduled.length > 0 && (
                          <div className={styles.calPanelSection}>
                            <p className={styles.calPanelSectionLabel}>Unscheduled</p>
                            {panelUnscheduled.map(t => (
                              <div key={t.id} className={styles.calPanelTaskRow} onClick={() => { setDetailTask(t); setCalDayPanelOpen(false) }}>
                                <span className={styles.calPanelTaskTitle}>{t.title}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {panelBills.length > 0 && (
                          <div className={styles.calPanelSection}>
                            <p className={styles.calPanelSectionLabel}>Bills Due</p>
                            {panelBills.map(b => (
                              <div key={b.id} className={styles.calPanelBillRow}>
                                <Receipt size={14} style={{ color: '#E8321A', flexShrink: 0 }} />
                                <span className={styles.calPanelBillName}>{b.name}</span>
                                <span className={styles.calPanelBillAmt}>{fmtMoney(b.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {panelDayTasks.length === 0 && panelBills.length === 0 && (
                          <p className={styles.calPanelEmpty}>Nothing scheduled</p>
                        )}
                        <button className={styles.calPanelAddBtn} onClick={() => {
                          if (calDay) setNewDueDate(`${calDay.getFullYear()}-${String(calDay.getMonth()+1).padStart(2,'0')}-${String(calDay.getDate()).padStart(2,'0')}`)
                          setCalDayPanelOpen(false)
                          setShowAddModal(true)
                        }}>+ Add task for this day</button>
                      </div>
                    </div>
                  </>
                )}

              </div>
            )
          })()}
          </TabErrorBoundary>
          )}

                    {/* ── JOURNAL ── */}
          {activeTab === 'journal' && (
          <TabErrorBoundary tabName="Journal">
            <div className={styles.view}>
              <div className={styles.viewHeader}>
                <div>
                  <h1 className={styles.greetingText}>Journal</h1>
                  <p className={styles.headerSub}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                </div>
                {journalMessages.length > 0 && (
                  <button onClick={newJournalEntry} className={styles.addTaskBtn}>+ New entry</button>
                )}
              </div>

              {/* Current entry — conversation at top */}
              <div className={styles.journalMessages}>
                {journalMessages.map((msg, i) => (
                  <div key={i} className={msg.role === 'assistant' ? styles.journalBubbleAI : styles.journalBubbleUser}>
                    {msg.content}
                  </div>
                ))}
                {journalLoading && <div className={styles.journalBubbleAI}><span className={styles.checkinTyping}>···</span></div>}
                <div ref={journalEndRef} />
              </div>

              {/* Journal reminder prompt */}
              {showJournalReminder && (
                <div className={styles.journalTaskBanner}>
                  <span className={styles.journalTaskBannerText}>Want me to remind you to journal regularly?</span>
                  <div className={styles.journalTaskBannerBtns}>
                    <button className={styles.journalTaskNo} onClick={() => setShowJournalReminder(false)}>Got it</button>
                  </div>
                </div>
              )}

              {/* Task extraction cards — one per detected task, deduped */}
              {journalPendingTasks.map((task, i) => {
                const taskDate = task.scheduled_for ? new Date(task.scheduled_for) : null
                const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0)
                const tomorrowMidnight = new Date(todayMidnight); tomorrowMidnight.setDate(tomorrowMidnight.getDate() + 1)
                let dateLabel = ''
                if (taskDate) {
                  const d = new Date(taskDate); d.setHours(0, 0, 0, 0)
                  if (d.getTime() === todayMidnight.getTime()) dateLabel = ' · today'
                  else if (d.getTime() === tomorrowMidnight.getTime()) dateLabel = ' · tomorrow'
                  else dateLabel = ` · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                }
                return (
                  <div key={i} className={styles.journalTaskBanner}>
                    <span className={styles.journalTaskBannerText}>
                      Task detected: <strong>{task.title}</strong>{dateLabel}
                    </span>
                    <div className={styles.journalTaskBannerBtns}>
                      <button onClick={() => addJournalDetectedTask(task)} className={styles.journalTaskYes}>Add</button>
                      <button onClick={() => setJournalPendingTasks(prev => prev.filter(t => t.title !== task.title))} className={styles.journalTaskNo}>Skip</button>
                    </div>
                  </div>
                )
              })}

              {/* Input */}
              {journalMessages.length > 1 && (
                <button className={styles.clearHistoryBtn} onClick={() => {
                  try { localStorage.removeItem(`cinis_journal_history_${user.id}`) } catch {}
                  setJournalMessages([])
                }}>Clear history</button>
              )}
              <form onSubmit={sendJournalMessage} className={styles.journalForm}>
                <textarea placeholder="What's on your mind..."
                  value={journalInput}
                  onChange={e => { setJournalInput(e.target.value); setJournalHintVisible(false) }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendJournalMessage(e) } }}
                  onFocus={() => {
                    try {
                      if (!localStorage.getItem('fb_journal_hint_dismissed')) {
                        setJournalHintVisible(true)
                        localStorage.setItem('fb_journal_hint_dismissed', '1')
                        setTimeout(() => setJournalHintVisible(false), 5000)
                      }
                    } catch {}
                  }}
                  className={styles.journalTextarea} rows={3} />
                {journalHintVisible && (
                  <p className={styles.journalAutoSaveHint}>Your conversation saves automatically when you leave this tab.</p>
                )}
                <div className={styles.journalFormFooter}>
                  <span className={styles.journalHint}>Shift+Enter for new line</span>
                  <button type="submit" disabled={journalLoading || !journalInput.trim()} className={styles.journalSendBtn}>Send →</button>
                </div>
              </form>

              {/* Past entries deck — below the input */}
              {journalHistory.length > 0 && (
                <div className={styles.journalHistory}>
                  <p className={styles.journalHistoryLabel}>Past entries</p>
                  {journalHistory.map(entry => {
                    const isExpanded = journalExpandedEntry === entry.id
                    const d = new Date(entry.created_at)
                    const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                    const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                    const isPrivate = entry.ai_summary === 'Personal entry.'
                    const preview = entry.ai_summary && !isPrivate
                      ? entry.ai_summary
                      : !entry.ai_summary
                        ? `${(entry.content || '').slice(0, 80)}${(entry.content || '').length > 80 ? '...' : ''}`
                        : null
                    return (
                      <div key={entry.id}
                        className={`${styles.journalEntryCard} ${isExpanded ? styles.journalEntryExpanded : ''}`}
                        onClick={() => setJournalExpandedEntry(isExpanded ? null : entry.id)}>
                        <div className={styles.journalEntryDate}>{dateStr} · {timeStr}</div>
                        {isPrivate
                          ? <div className={styles.journalEntryPrivate}>🔒 Personal entry</div>
                          : <div className={styles.journalEntrySummary}>{preview}</div>
                        }
                        {isExpanded && (
                          <div style={{ marginTop: '10px', fontSize: '13px', color: 'rgba(240,234,214,0.6)', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '10px' }}>
                            {entry.content}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </TabErrorBoundary>
          )}

          {/* ── PROGRESS ── */}
          {activeTab === 'progress' && (
          <TabErrorBoundary tabName="Progress">
          {(() => {
            // ── Derived data ──────────────────────────────────────────────
            const pgTodayStr = s17TodayStr
            const todayTasksForRings = tasks.filter(t => !t.archived && t.scheduled_for && t.scheduled_for.slice(0,10) === pgTodayStr)
            const completedTodayCount = todayTasksForRings.filter(t => t.completed).length
            const totalTodayCount = todayTasksForRings.length
            const taskRingPct = totalTodayCount > 0 ? completedTodayCount / totalTodayCount : 0

            const todayIso = new Date().toISOString().split('T')[0]
            const todayJournaled = (Array.isArray(journalEntries) ? journalEntries : []).some(j => j.created_at?.startsWith(todayIso))
            const journalRingPct = todayJournaled ? 1 : 0

            // Focus ring — today's focus_minutes from progress_snapshots
            const todaySnapshot = progressSnapshots.find(s => s.snapshot_date?.slice(0, 10) === pgTodayStr)
            const todayFocusMinutes = todaySnapshot?.focus_minutes || 0
            const focusRingPct = Math.min((todayFocusMinutes / 25), 1) // 25 min daily goal
            const focusRingDisplay = todayFocusMinutes > 0 ? `${todayFocusMinutes}m` : '0m'

            // XP milestones
            const totalXp = profile?.total_xp || 0
            const XP_MILESTONES = [
              { xp: 1000, label: 'Sticker pack' },
              { xp: 5000, label: 'Physical journal' },
              { xp: 25000, label: 'Lifetime Pro' },
            ]
            const nextMilestone = XP_MILESTONES.find(m => m.xp > totalXp)
            const xpBarPct = nextMilestone ? Math.min((totalXp / nextMilestone.xp) * 100, 100) : 100
            const xpToNext = nextMilestone ? (nextMilestone.xp - totalXp).toLocaleString() : null

            // Weekly bar chart — last 7 days from tasks
            const barDays = Array.from({length: 7}, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0)
              return d
            })
            const prevBarDays = Array.from({length: 7}, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (13 - i)); d.setHours(0,0,0,0)
              return d
            })
            const barCounts = barDays.map(d => {
              const dStr = localDateStr(d)
              return tasks.filter(t => t.completed && t.completed_at && localDateStr(new Date(t.completed_at)) === dStr).length
            })
            const prevBarCounts = prevBarDays.map(d => {
              const dStr = localDateStr(d)
              return tasks.filter(t => t.completed && t.completed_at && localDateStr(new Date(t.completed_at)) === dStr).length
            })
            const barMax = Math.max(...barCounts, ...prevBarCounts, 1)

            // Monthly summary data (separate from weekly)
            const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
            const completedThisMonthList = tasks.filter(t => t.completed && t.completed_at && new Date(t.completed_at) >= monthStart)
            const monthBestDay = (() => {
              const dc = {}
              completedThisMonthList.forEach(t => {
                const d = new Date(t.completed_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                dc[d] = (dc[d] || 0) + 1
              })
              if (!Object.keys(dc).length) return null
              return Object.entries(dc).sort((a,b) => b[1]-a[1])[0]
            })()

            // Loading / error / empty early returns
            if (loading) return (
              <div style={{ padding: '12px 14px', paddingBottom: 80, maxWidth: 680, margin: '0 auto', overflowY: 'auto', minHeight: '100%' }}>
                <SkeletonCard lines={3} />
                <SkeletonCard lines={3} />
              </div>
            )
            if (tasksError || progressError) return (
              <div style={{ padding: '12px 14px', paddingBottom: 80, maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
                <ErrorState message="Couldn't load your data." onRetry={() => { setTasksError(false); setProgressError(false); setLoading(true); fetchTasks(user.id) }} />
              </div>
            )
            if (!loading && tasks.length === 0 && totalXp === 0) return (
              <div style={{ padding: '12px 14px', paddingBottom: 80, maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
                <EmptyState
                  useMarkIcon
                  headline="Nothing tracked yet."
                  subtext="Complete tasks and focus sessions to start building your history."
                />
              </div>
            )

            // Ring renderer
            const renderRing = (pct, color, centerText, label) => {
              const r = 28
              const circ = 2 * Math.PI * r
              const offset = circ * (1 - Math.min(pct, 1))
              return (
                <div className={styles.pgRingWrap}>
                  <div className={styles.pgRingSvgWrap}>
                    <svg width="72" height="72" viewBox="0 0 72 72">
                      <circle cx="36" cy="36" r={r} fill="none" stroke="#3E3228" strokeWidth="5" />
                      {pct > 0 && (
                        <circle cx="36" cy="36" r={r} fill="none" stroke={color} strokeWidth="5"
                          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                          style={{ transform: 'rotate(-90deg)', transformOrigin: '36px 36px', transition: 'stroke-dashoffset 0.6s ease' }} />
                      )}
                    </svg>
                    <div className={styles.pgRingCenter}>
                      <span className={styles.pgRingValue}>{centerText}</span>
                    </div>
                  </div>
                  <span className={styles.pgRingLabel}>{label}</span>
                </div>
              )
            }

            return (
              <div className={styles.pgView}>

                {/* 1 — Today's rings */}
                <div className={styles.pgSection}>
                  <p className={styles.pgSectionLabel}>Today</p>
                  <div className={styles.pgRingsRow}>
                    {renderRing(taskRingPct, '#FF6644', `${completedTodayCount}/${totalTodayCount}`, 'Tasks')}
                    {renderRing(focusRingPct, '#E8321A', focusRingDisplay, 'Focus')}
                    {renderRing(journalRingPct, '#4CAF50', todayJournaled ? '✓' : '—', 'Journal')}
                  </div>
                </div>

                {/* 2 — XP bar */}
                <div className={styles.pgSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', gap: '12px' }}>
                    <p className={styles.pgSectionLabel}>{totalXp.toLocaleString()} XP</p>
                    {nextMilestone && (
                      <span style={{ fontSize: '12px', color: 'rgba(240,234,214,0.6)', whiteSpace: 'nowrap' }}>
                        Next: {nextMilestone.label}
                      </span>
                    )}
                  </div>
                  <div className={styles.pgXpBarTrack}>
                    <div className={styles.pgXpBarFill} style={{ width: `${xpBarPct}%` }} />
                  </div>
                  {xpToNext && (
                    <p style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(240,234,214,0.35)', marginTop: '6px' }}>
                      {xpToNext} XP to {nextMilestone.label}
                    </p>
                  )}
                </div>

                {/* 3 — AI Insight cards */}
                <div className={styles.pgSection}>
                  <p className={styles.pgSectionLabel}>Insights</p>
                  {progressInsightsLoading ? (
                    <>
                      <div className={styles.pgInsightSkeleton} />
                      <div className={styles.pgInsightSkeleton} />
                      <div className={styles.pgInsightSkeleton} />
                    </>
                  ) : progressInsights.length > 0 ? (
                    progressInsights.map((ins, i) => (
                      <div key={i} className={styles.pgInsightCard}>
                        <span className={styles.pgInsightIcon}>
                          {ins.type === 'alert' ? '⚠' : ins.type === 'win' ? '🏆' : '🔍'}
                        </span>
                        <div>
                          <p className={styles.pgInsightTitle}>{ins.title}</p>
                          <p className={styles.pgInsightBody}>{ins.body}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.pgInsightEmpty}>
                      <p className={styles.pgInsightEmptyText}>Insights generate after a few days of activity.</p>
                    </div>
                  )}
                </div>

                {/* 4 — Weekly bar chart */}
                <div className={styles.pgSection}>
                  <p className={styles.pgSectionLabel}>This week vs last week</p>
                  <div className={styles.pgBarChart}>
                    {barDays.map((d, i) => {
                      const isToday = localDateStr(d) === todayLocalStr
                      const pct = barMax > 0 ? (barCounts[i] / barMax) * 100 : 0
                      const prevPct = barMax > 0 ? (prevBarCounts[i] / barMax) * 100 : 0
                      return (
                        <div key={i} className={styles.pgBarCol}>
                          <div className={styles.pgBarStack}>
                            {prevPct > 0 && (
                              <div className={styles.pgBarPrev} style={{ height: `${prevPct}%` }} />
                            )}
                            <div className={`${styles.pgBar} ${isToday ? styles.pgBarToday : ''}`}
                              style={{ height: `${Math.max(pct, 2)}%` }}>
                              {barCounts[i] > 0 && <span className={styles.pgBarCount}>{barCounts[i]}</span>}
                            </div>
                          </div>
                          <span className={`${styles.pgBarLabel} ${isToday ? styles.pgBarLabelToday : ''}`}>
                            {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* 5 — Monthly summary card */}
                <div className={styles.pgSection}>
                  <p className={styles.pgSectionLabel}>This month</p>
                  <div className={styles.pgMonthCard}>
                    <div className={styles.pgMonthStats}>
                      <div className={styles.pgMonthStat}>
                        <span className={styles.pgMonthStatNum}>{completedThisMonthList.length}</span>
                        <span className={styles.pgMonthStatLabel}>Completed</span>
                      </div>
                      {monthBestDay && (
                        <div className={styles.pgMonthStat}>
                          <span className={styles.pgMonthStatNum}>{monthBestDay[0]}</span>
                          <span className={styles.pgMonthStatLabel}>{monthBestDay[1]} tasks (best)</span>
                        </div>
                      )}
                      <div className={styles.pgMonthStat}>
                        <span className={styles.pgMonthStatNum}>{profile?.current_streak || 0}</span>
                        <span className={styles.pgMonthStatLabel}>Day streak</span>
                      </div>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      {completedThisMonthList.length === 0
                        ? <p className={styles.pgMonthSummaryText}>Complete tasks this month and come back for your AI insight.</p>
                        : monthlySummaryLoading ? <p className={styles.progressSummaryLoading}>···</p>
                        : monthlySummary ? <p className={styles.pgMonthSummaryText}>{monthlySummary}</p>
                        : <button onClick={fetchMonthlySummary} className={styles.progressSummaryRefresh}>Generate insight</button>
                      }
                    </div>
                  </div>
                </div>

                {/* 6 — Streak card */}
                <div className={styles.pgStreakCard}>
                  {(profile?.current_streak || 0) === 0 ? (
                    <p className={styles.pgStreakEmpty}>Start your streak today</p>
                  ) : (
                    <>
                      <div className={styles.pgStreakMain}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          <span className={styles.pgStreakNum}>{profile?.current_streak || 0}</span>
                          {[7, 14, 30, 60, 90].includes(profile?.current_streak) && (
                            <span style={{ fontSize: '20px' }}>🔥</span>
                          )}
                        </div>
                        <span className={styles.pgStreakLabel}>day streak</span>
                      </div>
                      {(profile?.longest_streak || 0) > 0 && (
                        <p className={styles.pgStreakSub}>Longest: {profile.longest_streak} days</p>
                      )}
                    </>
                  )}
                </div>

              </div>
            )
          })()}
          </TabErrorBoundary>
          )}

          {/* ── GUIDE ── */}
          {activeTab === 'guide' && (
          <TabErrorBoundary tabName="Guide">
            <div className={styles.guideView} style={{ paddingBottom: '80px', display: 'flex', flexDirection: 'column' }}>

              {/* FOR YOU CAROUSEL */}
              {(() => {
                const forYouCards = []
                const overdueCount = tasks.filter(t => !t.completed && t.due_time && new Date(t.due_time) < new Date()).length
                if (overdueCount >= 3) {
                  forYouCards.push({ id: 'overdue', icon: '🎯', title: 'The one-task rule', preview: 'Too many open loops?', cta: 'Open Tasks', action: 'tasks' })
                }
                const streak = profile?.current_streak || 0
                if (streak >= 7) {
                  forYouCards.push({ id: 'streak', icon: '🔥', title: 'Protect the streak', preview: 'You\'re on a roll.', cta: 'Open Check-in', action: 'checkin' })
                }
                const focusThisWeek = tasks.filter(t => {
                  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
                  return t.completed && t.completed_at && new Date(t.completed_at) > weekAgo && t.tag === 'focus'
                }).length
                if (focusThisWeek === 0) {
                  forYouCards.push({ id: 'focus', icon: '👥', title: 'Body doubles work', preview: 'Focus alongside someone.', cta: 'Open Focus', action: 'focus' })
                }
                forYouCards.push(
                  { id: 'tip1', icon: '✦', title: 'How Check-in works', preview: 'Your coach knows your context.', cta: 'Open Check-in', action: 'checkin' },
                  { id: 'tip2', icon: '⭐', title: 'Star your #1 task', preview: 'One thing. Go.', cta: 'Open Tasks', action: 'tasks' }
                )

                return (
                  <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontFamily: 'Figtree, sans-serif', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#FF6644', marginBottom: '12px', marginLeft: '12px' }}>For You</p>
                    <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingLeft: '12px', paddingRight: '12px' }}>
                      {forYouCards.map(card => (
                        <div key={card.id} style={{ minWidth: '220px', backgroundColor: '#3E3228', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                          <div style={{ fontSize: '32px', marginBottom: '8px' }}>{card.icon}</div>
                          <p style={{ fontFamily: 'Figtree, sans-serif', fontWeight: 500, fontSize: '13px', color: '#F0EAD6', marginBottom: '4px' }}>{card.title}</p>
                          <p style={{ fontFamily: 'Figtree, sans-serif', fontWeight: 400, fontSize: '11px', color: 'rgba(240,234,214,0.5)', marginBottom: '8px' }}>{card.preview}</p>
                          <button onClick={() => card.action === 'tasks' || card.action === 'checkin' || card.action === 'focus' ? switchTab(card.action) : null} style={{ marginTop: 'auto', backgroundColor: 'transparent', color: '#FF6644', border: 'none', fontFamily: 'Figtree, sans-serif', fontSize: '11px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                            {card.cta}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* FILTER CHIPS */}
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingLeft: '12px', paddingRight: '12px', marginBottom: '20px' }}>
                {['All', 'Cinis', 'Quick Wins', 'Focus', 'Momentum', 'Systems', 'Saved'].map(filter => (
                  <button
                    key={filter}
                    onClick={() => setGuideSelectedFilter(filter)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '20px',
                      backgroundColor: guideSelectedFilter === filter ? '#FF6644' : '#3E3228',
                      color: '#F0EAD6',
                      border: guideSelectedFilter === filter ? 'none' : '1px solid rgba(255,102,68,0.3)',
                      fontFamily: 'Figtree, sans-serif',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {/* STRATEGY CARDS */}
              <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '12px', paddingRight: '12px' }}>
                {GUIDE_STRATEGIES.filter(s => {
                  if (guideSelectedFilter === 'All') return true
                  if (guideSelectedFilter === 'Saved') return guideBookmarks.includes(s.id)
                  return s.tag === guideSelectedFilter
                }).map(strategy => (
                  <div key={strategy.id} style={{ marginBottom: '12px', backgroundColor: '#3E3228', borderRadius: '12px', padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setGuideExpandedCard(guideExpandedCard === strategy.id ? null : strategy.id)}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                        <span style={{ fontSize: '24px', marginTop: '2px' }}>{strategy.icon}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontFamily: 'Figtree, sans-serif', fontWeight: 500, fontSize: '13px', color: '#F0EAD6', margin: 0, marginBottom: '4px' }}>{strategy.title}</p>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ display: 'inline-block', backgroundColor: '#211A14', color: '#FF6644', padding: '4px 8px', borderRadius: '12px', fontFamily: 'Figtree, sans-serif', fontSize: '10px', fontWeight: 500 }}>{strategy.tag}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setGuideBookmarks(guideBookmarks.includes(strategy.id) ? guideBookmarks.filter(id => id !== strategy.id) : [...guideBookmarks, strategy.id])
                          localStorage.setItem('cinis_guide_bookmarks', JSON.stringify(guideBookmarks.includes(strategy.id) ? guideBookmarks.filter(id => id !== strategy.id) : [...guideBookmarks, strategy.id]))
                        }}
                        style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: 0, marginLeft: '8px' }}
                      >
                        {guideBookmarks.includes(strategy.id) ? '🔖' : '📄'}
                      </button>
                    </div>
                    {guideExpandedCard === strategy.id && (
                      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(240,234,214,0.1)' }}>
                        <p style={{ fontFamily: 'Figtree, sans-serif', fontWeight: 400, fontSize: '12px', color: '#F0EAD6', lineHeight: 1.5, margin: 0, marginBottom: '12px' }}>{strategy.body}</p>
                        <button
                          onClick={() => {
                            setGuideTried(guideTried.includes(strategy.id) ? guideTried.filter(id => id !== strategy.id) : [...guideTried, strategy.id])
                            localStorage.setItem('cinis_guide_tried', JSON.stringify(guideTried.includes(strategy.id) ? guideTried.filter(id => id !== strategy.id) : [...guideTried, strategy.id]))
                          }}
                          style={{ backgroundColor: guideTried.includes(strategy.id) ? '#4CAF50' : 'transparent', color: '#F0EAD6', border: guideTried.includes(strategy.id) ? 'none' : '1px solid rgba(240,234,214,0.3)', padding: '8px 12px', borderRadius: '6px', fontFamily: 'Figtree, sans-serif', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                        >
                          {guideTried.includes(strategy.id) ? 'This worked ✓' : 'This worked'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* COACH CTA */}
              <div style={{ padding: '12px 12px 20px', marginTop: '12px' }}>
                <div style={{ backgroundColor: '#3E3228', borderRadius: '12px', padding: '12px 14px', border: '1px solid rgba(255,102,68,0.4)', textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Figtree, sans-serif', fontWeight: 400, fontSize: '12px', color: '#F0EAD6', margin: 0, marginBottom: '12px' }}>Want to talk through a strategy?</p>
                  <button
                    onClick={() => {
                      setCheckinInput('I want to talk about a focus strategy')
                      switchTab('checkin')
                    }}
                    style={{ backgroundColor: '#FF6644', color: '#F0EAD6', border: 'none', padding: '10px 16px', borderRadius: '6px', fontFamily: 'Figtree, sans-serif', fontSize: '12px', fontWeight: 500, cursor: 'pointer', width: '100%' }}
                  >
                    Ask your coach
                  </button>
                </div>
              </div>

            </div>
          </TabErrorBoundary>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && (
          <TabErrorBoundary tabName="Settings">
            <div className={styles.stgView}>

              {/* ── 1. COACHING BLEND ── */}
              <div className={styles.stgSection}>
                <p className={styles.stgLabel}>Coaching Blend</p>
                <p className={styles.stgSublabel}>Pick up to 3 personas</p>
                <div className={styles.stgCard}>
                  <div className={styles.stgChips}>
                    {PERSONAS_LIST.map(({ key, label }) => {
                      const blend = profile?.persona_blend || []
                      const selected = blend.includes(key)
                      return (
                        <button
                          key={key}
                          className={`${styles.stgChip} ${selected ? styles.stgChipActive : ''}`}
                          onClick={async () => {
                            const current = profile?.persona_blend || []
                            let next
                            if (current.includes(key)) {
                              next = current.filter(k => k !== key)
                            } else {
                              if (current.length >= 3) return
                              next = [...current, key]
                            }
                            setProfile(prev => ({ ...prev, persona_blend: next }))
                            const ok = await patchSettings({ persona_blend: next })
                            if (!ok) {
                              // Roll back optimistic update on failure
                              setProfile(prev => ({ ...prev, persona_blend: current }))
                            }
                          }}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── 2. CHECK-IN SCHEDULE ── */}
              <div className={styles.stgSection}>
                <p className={styles.stgLabel}>Check-in Schedule</p>
                <div className={styles.stgCard}>
                  {[
                    { key: 'morning', label: 'Morning', toggle: notifMorning, setToggle: setNotifMorning, time: checkinMorningTime, setTime: setCheckinMorningTime },
                    { key: 'midday', label: 'Midday', toggle: notifMidday, setToggle: setNotifMidday, time: checkinMiddayTime, setTime: setCheckinMiddayTime },
                    { key: 'evening', label: 'Evening', toggle: notifEvening, setToggle: setNotifEvening, time: checkinEveningTime, setTime: setCheckinEveningTime },
                  ].map(({ key, label, toggle, setToggle, time, setTime }) => (
                    <div key={key} className={styles.stgRow}>
                      <span className={styles.stgRowLabel}>{label}</span>
                      <div className={styles.stgRowRight}>
                        <input
                          type="time"
                          value={time}
                          disabled={!toggle}
                          className={`${styles.stgTimeInput} ${!toggle ? styles.stgTimeInputDisabled : ''}`}
                          onChange={e => setTime(e.target.value)}
                          onBlur={async e => {
                            const newVal = e.target.value
                            await patchSettings({
                              morning_time: key === 'morning' ? newVal : checkinMorningTime,
                              midday_time: key === 'midday' ? newVal : checkinMiddayTime,
                              evening_time: key === 'evening' ? newVal : checkinEveningTime,
                            })
                          }}
                        />
                        <button
                          className={`${styles.stgToggle} ${toggle ? styles.stgToggleOn : ''}`}
                          onClick={async () => {
                            const newVal = !toggle
                            setToggle(newVal)
                            const newMorning = key === 'morning' ? newVal : notifMorning
                            const newMidday  = key === 'midday'  ? newVal : notifMidday
                            const newEvening = key === 'evening' ? newVal : notifEvening
                            const checkin_times = ['morning','midday','evening'].filter((_,i) => [newMorning,newMidday,newEvening][i])
                            await patchSettings({ checkin_times })
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 3. NOTIFICATIONS ── */}
              <div className={styles.stgSection}>
                <p className={styles.stgLabel}>Notifications</p>
                <div className={styles.stgCard}>
                  <div className={styles.stgRow}>
                    <span className={styles.stgRowLabel}>Push notifications</span>
                    {notifPermission === 'denied' ? (
                      <span className={styles.stgNotifDeniedLabel}>Blocked</span>
                    ) : profile?.push_notifications_enabled ? (
                      <button
                        className={`${styles.stgToggle} ${styles.stgToggleOn}`}
                        onClick={handleDisablePush}
                      />
                    ) : (
                      <button
                        className={styles.stgToggle}
                        onClick={handleEnablePush}
                      />
                    )}
                  </div>
                  {notifPermission === 'denied' && (
                    <p className={styles.stgNotifDeniedMsg}>Enable notifications in your browser settings</p>
                  )}
                </div>
              </div>

              {/* ── 4. APPEARANCE ── */}
              <div className={styles.stgSection}>
                <p className={styles.stgLabel}>Appearance</p>
                <div className={styles.stgCard}>
                  <div className={styles.stgThemeChips}>
                    {[
                      { id: 'orange-bronze', label: 'Classic', locked: false },
                      { id: 'midnight', label: 'Midnight', locked: false },
                      { id: 'warm', label: 'Warm', locked: false },
                    ].map(({ id, label, locked }) => {
                      const isActive = activeTheme?.id === id
                      return (
                        <button
                          key={id}
                          className={`${styles.stgThemeChip} ${isActive ? styles.stgThemeChipActive : ''} ${locked ? styles.stgThemeChipLocked : ''}`}
                          style={locked ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                          onClick={locked ? undefined : () => {
                            const theme = THEMES.find(t => t.id === id)
                            if (theme) saveTheme(theme)
                          }}
                        >
                          {label}
                          {locked && <span className={styles.stgChipComingSoon}> Coming soon</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── 5. ACCOUNT ── */}
              <div className={styles.stgSection}>
                <p className={styles.stgLabel}>Account</p>
                <div className={styles.stgCard}>
                  <div className={styles.stgRow}>
                    <span className={styles.stgRowLabel}>Display name</span>
                    <input
                      type="text"
                      className={styles.stgInlineInput}
                      value={settingsName}
                      placeholder="Your name"
                      onChange={e => setSettingsName(e.target.value)}
                      onBlur={saveSettings}
                      onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                    />
                  </div>
                  <div className={styles.stgRow}>
                    <span className={styles.stgRowLabel}>Email</span>
                    <span className={styles.stgEmailDisplay}>{user?.email}</span>
                  </div>
                  <div className={`${styles.stgRow} ${styles.stgRowLast}`}>
                    <div>
                      <span className={styles.stgRowLabel}>Data</span>
                      <span className={styles.stgRowSub}>Download a copy of everything Cinis has saved</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <button
                        className={styles.stgGhostBtn}
                        onClick={handleExportData}
                        disabled={exportLoading}
                        style={{ opacity: exportLoading ? 0.6 : 1 }}
                      >
                        {exportLoading ? 'Exporting...' : 'Export'}
                      </button>
                      {exportError && <span style={{ color: '#E8321A', fontSize: '12px' }}>{exportError}</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 6. DANGER ZONE ── */}
              <div className={styles.stgSection}>
                <p className={styles.stgLabel}>Danger Zone</p>
                <div className={styles.stgDangerCard}>
                  <div className={styles.stgRow}>
                    <span className={styles.stgDangerRowLabel}>Delete account</span>
                    <button className={styles.stgDangerBtn} onClick={() => setDeleteConfirm(true)}>
                      Delete account
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 7. LOG OUT ── */}
              <button
                className={styles.stgSignOutBtn}
                onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
              >
                Log out
              </button>

            </div>
          </TabErrorBoundary>
          )}

          {/* Delete account confirmation overlay */}
          {deleteConfirm && (
            <div className={styles.stgDeleteOverlay} onClick={() => !deletingAccount && setDeleteConfirm(false)}>
              <div className={styles.stgDeleteOverlayCard} onClick={e => e.stopPropagation()}>
                <div className={styles.stgDeleteOverlayTitle}>Delete Account</div>
                <div className={styles.stgDeleteOverlayMsg}>
                  This will permanently delete all your data. This cannot be undone.
                </div>
                <div className={styles.stgDeleteOverlayActions}>
                  <button
                    className={styles.stgDeleteConfirmBtn}
                    disabled={deletingAccount}
                    onClick={async () => {
                      setDeletingAccount(true)
                      try {
                        const res = await loggedFetch('/api/delete-account', { method: 'DELETE' })
                        if (res.ok) {
                          await supabase.auth.signOut()
                          router.push('/login')
                        }
                      } catch (err) {
                        console.error('Delete account failed:', err)
                      }
                      setDeletingAccount(false)
                    }}
                  >
                    {deletingAccount ? 'Deleting…' : 'Yes, delete everything'}
                  </button>
                  <button
                    className={styles.stgDeleteCancelBtn}
                    disabled={deletingAccount}
                    onClick={() => setDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── FINANCE ── */}
          {activeTab === 'finance' && (
          <TabErrorBoundary tabName="Finance">
            <div className={styles.view}>

              {/* Sub-tab nav */}
              <div className={styles.financeSubTabs}>
                {[['bills',<Receipt size={18} />,'Bills'],['plans',<Scales size={18} />,'Plans'],['knowledge',<Books size={18} />,'Knowledge'],['insights',<Robot size={18} />,'Insights']].map(([id, icon, label]) => (
                  <button key={id} onClick={() => setFinanceSub(id)}
                    className={`${styles.financeSubTab} ${financeSub === id ? styles.financeSubTabActive : ''}`}>
                    <span className={styles.subTabIcon}>{icon}</span>
                    <span className={styles.subTabLabel}>{label}</span>
                  </button>
                ))}
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
                      <div className={styles.viewHeader}>
                        <div>
                          <h1 className={styles.greetingText}>Monthly expenses</h1>
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
                  <div className={styles.viewHeader}>
                    <div>
                      <h1 className={styles.greetingText}>Monthly expenses</h1>
                      <p className={styles.financeTotal}>{fmtMoney(monthlyTotal)}<span className={styles.financeTotalSub}>/mo</span></p>
                    </div>
                    <button onClick={() => setShowAddBillModal(true)} className={styles.addTaskBtn}>+ Add bill</button>
                  </div>

                  {/* Income setup card - shows when monthly_income is null */}
                  {!profile?.monthly_income && (
                    <div className={styles.budgetSetupCard}>
                      <p className={styles.budgetSetupLabel}>What's your monthly take-home pay?</p>
                      <div className={styles.incomeInputRow}>
                        <span style={{ fontFamily: 'Sora, sans-serif', fontSize: '12px', color: 'rgba(240,234,214,0.4)' }}>$</span>
                        <input
                          type="number"
                          placeholder="0"
                          min="0"
                          step="1"
                          value={monthlyIncomeInput}
                          onChange={e => setMonthlyIncomeInput(e.target.value)}
                          style={{ fontFamily: 'Sora, sans-serif', fontSize: '18px', color: '#F0EAD6' }}
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
                          if (val > 0 && user) {
                            try {
                              const res = await loggedFetch('/api/settings', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ monthly_income: val, income_frequency: incomeFrequency })
                              })
                              if (res.ok) {
                                setProfile(prev => ({ ...prev, monthly_income: val, income_frequency: incomeFrequency }))
                                setMonthlyIncomeInput('')
                                showToast('Income saved')
                              }
                            } catch (err) {
                              console.error('Income save failed:', err)
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
                                    {bill.autopay ? 'Autopay on' : 'Autopay off'}
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
              {financeSub === 'plans' && (() => {
                const freqMultiplier = { weekly: 4.33, biweekly: 2.17, bimonthly: 2, monthly: 1 }[incomeFrequency] || 1
                const normalizedIncome = monthlyIncome * freqMultiplier
                return (
                <div className={styles.budgetPanel}>
                  {/* Learn referral callout */}
                  {learnReferral && (
                    <div className={styles.learnReferralBanner}>
                      <button className={styles.learnReferralClose} onClick={() => setLearnReferral(null)}>×</button>
                      {learnReferral === '50-30-20' && (normalizedIncome > 0
                        ? <p>Based on 50/30/20 — Your needs budget is <strong>{fmtMoney(normalizedIncome * 0.5)}</strong>, wants <strong>{fmtMoney(normalizedIncome * 0.3)}</strong>, savings <strong>{fmtMoney(normalizedIncome * 0.2)}</strong>. Your fixed bills of <strong>{fmtMoney(monthlyTotal)}</strong> fit within your needs allocation.</p>
                        : <p>Add your income above to see this calculation.</p>
                      )}
                      {learnReferral === 'debt-avalanche' && (() => {
                        const debts = bills.filter(b => b.bill_type === 'loan' || b.bill_type === 'credit_card').filter(b => b.interest_rate > 0).sort((a, b) => b.interest_rate - a.interest_rate)
                        if (debts.length === 0) return <p>Add interest rates to your loans and debts in the Bills tab to see your payoff order.</p>
                        return <p>Debt Avalanche order: {debts.map(d => d.name).join(' → ')}. Pay minimums on all, attack <strong>{debts[0].name}</strong> first.</p>
                      })()}
                      {learnReferral === 'emergency-fund' && (
                        <p>Your 3-month emergency fund target: <strong>{fmtMoney(monthlyTotal * 3)}</strong>. Start with <strong>{fmtMoney(monthlyTotal * 0.5)}/month</strong> to build it in 6 months.</p>
                      )}
                      {!['50-30-20','debt-avalanche','emergency-fund'].includes(learnReferral) && (
                        <p>Your fixed bills are <strong>{fmtMoney(monthlyTotal)}/mo</strong>. Use this concept to improve how you allocate the rest.</p>
                      )}
                    </div>
                  )}

                  {/* Income input */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Take-home income</label>
                    <div className={styles.quickRow}>
                      <input
                        type="number" placeholder="e.g. 3,500" min="0" step="1"
                        value={monthlyIncomeInput}
                        onChange={e => setMonthlyIncomeInput(e.target.value)}
                        className={styles.fieldInput}
                        style={{ maxWidth: '160px' }}
                      />
                      <button
                        className={styles.addTaskBtn}
                        onClick={() => {
                          const val = parseFloat(monthlyIncomeInput) || 0
                          setMonthlyIncome(val)
                          if (typeof localStorage !== 'undefined') {
                            localStorage.setItem('fb_monthly_income', String(val))
                            localStorage.setItem('fb_income_frequency', incomeFrequency)
                          }
                          showToast('Income saved')
                        }}
                      >
                        Save
                      </button>
                    </div>
                    {/* Income frequency selector */}
                    <div className={styles.toggleRow} style={{ marginTop: '10px' }}>
                      {[['weekly','Weekly'],['biweekly','Biweekly'],['bimonthly','Bimonthly'],['monthly','Monthly']].map(([val, lbl]) => (
                        <button key={val} type="button" onClick={() => {
                          setIncomeFrequency(val)
                          if (typeof localStorage !== 'undefined') localStorage.setItem('fb_income_frequency', val)
                        }}
                          className={`${styles.toggleBtn} ${incomeFrequency === val ? styles.toggleBtnActive : ''}`}>
                          {lbl}
                        </button>
                      ))}
                    </div>
                    {incomeFrequency !== 'monthly' && monthlyIncome > 0 && (
                      <p style={{ fontSize: '12px', color: 'rgba(240,234,214,0.35)', marginTop: '6px' }}>
                        = {fmtMoney(normalizedIncome)}/mo
                      </p>
                    )}
                  </div>

                  {normalizedIncome > 0 ? (
                    <>
                      {/* 50/30/20 breakdown */}
                      <div className={styles.budgetCard}>
                        <p className={styles.financeBreakdownLabel}>50 / 30 / 20 breakdown</p>
                        {[
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
                        <div className={styles.budgetRow}>
                          <div>
                            <span className={styles.budgetRowLabel}>Your fixed bills</span>
                            <span className={styles.budgetRowDesc}>Tracked in Bills tab</span>
                          </div>
                          <span className={styles.budgetRowAmt}>{fmtMoney(monthlyTotal)}<span className={styles.financeTotalSub}>/mo</span></span>
                        </div>
                      </div>

                      {/* Surplus / Deficit */}
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
                    </>
                  ) : (
                    <p className={styles.budgetEmptyNote}>Enter your take-home income above to see your breakdown.</p>
                  )}
                </div>
                )
              })()}

              {/* ── KNOWLEDGE ── */}
              {financeSub === 'knowledge' && (
                <div>
                  {[
                    {
                      key: '50-30-20', icon: '💰', title: 'The 50/30/20 Rule',
                      body: 'Split your take-home pay: 50% to needs (rent, groceries, bills), 30% to wants (dining, subscriptions, fun), 20% to savings or debt payoff. It\'s not a strict rule — it\'s a starting point.',
                      tag: 'Most people have no idea where their money goes. This gives it somewhere to go.',
                      impl: '1. Find your monthly take-home pay. 2. Multiply by 0.5 — that\'s your needs ceiling. 3. Multiply by 0.3 — that\'s your wants budget. 4. The remaining 20% goes to savings or debt before you spend anything else. 5. Track for one month without judging — just observe.',
                    },
                    {
                      key: 'debt-avalanche', icon: '🔥', title: 'The Debt Avalanche',
                      body: 'List your debts by interest rate, highest first. Pay minimums on everything, then throw every extra dollar at the highest-rate debt. Once it\'s gone, roll that payment to the next one.',
                      tag: 'This method saves the most money in interest over time.',
                      impl: '1. List every debt with its balance and interest rate. 2. Set up minimum autopay on all of them. 3. Put every extra dollar toward the highest-rate debt. 4. When that debt hits zero, add its payment to the next highest. 5. Repeat until clear.',
                    },
                    {
                      key: 'emergency-fund', icon: '⛄', title: 'The Emergency Fund',
                      body: "Keep 3-6 months of expenses in a separate, boring savings account you don't touch. Not for opportunities — only for actual emergencies.",
                      tag: 'Without one, any surprise expense becomes debt.',
                      impl: "1. Open a separate savings account — label it 'Emergency Only'. 2. Calculate 3 months of your essential expenses. 3. Set up a small automatic transfer each payday — even $25 counts. 4. Build to 1 month first, then 3, then 6. 5. Do not touch it for non-emergencies.",
                    },
                    {
                      key: 'compound', icon: '📈', title: 'Compound Interest',
                      body: 'When your money earns interest, and that interest earns interest, growth accelerates over time. Starting at 25 vs 35 can mean hundreds of thousands of dollars by retirement.',
                      tag: 'Time in the market beats timing the market.',
                      impl: '1. Open a retirement account (401k if employer offers match — take the full match first). 2. Then open a Roth IRA if eligible. 3. Invest in a low-cost index fund (e.g. S&P 500 index). 4. Set up automatic contributions. 5. Don\'t check it daily — let time do the work.',
                    },
                    {
                      key: 'fixed-variable', icon: '🧾', title: 'Fixed vs Variable Expenses',
                      body: 'Fixed expenses are the same every month — rent, subscriptions, loan payments. Variable expenses change — food, gas, entertainment. Cutting fixed costs has a bigger long-term impact.',
                      tag: 'Knowing the difference shows you where you actually have room to move.',
                      impl: '1. List every expense from last month. 2. Mark each F (fixed) or V (variable). 3. Total both columns. 4. To cut fixed costs: negotiate bills, cancel unused subscriptions, shop insurance annually. 5. Variable costs are easier to cut short-term but fixed cuts compound over years.',
                    },
                    {
                      key: 'pay-yourself-first', icon: '🏦', title: 'Pay Yourself First',
                      body: "Before paying any bill or buying anything, transfer a set amount to savings the moment your paycheck lands. Treat saving like a bill you owe yourself.",
                      tag: "If you wait until the end of the month to save what's left, there's never anything left.",
                      impl: "1. Decide a savings amount — even 5% of income to start. 2. Set an automatic transfer for payday, the moment money lands. 3. Transfer to a separate account you don't see daily. 4. Treat it like rent — not optional. 5. Increase by 1% every 3 months.",
                    },
                    {
                      key: 'savings-accounts', icon: '💳', title: 'Types of Savings Accounts',
                      body: 'High-yield savings accounts (HYSA) currently offer 4–5% APY, compared to 0.5% at standard savings accounts. The difference matters. $10,000 earning 4.5% vs 0.5% yields $400 more per year.',
                      tag: 'Free money — pick the right account and your savings earn while you sleep.',
                      impl: '1. Research HYSA options (Ally, Marcus, Wealthfront). 2. Open one — most have no minimum balance and no fees. 3. Link it to your checking account for easy transfers. 4. Keep your emergency fund here (3–6 months of expenses). 5. Keep regular bills and spending in your checking account.',
                    },
                    {
                      key: 'roth-ira', icon: '📈', title: 'Roth IRA vs Traditional IRA',
                      body: 'Roth IRA: You contribute after-tax dollars, they grow tax-free, and you withdraw tax-free in retirement. Traditional IRA: You contribute pre-tax (tax deduction now), they grow tax-deferred, and you pay taxes on withdrawal. 2026 contribution limit: $7,000.',
                      tag: 'If you expect to be in a higher tax bracket in retirement, Roth is usually the better choice for younger savers.',
                      impl: '1. Open a Roth IRA at a brokerage (Fidelity, Vanguard, Charles Schwab). 2. Contribute up to $7,000 per year (adjust for your income limits). 3. Invest in a low-cost index fund (S&P 500, total market, or target-date fund). 4. Set up auto-contributions if possible. 5. Don\'t withdraw early — let it compound for decades.',
                    },
                    {
                      key: '401k-basics', icon: '🎯', title: '401k Basics',
                      body: 'An employer-sponsored retirement account. Your contributions come from your paycheck pre-tax. Many employers match a percentage of what you contribute — that\'s free money. 2026 contribution limit: $23,500.',
                      tag: 'Always contribute enough to get the full employer match. It\'s an instant return on investment.',
                      impl: '1. If your employer offers a 401k, enroll immediately. 2. Set your contribution to at least match the employer contribution percentage (often 3–6%). 3. If you can afford more, increase by 1% every raise. 4. Choose an investment option — usually a target-date fund matching your retirement year. 5. After maxing the 401k match, max your Roth IRA, then increase 401k contributions.',
                    },
                    {
                      key: 'index-funds', icon: '📊', title: 'Index Funds vs Actively Managed',
                      body: 'Index funds track the whole market (e.g., S&P 500) with low fees (0.03–0.20%). Actively managed funds try to beat the market, charge higher fees (0.5–2%), and usually fail. Over 10+ years, 80–90% of active funds underperform their index.',
                      tag: 'Why pay more for a worse outcome? Index funds are boring, and that\'s the point.',
                      impl: '1. For long-term retirement accounts, choose low-cost index funds. 2. Good options: VOO (Vanguard S&P 500), VTI (Vanguard Total Stock Market), SPLG (SPDR S&P 500). 3. Avoid funds with expense ratios above 0.25%. 4. Set and forget — rebalance once a year. 5. Don\'t chase trends or try to time the market.',
                    },
                  ].map(({ key, icon, title, body, tag, impl }) => {
                    const isOpen = expandedLearnCard === title
                    return (
                      <div key={title} className={`${styles.learnCard} ${isOpen ? styles.learnCardExpanded : ''}`}>
                        <div className={styles.learnCardHeader} onClick={() => setExpandedLearnCard(isOpen ? null : title)}>
                          <span className={styles.learnCardIcon}>{icon}</span>
                          <span className={styles.learnCardTitle}>{title}</span>
                          <span className={styles.learnCardChevron}>▼</span>
                        </div>
                        {isOpen && (
                          <div className={styles.learnCardContent}>
                            <div className={styles.learnCardBody}>{body}</div>
                            <div className={styles.learnCardTag}>Why it matters: {tag}</div>
                            <div className={styles.learnCardImplement}>
                              <div className={styles.learnCardImplementTitle}>How to implement this</div>
                              <div className={styles.learnCardImplementSteps}>{impl}</div>
                              <button
                                className={styles.learnCardApplyBtn}
                                onClick={() => {
                                  setLearnReferral(key)
                                  setFinanceSub('plans')
                                  window.scrollTo({ top: 0, behavior: 'smooth' })
                                }}
                              >
                                See this applied to my budget →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── INSIGHTS ── */}
              {financeSub === 'insights' && (
                <div className={styles.insightsPlaceholder}>
                  <span style={{ fontSize: '2.5rem' }}>🤖</span>
                  <p className={styles.greetingText} style={{ fontSize: '1.15rem' }}>Financial Insights</p>
                  <p className={styles.headerSub} style={{ maxWidth: '360px', textAlign: 'center' }}>
                    {bills.length === 0
                      ? 'Add bills in the Bills tab to unlock spending insights.'
                      : monthlyIncome === 0
                        ? 'Add your income in Plans to see your full picture.'
                        : 'Your first insight is on its way...'}
                  </p>
                  <button className={styles.addTaskBtn} onClick={() => setFinanceSub(bills.length === 0 ? 'bills' : 'plans')}>
                    {bills.length === 0 ? 'Add a bill →' : 'Set up my budget →'}
                  </button>
                </div>
              )}

            </div>
          </TabErrorBoundary>
          )}

          {/* ── HABITS ── */}
          {activeTab === 'habits' && (
          <TabErrorBoundary tabName="Habits">
            {(() => {
              const todayDateStr = todayStr()

              // Habit IDs completed today (date-only comparison against completed_at)
              const completedTodayIds = new Set(
                habitCompletions
                  .filter(c => c.completed_at && c.completed_at.slice(0, 10) === todayDateStr)
                  .map(c => c.habit_id)
              )

              // Did user make a journal entry today?
              const journaledToday = journalEntries.some(
                e => e.created_at && e.created_at.slice(0, 10) === todayDateStr
              )

              // Progress bar: (habits done today + journaled today) / (total habits + 1)
              const progressNumer = completedTodayIds.size + (journaledToday ? 1 : 0)
              const progressDenom = habits.length + 1
              const progressPct = progressDenom > 0 ? Math.round((progressNumer / progressDenom) * 100) : 0

              // 7-day heat strip helpers
              const last7 = Array.from({ length: 7 }, (_, i) => {
                const d = new Date()
                d.setDate(d.getDate() - (6 - i))
                return localDateStr(d)
              })

              function getHabitHeat(habitId) {
                return last7.map(dateStr =>
                  habitCompletions.some(c => c.habit_id === habitId && c.completed_at && c.completed_at.slice(0, 10) === dateStr)
                )
              }

              function getHabitStreak(habitId) {
                let streak = 0
                for (let i = 0; i < 60; i++) {
                  const d = new Date()
                  d.setDate(d.getDate() - i)
                  const dateStr = localDateStr(d)
                  const done = habitCompletions.some(c => c.habit_id === habitId && c.completed_at && c.completed_at.slice(0, 10) === dateStr)
                  if (done) { streak++ }
                  else if (i > 0) break
                }
                return streak
              }

              const toggleHabit = async (habitId) => {
                const isCompleted = completedTodayIds.has(habitId)
                // Optimistic update
                if (isCompleted) {
                  setHabitCompletions(prev => prev.filter(c =>
                    !(c.habit_id === habitId && c.completed_at && c.completed_at.slice(0, 10) === todayDateStr)
                  ))
                } else {
                  setHabitCompletions(prev => [...prev, { habit_id: habitId, user_id: user.id, completed_at: new Date().toISOString() }])
                }
                try {
                  await loggedFetch('/api/habits/complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id, habitId, date: todayDateStr })
                  })
                } catch {
                  // Revert on error
                  if (isCompleted) {
                    setHabitCompletions(prev => [...prev, { habit_id: habitId, user_id: user.id, completed_at: new Date().toISOString() }])
                  } else {
                    setHabitCompletions(prev => prev.filter(c =>
                      !(c.habit_id === habitId && c.completed_at && c.completed_at.slice(0, 10) === todayDateStr)
                    ))
                  }
                }
              }

              const deleteHabit = async (habitId) => {
                setHabits(prev => prev.filter(h => h.id !== habitId))
                await loggedFetch(`/api/habits?userId=${user.id}&habitId=${habitId}`, { method: 'DELETE' })
              }

              const sendHabitJournal = async () => {
                if (!habitJournalText.trim()) return
                setHabitJournalSending(true)
                try {
                  const moodPrefix = habitJournalMood ? `Mood: ${habitJournalMood}\n\n` : ''
                  const res = await loggedFetch('/api/journal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      content: moodPrefix + habitJournalText.trim(),
                      conversationHistory: [],
                      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })
                  })
                  const data = await res.json()
                  if (data.message) {
                    setHabitJournalAiReply(data.message)
                    setHabitJournalText('')
                    fetchJournalEntries(user.id)
                  }
                } catch {}
                setHabitJournalSending(false)
              }

              const MOOD_EMOJIS = ['😤', '😔', '😐', '🙂', '😄']
              const PROMPT_CHIPS = ["What's on my mind", 'What went well', 'What was hard', 'What I need tomorrow']

              if (habitsLoading) return (
                <div style={{ padding: '12px 14px', paddingBottom: 80, maxWidth: 680, margin: '0 auto', overflowY: 'auto', minHeight: '100%' }}>
                  <SkeletonCard lines={2} showAvatar />
                  <SkeletonCard lines={2} showAvatar />
                </div>
              )
              if (habitsError) return (
                <div style={{ padding: '12px 14px', paddingBottom: 80, maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
                  <ErrorState message="Couldn't load your data." onRetry={() => { setHabitsError(false); fetchHabits(user.id) }} />
                </div>
              )

              return (
                <div className={styles.view}>
                  {/* Header */}
                  <div className={styles.habitsViewHeader}>
                    <h1 className={styles.greetingText} style={{ marginBottom: 0 }}>Habits</h1>
                    <button className={styles.habitsAddBtn} onClick={() => setShowAddHabitOverlay(true)}>+ Add</button>
                  </div>

                  {/* Progress bar */}
                  <div className={styles.habitsProgressWrap}>
                    <div className={styles.habitsProgressMeta}>
                      <span className={styles.habitsProgressLabel}>Today&apos;s progress</span>
                      <span className={styles.habitsProgressPct}>{progressPct}%</span>
                    </div>
                    <div className={styles.habitsProgressTrack}>
                      <div className={styles.habitsProgressFill} style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>

                  {/* Journal card */}
                  <div className={styles.habitsJournalCard}>
                    <button
                      className={styles.habitsJournalToggle}
                      onClick={() => setHabitJournalExpanded(e => !e)}
                    >
                      <div className={styles.habitsJournalLeft}>
                        <span className={styles.habitsJournalIcon}>📔</span>
                        <div>
                          <div className={styles.habitsJournalTitle}>Daily Journal</div>
                          <div className={styles.habitsJournalSub}>
                            {journaledToday ? 'Entry saved today ✓' : 'Write today\'s entry'}
                          </div>
                        </div>
                      </div>
                      <span className={styles.habitsJournalChevron} style={{ transform: habitJournalExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </button>

                    {habitJournalExpanded && (
                      <div className={styles.habitsJournalBody}>
                        {/* Mood picker */}
                        <div className={styles.habitsMoodRow}>
                          {MOOD_EMOJIS.map(emoji => (
                            <button
                              key={emoji}
                              className={`${styles.habitsMoodBtn} ${habitJournalMood === emoji ? styles.habitsMoodBtnActive : ''}`}
                              onClick={() => setHabitJournalMood(m => m === emoji ? null : emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        {/* Prompt chips — show only when textarea is empty */}
                        {!habitJournalText && (
                          <div className={styles.habitsPromptChips}>
                            {PROMPT_CHIPS.map(p => (
                              <button key={p} className={styles.habitsPromptChip} onClick={() => setHabitJournalText(p + ': ')}>
                                {p}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Textarea */}
                        <textarea
                          className={styles.habitsJournalTextarea}
                          placeholder="What's on your mind today?"
                          value={habitJournalText}
                          onChange={e => setHabitJournalText(e.target.value)}
                          rows={3}
                        />

                        {/* AI reply */}
                        {habitJournalAiReply && (
                          <div className={styles.habitsJournalAiReply}>
                            <span className={styles.habitsJournalAiLabel}>YOUR COACH</span>
                            <p>{habitJournalAiReply}</p>
                          </div>
                        )}

                        <button
                          className={styles.habitsJournalSendBtn}
                          onClick={sendHabitJournal}
                          disabled={habitJournalSending || !habitJournalText.trim()}
                        >
                          {habitJournalSending ? 'Thinking…' : 'Save entry'}
                        </button>

                        {/* Recent entries */}
                        {journalEntries.length > 0 && (
                          <div className={styles.habitsRecentEntries}>
                            <div className={styles.habitsRecentLabel}>Recent entries</div>
                            {journalEntries.slice(0, 3).map(entry => (
                              <div key={entry.id} className={styles.habitsRecentEntry}>
                                <span className={styles.habitsRecentDate}>
                                  {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                                {entry.mood && <span className={styles.habitsRecentMood}>{entry.mood}</span>}
                                <span className={styles.habitsRecentSnippet}>
                                  {(entry.content || '').slice(0, 80)}{(entry.content || '').length > 80 ? '…' : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Habits list */}
                  {habitsLoaded && habits.length === 0 ? (
                    <EmptyState
                      customIcon={<Fire size={32} weight="fill" color="#FF6644" />}
                      headline="Build your first habit"
                      subtext="Small streaks compound. Start with one."
                      ctaLabel="+ Add habit"
                      onCtaClick={() => setShowAddHabitOverlay(true)}
                    />
                  ) : (
                    <div className={styles.habitsList}>
                      {habits.map(habit => {
                        const done = completedTodayIds.has(habit.id)
                        const heat = getHabitHeat(habit.id)
                        const streak = getHabitStreak(habit.id)
                        const isBreak = habit.habit_type === 'break'
                        return (
                          <div key={habit.id} className={`${styles.habitCard} ${done ? styles.habitCardDone : ''}`}>
                            <button
                              className={`${styles.habitCheck} ${done ? styles.habitCheckDone : ''}`}
                              onClick={() => toggleHabit(habit.id)}
                              aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                            >
                              {done && '✓'}
                            </button>
                            <div className={styles.habitInfo}>
                              <div className={styles.habitNameRow}>
                                <span className={styles.habitName}>{habit.name}</span>
                                <span className={`${styles.habitTypeBadge} ${isBreak ? styles.habitTypeBadgeBreak : styles.habitTypeBadgeBuild}`}>
                                  {isBreak ? 'break' : 'build'}
                                </span>
                              </div>
                              <div className={styles.habitHeatRow}>
                                {heat.map((filled, i) => (
                                  <div key={i} className={`${styles.habitHeatDot} ${filled ? styles.habitHeatDotFilled : ''}`} />
                                ))}
                                {streak > 0 && (
                                  <span className={styles.habitStreak}>🔥 {streak}</span>
                                )}
                              </div>
                            </div>
                            <button
                              className={styles.habitDeleteBtn}
                              onClick={() => deleteHabit(habit.id)}
                              aria-label="Remove habit"
                            >×</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}
          </TabErrorBoundary>
          )}

          {/* ── TAG TEAM ── */}
          {activeTab === 'tagteam' && (
          <TabErrorBoundary tabName="Tag Team">
            <div className={styles.ttView}>
              {crewsLoading ? (
                <div style={{ padding: '12px 14px' }}>
                  <SkeletonCard lines={3} />
                  <SkeletonCard lines={2} />
                </div>
              ) : crews.length === 0 ? (
                /* ── SECTION 1: No crew ── */
                <div className={styles.ttEmpty}>
                  <div className={styles.ttEmptyIcon}>
                    <UsersThree size={36} weight="fill" color="#FF6644" />
                  </div>
                  <p className={styles.ttEmptyHeadline}>Your crew starts here</p>
                  <p className={styles.ttEmptySub}>Build with family, friends, or your team.</p>
                  <div className={styles.ttEmptyBtns}>
                    <button className={styles.ttPrimaryBtn} onClick={() => { setCrewInviteCode(null); setShowCreateCrewOverlay(true) }}>Create a crew</button>
                    <button className={styles.ttGhostBtn} onClick={() => setShowJoinCrewOverlay(true)}>Join a crew</button>
                  </div>
                </div>
              ) : (
                /* ── SECTION 3: Active crew view ── */
                (() => {
                  const crew = crews[0]
                  const CREW_TYPE_LABELS = { family: 'Family', crew: 'Crew', work: 'Work', general: 'Crew' }
                  return (
                    <div style={{ padding: '12px 14px 80px' }}>
                      {/* Header */}
                      <div className={styles.ttCrewHeader}>
                        <div>
                          <div className={styles.ttCrewName}>{crew.name}</div>
                          <span className={styles.ttCrewTypeBadge}>{CREW_TYPE_LABELS[crew.crew_type] || 'Crew'}</span>
                        </div>
                        <button
                          className={styles.ttNudgeBtn}
                          onClick={() => nudgeCrew(crew.id)}
                          disabled={nudgeSending}
                        >
                          {nudgeSent ? '✓ Sent!' : nudgeSending ? '…' : '👋 Nudge crew'}
                        </button>
                      </div>

                      {/* Invite code */}
                      <div className={styles.ttInviteBlock}>
                        <span className={styles.ttInviteLabel}>Invite code</span>
                        <div className={styles.ttInviteRow}>
                          <span className={styles.ttInviteCode}>{crew.invite_code}</span>
                          <button
                            className={styles.ttCopyBtn}
                            onClick={() => {
                              try { navigator.clipboard.writeText(crew.invite_code) } catch {}
                              setCodeCopied(true)
                              setTimeout(() => setCodeCopied(false), 2000)
                            }}
                          >{codeCopied ? 'Copied!' : 'Copy'}</button>
                        </div>
                      </div>

                      {/* Member list */}
                      <div className={styles.ttSection}>
                        <div className={styles.ttSectionLabel}>Members · {crew.members?.length || 0}</div>
                        <div className={styles.ttMemberList}>
                          {(crew.members || []).map(m => (
                            <div key={m.user_id} className={styles.ttMember}>
                              <div className={styles.ttAvatar}>
                                {(m.full_name || '?')[0].toUpperCase()}
                              </div>
                              <span className={styles.ttMemberName}>{m.full_name || 'Member'}</span>
                              {m.role === 'owner' && <span className={styles.ttOwnerBadge}>owner</span>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Activity feed */}
                      {crew.activity && crew.activity.length > 0 && (
                        <div className={styles.ttSection}>
                          <div className={styles.ttSectionLabel}>Activity</div>
                          <div className={styles.ttActivityFeed}>
                            {crew.activity.map(entry => (
                              <div key={entry.id} className={styles.ttActivityItem}>
                                <span className={styles.ttActivityText}>{entry.text}</span>
                                <span className={styles.ttActivityTime}>
                                  {new Date(entry.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Join another crew */}
                      <button className={styles.ttGhostBtn} style={{ marginTop: 20 }} onClick={() => setShowJoinCrewOverlay(true)}>Join another crew</button>
                    </div>
                  )
                })()
              )}
            </div>
          </TabErrorBoundary>
          )}

        </main>

        {/* ── TAG TEAM: Create Crew Overlay ── */}
        {showCreateCrewOverlay && (
          <div className={styles.ttOverlayBackdrop} onClick={() => { if (!crewInviteCode) setShowCreateCrewOverlay(false) }}>
            <div className={styles.ttOverlayCard} onClick={e => e.stopPropagation()}>
              {crewInviteCode ? (
                <>
                  <p className={styles.ttOverlayTitle}>Crew created!</p>
                  <p className={styles.ttOverlaySub}>Share this code with your crew.</p>
                  <div className={styles.ttInviteBlock} style={{ marginTop: 16 }}>
                    <span className={styles.ttInviteLabel}>Invite code</span>
                    <div className={styles.ttInviteRow}>
                      <span className={styles.ttInviteCode}>{crewInviteCode}</span>
                      <button
                        className={styles.ttCopyBtn}
                        onClick={() => {
                          try { navigator.clipboard.writeText(crewInviteCode) } catch {}
                          setCodeCopied(true)
                          setTimeout(() => setCodeCopied(false), 2000)
                        }}
                      >{codeCopied ? 'Copied!' : 'Copy'}</button>
                    </div>
                  </div>
                  <button className={styles.ttPrimaryBtn} style={{ marginTop: 20, width: '100%' }} onClick={() => { setShowCreateCrewOverlay(false); setCrewInviteCode(null) }}>Done</button>
                </>
              ) : (
                <>
                  <p className={styles.ttOverlayTitle}>Create a crew</p>
                  <form onSubmit={createCrew} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <input
                      className={styles.ttInput}
                      type="text"
                      placeholder="Crew name"
                      value={newCrewName}
                      onChange={e => setNewCrewName(e.target.value)}
                      maxLength={40}
                      autoFocus
                    />
                    <div className={styles.ttTypePills}>
                      {['family', 'crew', 'work'].map(t => (
                        <button
                          key={t}
                          type="button"
                          className={newCrewType === t ? styles.ttTypePillActive : styles.ttTypePill}
                          onClick={() => setNewCrewType(t)}
                        >{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                      ))}
                    </div>
                    <button
                      type="submit"
                      className={styles.ttPrimaryBtn}
                      disabled={!newCrewName.trim() || creatingCrew}
                      style={{ width: '100%', opacity: (!newCrewName.trim() || creatingCrew) ? 0.5 : 1 }}
                    >{creatingCrew ? 'Creating…' : 'Create'}</button>
                    <button type="button" className={styles.ttGhostBtn} style={{ width: '100%' }} onClick={() => setShowCreateCrewOverlay(false)}>Cancel</button>
                  </form>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TAG TEAM: Join Crew Overlay ── */}
        {showJoinCrewOverlay && (
          <div className={styles.ttOverlayBackdrop} onClick={() => setShowJoinCrewOverlay(false)}>
            <div className={styles.ttOverlayCard} onClick={e => e.stopPropagation()}>
              <p className={styles.ttOverlayTitle}>Join a crew</p>
              <p className={styles.ttOverlaySub}>Enter the invite code from your crew.</p>
              <form onSubmit={joinCrew} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
                <input
                  className={styles.ttInput}
                  type="text"
                  placeholder="Invite code"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={12}
                  autoFocus
                />
                <button
                  type="submit"
                  className={styles.ttPrimaryBtn}
                  disabled={!joinCode.trim() || joiningCrew}
                  style={{ width: '100%', opacity: (!joinCode.trim() || joiningCrew) ? 0.5 : 1 }}
                >{joiningCrew ? 'Joining…' : 'Join crew'}</button>
                <button type="button" className={styles.ttGhostBtn} style={{ width: '100%' }} onClick={() => setShowJoinCrewOverlay(false)}>Cancel</button>
              </form>
            </div>
          </div>
        )}

        {/* VOICE FAB */}
        {activeTab === 'tasks' && !showAddModal && !addingTaskOverlay && (
          <button
            className={`${styles.voiceFab} ${voiceFabState === 'recording' ? styles.voiceFabRecording : ''} ${voiceFabState === 'processing' ? styles.voiceFabProcessing : ''}`}
            onClick={handleVoiceFabClick}
            aria-label={voiceFabState === 'idle' ? 'Voice input' : voiceFabState === 'recording' ? 'Stop recording' : 'Processing'}
          >
            {voiceFabState === 'recording' ? (
              <div className={styles.voiceWaveBars}>
                <span className={styles.voiceWaveBar} />
                <span className={styles.voiceWaveBar} />
                <span className={styles.voiceWaveBar} />
              </div>
            ) : voiceFabState === 'processing' ? (
              <div className={styles.voiceFabSpinner} />
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="9" y="2" width="6" height="12" rx="3" fill="white"/>
                <path d="M5 11a7 7 0 0 0 14 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                <line x1="9" y1="22" x2="15" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        )}

        {/* TOAST CONTAINER */}
        <ToastContainer />

        {/* BOTTOM NAV (mobile) */}
        <nav className={styles.bottomNav} aria-hidden="true">
          {NAV_ITEMS.filter(i => NAV_PRIMARY_IDS.includes(i.id)).map(item => (
            <button key={item.id} onClick={() => switchTab(item.id)}
              className={`${styles.bottomNavItem} ${activeTab === item.id ? styles.bottomNavItemActive : ''}`}>
              <span className={styles.bottomNavIcon}>{item.icon}</span>
              <span className={styles.bottomNavLabel}>{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setShowMoreDrawer(true)}
            className={`${styles.bottomNavItem} ${NAV_MORE_IDS.includes(activeTab) ? styles.bottomNavItemActive : ''}`}>
            <span className={styles.bottomNavIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
              </svg>
            </span>
            <span className={styles.bottomNavLabel}>More</span>
          </button>
        </nav>

        {/* MORE DRAWER (mobile) */}
        {showMoreDrawer && (
          <div className={styles.moreDrawerOverlay} onClick={() => setShowMoreDrawer(false)}>
            <div className={styles.moreDrawer} onClick={e => e.stopPropagation()}>
              <div className={styles.moreDrawerHandle} />
              {NAV_ITEMS.filter(i => NAV_MORE_IDS.includes(i.id)).map(item => (
                <button key={item.id} onClick={() => switchTab(item.id)}
                  className={`${styles.moreDrawerItem} ${activeTab === item.id ? styles.moreDrawerItemActive : ''}`}>
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
              <button onClick={() => switchTab('settings')}
                className={`${styles.moreDrawerItem} ${activeTab === 'settings' ? styles.moreDrawerItemActive : ''}`}>
                <span className={styles.navIcon}>
                  <Gear size={22} />
                </span>
                <span>Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* ADD TASK MODAL — S17 */}
        {showAddModal && (
          <div className={styles.s17OverlayBg} onClick={e => e.target === e.currentTarget && (setShowAddModal(false), resetForm(), setAddMode('single'), setBulkPreview([]), setBulkText(''), setNewTaskDates([]), setNewTaskType('task'), setTaskTimeEnabled(false))}>
            <div className={styles.s17OverlaySheet}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>New task</h2>
                <button onClick={() => { setShowAddModal(false); resetForm(); setAddMode('single'); setBulkPreview([]); setBulkText(''); setNewTaskDates([]); setNewTaskType('task'); setTaskTimeEnabled(false) }} className={styles.modalClose}>×</button>
              </div>

              {/* Mode tabs: Single | Bulk | Voice */}
              <div className={styles.s17ModeTabs}>
                {[['single','Single'],['bulk','Bulk'],['voice','Voice']].map(([mode, label]) => (
                  <button key={mode} type="button"
                    className={`${styles.s17ModeTab} ${addMode === mode ? styles.s17ModeTabActive : ''}`}
                    onClick={() => setAddMode(mode)}>
                    {label}
                  </button>
                ))}
              </div>

              {/* ─ Single mode ─ */}
              {addMode === 'single' && (
                <form onSubmit={addTaskFromOverlay} className={styles.modalForm}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>What needs to get done?</label>
                    <input ref={titleInputRef} type="text" placeholder="e.g. Call the insurance company"
                      value={newTitle} onChange={e => { setNewTitle(e.target.value); if (titleInputError) setTitleInputError(false) }}
                      className={`${styles.fieldInput} ${titleInputError ? styles.titleInputError : ''}`} />
                  </div>

                  {/* Task type selector */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Type</label>
                    <div className={styles.toggleRow}>
                      {[['task','Task'],['bill','Bill'],['appointment','Appt'],['chore','Chore']].map(([val,lbl]) => (
                        <button key={val} type="button"
                          onClick={() => setNewTaskType(val)}
                          className={`${styles.toggleBtn} ${newTaskType === val ? styles.toggleBtnActive : ''}`}>{lbl}</button>
                      ))}
                    </div>
                    {(newTaskType === 'bill') && <p className={styles.fieldHint}>Will also appear in Finance.</p>}
                    {(newTaskType === 'appointment') && <p className={styles.fieldHint}>Gets calendar icon treatment.</p>}
                  </div>

                  {/* Multi-day calendar */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>
                      Date{newTaskDates.length > 1 ? `s — ${newTaskDates.length} selected` : ''}
                      {newTaskDates.length > 0 && <button type="button" onClick={() => setNewTaskDates([])} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'rgba(240,234,214,0.4)', fontSize: 12, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>clear</button>}
                    </label>
                    <div className={styles.quickRow}>
                      <button type="button" onClick={() => toggleCalDate(todayStr())}
                        className={`${styles.quickBtn} ${newTaskDates.includes(todayStr()) ? styles.quickBtnActive : ''}`}>Today</button>
                      <button type="button" onClick={() => toggleCalDate(tomorrowStr())}
                        className={`${styles.quickBtn} ${newTaskDates.includes(tomorrowStr()) ? styles.quickBtnActive : ''}`}>Tomorrow</button>
                    </div>
                    {/* Mini calendar */}
                    <div className={styles.s17CalendarWrap}>
                      <div className={styles.s17CalHeader}>
                        <button type="button" onClick={() => setCalPickerMonth(d => new Date(d.getFullYear(), d.getMonth()-1, 1))} className={styles.s17CalNav}>‹</button>
                        <span style={{ fontSize: 13, color: 'rgba(240,234,214,0.7)', fontFamily: "'Figtree', sans-serif", fontWeight: 600 }}>
                          {calPickerMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </span>
                        <button type="button" onClick={() => setCalPickerMonth(d => new Date(d.getFullYear(), d.getMonth()+1, 1))} className={styles.s17CalNav}>›</button>
                      </div>
                      <div className={styles.s17CalGrid}>
                        {['S','M','T','W','T','F','S'].map((d,i) => (
                          <div key={i} style={{ textAlign:'center', fontSize: 10, color: 'rgba(240,234,214,0.3)', fontFamily: "'Sora', sans-serif", padding: '2px 0' }}>{d}</div>
                        ))}
                        {(() => {
                          const year = calPickerMonth.getFullYear()
                          const month = calPickerMonth.getMonth()
                          const firstDay = new Date(year, month, 1).getDay()
                          const daysInMonth = new Date(year, month+1, 0).getDate()
                          const cells = []
                          for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />)
                          for (let d = 1; d <= daysInMonth; d++) {
                            const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                            const sel = newTaskDates.includes(ds)
                            const isToday = ds === todayStr()
                            cells.push(
                              <button key={ds} type="button"
                                onClick={() => toggleCalDate(ds)}
                                className={`${styles.s17CalDay} ${sel ? styles.s17CalDaySelected : ''} ${isToday ? styles.s17CalDayToday : ''}`}>
                                {d}
                              </button>
                            )
                          }
                          return cells
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Custom time picker */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>
                      Time
                      <button type="button"
                        onClick={() => setTaskTimeEnabled(v => !v)}
                        style={{ marginLeft: 10, background: 'none', border: 'none', color: taskTimeEnabled ? '#FF6644' : 'rgba(240,234,214,0.35)', fontSize: 12, cursor: 'pointer', fontFamily: "'Figtree', sans-serif" }}>
                        {taskTimeEnabled ? '✓ set' : '+ set time'}
                      </button>
                    </label>
                    {taskTimeEnabled && (
                      <div className={styles.s17TimePicker}>
                        <div className={styles.s17TimeCol}>
                          {Array.from({length: 12}, (_,i) => i+1).concat([0]).map(h => (
                            <button key={h} type="button"
                              className={`${styles.s17TimeCell} ${taskTimeHour === h ? styles.s17TimeCellActive : ''}`}
                              onClick={() => setTaskTimeHour(h)}>
                              {h === 0 ? '12' : String(h).padStart(2,'0')}
                            </button>
                          ))}
                        </div>
                        <span style={{ color: 'rgba(240,234,214,0.3)', fontSize: 18, padding: '0 4px', alignSelf: 'center' }}>:</span>
                        <div className={styles.s17TimeCol}>
                          {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => (
                            <button key={m} type="button"
                              className={`${styles.s17TimeCell} ${taskTimeMinute === m ? styles.s17TimeCellActive : ''}`}
                              onClick={() => setTaskTimeMinute(m)}>
                              {String(m).padStart(2,'0')}
                            </button>
                          ))}
                        </div>
                        <div className={styles.s17TimeCol}>
                          {[['AM', taskTimeHour < 12], ['PM', taskTimeHour >= 12]].map(([label, active]) => (
                            <button key={label} type="button"
                              className={`${styles.s17TimeCell} ${active ? styles.s17TimeCellActive : ''}`}
                              onClick={() => {
                                if (label === 'AM' && taskTimeHour >= 12) setTaskTimeHour(h => h - 12)
                                if (label === 'PM' && taskTimeHour < 12) setTaskTimeHour(h => h + 12)
                              }}>
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Estimated time */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Estimated time <span className={styles.fieldLabelOptional}>(minutes, optional)</span></label>
                    <div className={styles.quickRow}>
                      {[15,30,60,90].map(m => (
                        <button key={m} type="button"
                          onClick={() => setTaskEstimated(taskEstimated === String(m) ? '' : String(m))}
                          className={`${styles.quickBtn} ${taskEstimated === String(m) ? styles.quickBtnActive : ''}`}>{m}m</button>
                      ))}
                      <input type="number" placeholder="custom" min="1" max="480"
                        value={taskEstimated}
                        onChange={e => setTaskEstimated(e.target.value)}
                        className={styles.fieldInputCompact}
                        style={{ width: 72 }} />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Notes <span className={styles.fieldLabelOptional}>(optional)</span></label>
                    <input type="text" placeholder="Context that makes this easier to start"
                      value={newNotes} onChange={e => setNewNotes(e.target.value)} className={styles.fieldInput} />
                  </div>

                  <button type="submit" disabled={addingTaskOverlay || !newTitle.trim()} className={styles.s17SubmitBtn}>
                    {addingTaskOverlay ? 'Adding…' : newTaskDates.length > 1 ? `Add ${newTaskDates.length} tasks` : 'Add task'}
                  </button>
                </form>
              )}

              {/* ─ Bulk mode ─ */}
              {addMode === 'bulk' && (
                <div className={styles.modalForm}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>One task per line</label>
                    <textarea
                      className={styles.bulkTextarea}
                      placeholder={"Call the insurance company\nPay electric bill by Friday\nSchedule dentist appointment"}
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                    />
                  </div>
                  <div className={styles.bulkActionRow}>
                    <button type="button" onClick={() => navigator.clipboard.readText().then(t => setBulkText(prev => prev ? prev + '\n' + t : t)).catch(() => {})} className={styles.bulkActionBtn}>
                      Paste
                    </button>
                    <button type="button" onClick={parseBulkTasks} disabled={bulkParsing || !bulkText.trim()} className={styles.bulkParseBtn}>
                      {bulkParsing ? 'Parsing...' : 'Parse →'}
                    </button>
                  </div>
                  {bulkPreview.length > 0 && (
                    <>
                      <div className={styles.fieldGroup} style={{ marginTop: 16 }}>
                        <label className={styles.fieldLabel}>Preview — {bulkPreview.length} tasks</label>
                        <div className={styles.bulkPreviewList}>
                          {bulkPreview.map((t, i) => (
                            <div key={t._id} className={styles.bulkPreviewItem}>
                              <input className={styles.bulkPreviewInput} value={t.title}
                                onChange={e => setBulkPreview(prev => prev.map((x, xi) => xi === i ? { ...x, title: e.target.value } : x))} />
                              <button type="button" onClick={() => setBulkPreview(prev => prev.filter((_, xi) => xi !== i))} className={styles.bulkPreviewRemove}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={addAllBulkTasks} className={styles.s17SubmitBtn}>
                        Add {bulkPreview.length} tasks
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ─ Voice mode ─ */}
              {addMode === 'voice' && (
                <div className={styles.modalForm}>
                  {(listening || parsing || voiceTranscript) && (
                    <div className={styles.voiceState}>
                      {listening && (
                        <div className={styles.voiceListening}>
                          <span className={styles.voiceDot} /><span className={styles.voiceDot} /><span className={styles.voiceDot} />
                          <span className={styles.voiceListeningText}>Listening...</span>
                        </div>
                      )}
                      {parsing && <div className={styles.voiceParsing}>Parsing your task...</div>}
                      {voiceTranscript && !listening && !parsing && <div className={styles.voiceTranscript}>"{voiceTranscript}"</div>}
                    </div>
                  )}
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <button type="button"
                      onClick={listening ? stopListening : startListening}
                      className={`${styles.s17VoiceFab} ${listening ? styles.micBtnActive : ''}`}>
                      {listening ? (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                      ) : (
                        <Microphone size={28} />
                      )}
                    </button>
                    <p style={{ fontSize: 13, color: 'rgba(240,234,214,0.4)', marginTop: 12, fontFamily: "'Figtree', sans-serif" }}>
                      {listening ? 'Tap to stop' : 'Tap to speak your task'}
                    </p>
                  </div>
                  {newTitle && (
                    <form onSubmit={addTaskFromOverlay} className={styles.modalForm}>
                      <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Parsed task</label>
                        <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} className={styles.fieldInput} />
                      </div>
                      <button type="submit" disabled={addingTaskOverlay} className={styles.s17SubmitBtn}>
                        {addingTaskOverlay ? 'Adding…' : 'Add task'}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ADD HABIT OVERLAY */}
        {showAddHabitOverlay && (
          <div className={styles.habitsOverlayBg} onClick={e => e.target === e.currentTarget && setShowAddHabitOverlay(false)}>
            <div className={styles.habitsOverlaySheet}>
              <div className={styles.habitsOverlayHeader}>
                <span className={styles.habitsOverlayTitle}>New Habit</span>
                <button className={styles.habitsOverlayClose} onClick={() => setShowAddHabitOverlay(false)}>×</button>
              </div>
              <div className={styles.habitsOverlayBody}>
                <div className={styles.habitsField}>
                  <label className={styles.habitsFieldLabel}>Habit name</label>
                  <input
                    className={styles.habitsFieldInput}
                    placeholder="e.g. Drink 8 glasses of water"
                    value={newHabitName}
                    onChange={e => setNewHabitName(e.target.value)}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && newHabitName.trim() && !addingHabit) {
                        setAddingHabit(true)
                        try {
                          const res = await loggedFetch('/api/habits', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: user.id, name: newHabitName.trim(), habit_type: newHabitType })
                          })
                          const data = await res.json()
                          if (data.habit) {
                            setHabits(prev => [...prev, data.habit])
                            setNewHabitName('')
                            setNewHabitType('build')
                            setShowAddHabitOverlay(false)
                          }
                        } catch {}
                        setAddingHabit(false)
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className={styles.habitsField}>
                  <label className={styles.habitsFieldLabel}>Type</label>
                  <div className={styles.habitsTypeRow}>
                    <button
                      className={`${styles.habitsTypeBtn} ${newHabitType === 'build' ? styles.habitsTypeBtnBuildActive : ''}`}
                      onClick={() => setNewHabitType('build')}
                    >🌱 Build</button>
                    <button
                      className={`${styles.habitsTypeBtn} ${newHabitType === 'break' ? styles.habitsTypeBtnBreakActive : ''}`}
                      onClick={() => setNewHabitType('break')}
                    >⛔ Break</button>
                  </div>
                </div>
                <button
                  className={styles.habitsOverlaySubmit}
                  disabled={addingHabit || !newHabitName.trim()}
                  onClick={async () => {
                    if (!newHabitName.trim() || addingHabit) return
                    setAddingHabit(true)
                    try {
                      const res = await loggedFetch('/api/habits', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userId: user.id, name: newHabitName.trim(), habit_type: newHabitType })
                      })
                      const data = await res.json()
                      if (data.habit) {
                        setHabits(prev => [...prev, data.habit])
                        setNewHabitName('')
                        setNewHabitType('build')
                        setShowAddHabitOverlay(false)
                      }
                    } catch {}
                    setAddingHabit(false)
                  }}
                >
                  {addingHabit ? 'Adding…' : 'Add habit'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                        {f === 'bimonthly' ? 'Bimonthly' : f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Due day of month <span className={styles.fieldLabelOptional}>(optional)</span></label>
                  <input type="number" placeholder="e.g. 15" min="1" max="31"
                    value={newBillDueDay} onChange={e => setNewBillDueDay(e.target.value)}
                    className={styles.fieldInput} />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Category</label>
                  <div className={styles.quickRow} style={{ flexWrap: 'wrap' }}>
                    {BILL_CATEGORIES.map(cat => (
                      <button key={cat} type="button" onClick={() => setNewBillCategory(cat)}
                        className={`${styles.quickBtn} ${newBillCategory === cat ? styles.quickBtnActive : ''}`}>
                        {cat}
                      </button>
                    ))}
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
                <button type="submit" disabled={addingBill || !newBillName.trim() || !newBillAmount} className={styles.modalSubmit}>
                  {addingBill ? 'Adding...' : 'Add bill'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TOAST */}
        {toast && <div className={styles.toast}>{toast}</div>}

        {/* SESSION END MODAL */}
        {showSessionEndModal && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowSessionEndModal(false)}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2 className={styles.detailTitle}>{sessionEndType === 'complete' ? 'Session complete' : 'Session ended'}</h2>
                <button onClick={() => setShowSessionEndModal(false)} className={styles.modalClose}>×</button>
              </div>
              <div className={styles.sessionEndBody}>
                {topTask && <p className={styles.sessionEndTask}>{topTask.title}</p>}
                <p className={styles.sessionEndPrompt}>How'd it go?</p>
                <div className={styles.focusResultBtns}>
                  <button onClick={() => handleFocusResult('complete')} className={styles.focusResultBtn}>✓ Nailed it</button>
                  <button onClick={() => handleFocusResult('progress')} className={`${styles.focusResultBtn} ${styles.focusResultBtnSecondary}`}>▶ Made progress</button>
                  <button onClick={() => { setShowSessionEndModal(false); setStuckTask(topTask); setStuckConfirmRemove(false); setShowStuckModal(true) }} className={`${styles.focusResultBtn} ${styles.focusResultBtnSecondary}`}>🧱 Got stuck</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STUCK RESOLUTION MODAL */}
        {showStuckModal && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && (setShowStuckModal(false), setStuckConfirmRemove(false))}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2 className={styles.detailTitle}>What do you want to do with this?</h2>
                <button onClick={() => { setShowStuckModal(false); setStuckConfirmRemove(false) }} className={styles.modalClose}>×</button>
              </div>
              {stuckTask && <p className={styles.sessionEndTask}>{stuckTask.title}</p>}
              <p className={styles.sessionEndPrompt} style={{ marginBottom: '20px' }}>No judgment — let's figure out the next step.</p>
              {stuckConfirmRemove ? (
                <div>
                  <p style={{ fontSize: '0.92rem', color: 'rgba(240,234,214,0.6)', marginBottom: '18px', lineHeight: 1.5 }}>
                    Are you sure? This will remove <strong style={{ color: 'var(--text-color, #f0ead6)' }}>{stuckTask?.title}</strong> from your list.
                  </p>
                  <div className={styles.focusResultBtns}>
                    <button onClick={async () => { if (stuckTask) { await archiveTask(stuckTask) } setShowStuckModal(false); setStuckConfirmRemove(false) }} className={styles.focusResultBtn}>Yes, remove it</button>
                    <button onClick={() => setStuckConfirmRemove(false)} className={`${styles.focusResultBtn} ${styles.focusResultBtnSecondary}`}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className={styles.focusResultBtns} style={{ flexDirection: 'column' }}>
                  <button onClick={() => { if (stuckTask) { setDetailTask(stuckTask); openDetailEdit() } setShowStuckModal(false) }} className={styles.focusResultBtn}>
                    📅 Reschedule it
                  </button>
                  <button onClick={() => setStuckConfirmRemove(true)} className={`${styles.focusResultBtn} ${styles.focusResultBtnSecondary}`}>
                    🗑 Remove it
                  </button>
                  <button onClick={() => { setShowStuckModal(false); setStuckConfirmRemove(false) }} className={`${styles.focusResultBtn} ${styles.focusResultBtnSecondary}`}>
                    ✓ Keep it on my list
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TASK DETAIL MODAL */}
        {detailTask && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && (setDetailTask(null), setDetailEditing(false))}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                {detailEditing ? (
                  <input className={styles.detailEditTitleInput} value={detailEditTitle}
                    onChange={e => setDetailEditTitle(e.target.value)} autoFocus />
                ) : (
                  <h2 className={styles.detailTitle}>{detailTask.title}</h2>
                )}
                <div className={styles.modalHeaderRight}>
                  {!detailEditing && (
                    <button onClick={openDetailEdit} className={styles.detailEditBtn}>Edit</button>
                  )}
                  <button onClick={() => { setDetailTask(null); setDetailEditing(false) }} className={styles.modalClose}>×</button>
                </div>
              </div>

              {detailEditing ? (
                <div className={styles.detailEditForm}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Due date</label>
                    <div className={styles.quickRow}>
                      <button type="button" onClick={() => setDetailEditDueDate(todayStr())}
                        className={`${styles.quickBtn} ${detailEditDueDate === todayStr() ? styles.quickBtnActive : ''}`}>Today</button>
                      <button type="button" onClick={() => setDetailEditDueDate(tomorrowStr())}
                        className={`${styles.quickBtn} ${detailEditDueDate === tomorrowStr() ? styles.quickBtnActive : ''}`}>Tomorrow</button>
                      <input type="date" value={detailEditDueDate} onChange={e => setDetailEditDueDate(e.target.value)} className={styles.fieldInputCompact} />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Due time</label>
                    <div className={styles.quickRow}>
                      {[['Morning', '09:00'], ['Afternoon', '14:00'], ['Evening', '18:00']].map(([label, val]) => (
                        <button key={val} type="button"
                          onClick={() => { setDetailEditDueTime(val); if (!detailEditDueDate) setDetailEditDueDate(todayStr()) }}
                          className={`${styles.quickBtn} ${detailEditDueTime === val ? styles.quickBtnActive : ''}`}>{label}</button>
                      ))}
                      <span className={styles.orLabel}>or</span>
                      <input type="time" value={detailEditDueTime} onChange={e => { setDetailEditDueTime(e.target.value); if (!detailEditDueDate) setDetailEditDueDate(todayStr()) }}
                        className={styles.fieldInputCompact} />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Type</label>
                    <div className={styles.toggleRow}>
                      <button type="button" onClick={() => setDetailEditConsequence('self')}
                        className={`${styles.toggleBtn} ${detailEditConsequence === 'self' ? styles.toggleBtnActive : ''}`}>Personal</button>
                      <button type="button" onClick={() => setDetailEditConsequence('external')}
                        className={`${styles.toggleBtn} ${detailEditConsequence === 'external' ? styles.toggleBtnActive : ''}`}>External commitment</button>
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Repeat</label>
                    <div className={styles.toggleRow}>
                      {RECURRENCE_OPTIONS.map(opt => (
                        <button key={opt.value} type="button" onClick={() => setDetailEditRecurrence(opt.value)}
                          className={`${styles.toggleBtn} ${detailEditRecurrence === opt.value ? styles.toggleBtnActive : ''}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Notes</label>
                    <input type="text" placeholder="Context or notes..." value={detailEditNotes}
                      onChange={e => setDetailEditNotes(e.target.value)} className={styles.fieldInput} />
                  </div>
                </div>
              ) : (
                <div className={styles.detailBody}>
                  {(detailTask.due_time || detailTask.due_date) && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Due</span>
                      <span className={styles.detailValue}>
                        {detailTask.due_time
                          ? `${new Date(detailTask.due_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${new Date(detailTask.due_time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                          : detailTask.due_date}
                      </span>
                    </div>
                  )}
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Type</span>
                    <span className={`${styles.detailValue} ${detailTask.consequence_level === 'external' ? styles.detailValueExt : ''}`}>
                      {detailTask.consequence_level === 'external' ? 'External commitment' : 'Personal'}
                    </span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Repeats</span>
                    <span className={styles.detailValue}>
                      {detailTask.recurrence === 'daily' ? 'Daily' : detailTask.recurrence === 'weekly' ? 'Weekly' : 'Once'}
                    </span>
                  </div>
                  {detailTask.rollover_count > 0 && (
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Rolled over</span>
                      <span className={styles.detailValue}>{detailTask.rollover_count}×</span>
                    </div>
                  )}
                  <div className={styles.detailNotesBlock}>
                    <span className={styles.detailLabel}>Notes</span>
                    {(detailNoteEditing || !detailTask.notes) ? (
                      <div className={styles.detailNoteEditRow}>
                        <input type="text" className={styles.detailNoteInput} placeholder="Add a note..."
                          value={detailNoteEdit} onChange={e => setDetailNoteEdit(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveDetailNote()} autoFocus={detailNoteEditing} />
                        <button className={styles.detailNoteSaveBtn} onClick={saveDetailNote}>Save</button>
                      </div>
                    ) : (
                      <p className={styles.detailNotesText} onClick={() => setDetailNoteEditing(true)} style={{ cursor: 'pointer' }} title="Click to edit">
                        {detailTask.notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.detailActions}>
                {detailEditing ? (
                  <>
                    <button className={styles.detailBtnPrimary} onClick={saveDetailEdit} disabled={detailSaving || !detailEditTitle.trim()}>
                      {detailSaving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button className={styles.detailBtnSecondary} onClick={() => setDetailEditing(false)}>Cancel</button>
                  </>
                ) : (
                  <>
                    {detailTask.completed ? (
                      <button className={styles.detailBtnSecondary} onClick={() => { uncompleteTask(detailTask); setDetailTask(null) }}>Mark incomplete</button>
                    ) : (
                      <button className={styles.detailBtnPrimary} onClick={() => { completeTask(detailTask); setDetailTask(null) }}>Mark complete</button>
                    )}
                    <button className={styles.detailBtnSecondary} onClick={() => { rescheduleTask(detailTask); setDetailTask(null) }}>Push to tomorrow</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ALARM BANNER */}
        {activeAlarmBanner && (
          <div className={styles.alarmBanner}>
            <span className={styles.alarmBannerIcon}>⏰</span>
            <div className={styles.alarmBannerContent}>
              <span className={styles.alarmBannerTitle}>{activeAlarmBanner.title}</span>
            </div>
            <button onClick={() => setActiveAlarmBanner(null)} className={styles.alarmBannerDismiss}>Dismiss</button>
          </div>
        )}

        {/* ALARMS MODAL */}
        {showAlarmsModal && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowAlarmsModal(false)}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Alarms</h2>
                <button onClick={() => setShowAlarmsModal(false)} className={styles.modalClose}>×</button>
              </div>
              {alarms.filter(a => !a.triggered).length === 0 && (
                <p style={{ fontSize: '0.88rem', color: 'rgba(240,234,214,0.35)', marginBottom: '20px' }}>No active alarms.</p>
              )}
              {alarms.filter(a => !a.triggered).map(alarm => (
                <div key={alarm.id} className={styles.alarmRow}>
                  <div>
                    <p className={styles.alarmRowTitle}>{alarm.title}</p>
                    <p className={styles.alarmRowTime}>{new Date(alarm.alarm_time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                  <button onClick={() => deleteAlarm(alarm.id)} className={styles.taskActionDelete}>×</button>
                </div>
              ))}
              <form onSubmit={addAlarm} className={styles.modalForm} style={{ marginTop: '16px' }}>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Title</label>
                  <input type="text" placeholder="Reminder title" value={newAlarmTitle} onChange={e => setNewAlarmTitle(e.target.value)} className={styles.fieldInput} required />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Time</label>
                  <input type="datetime-local" value={newAlarmTime} onChange={e => setNewAlarmTime(e.target.value)} className={styles.fieldInput} required />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.fieldLabel}>Repeat</label>
                  <div className={styles.toggleRow}>
                    {['once','daily','weekly'].map(r => (
                      <button key={r} type="button" onClick={() => setNewAlarmRepeat(r)}
                        className={`${styles.toggleBtn} ${newAlarmRepeat === r ? styles.toggleBtnActive : ''}`}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="submit" disabled={addingAlarm || !newAlarmTitle.trim() || !newAlarmTime} className={styles.modalSubmit}>
                  {addingAlarm ? 'Adding...' : 'Add alarm'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* GUIDE MODAL (disabled when Guide tab active) */}
        {showGuideModal && activeTab !== 'guide' && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowGuideModal(false)}>
            <div className={styles.modal} style={{ maxWidth: '640px' }}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Cinis Guide</h2>
                <button onClick={() => setShowGuideModal(false)} className={styles.modalClose}>×</button>
              </div>
              <div className={styles.guideContent}>
                {[
                  { title: 'What is Cinis?', body: "Cinis is a personal productivity coach that works like a smart friend, not a corporate app. It knows your tasks, understands how you work, and checks in with you to keep things moving — morning, midday, and evening.\n\nIt's built for people who struggle with task initiation, time blindness, or just need accountability that doesn't feel like a burden." },
                  { title: 'The Check-in', body: "Three times a day, Cinis reaches out — morning to set your priority, midday to check on progress, evening to wrap up. Each check-in is a real conversation. Tell it what happened, what's blocked, or what moved. It adjusts your task list automatically." },
                  { title: 'Your Task Deck', body: 'Tasks are ranked by priority score — external commitments, overdue items, and rolled-over tasks rise to the top. You can drag to reorder. Add tasks by typing or by speaking (tap the mic). Voice input understands natural language like "dentist appointment Friday at 3pm".' },
                  { title: 'Focus Sessions', body: 'The Focus tab starts a countdown timer for your top task — 15, 25, or 45 minutes. When it ends, you report how it went. "Nailed it" marks the task complete. "Made progress" keeps it active. "Got stuck" routes you to a coaching response from Cinis.' },
                  { title: 'The Journal', body: 'Journal is a private space to think out loud. The AI listens, reflects back what it notices, and asks one good question. If you mention something that sounds like a task, it offers to add it. Your past entries are saved below each session.' },
                  { title: 'Your Persona', body: 'Cinis has 6 coaching styles: Drill Sergeant (blunt, direct), Coach (warm, strategic), Thinking Partner (asks questions), Hype Person (celebrates every win), Strategist (systems and logic), and The Empath (emotionally attuned, meets you where you are). Mix up to 3 — your first choice is dominant.' },
                  { title: 'Finance Tracker', body: 'Track your recurring bills, see your monthly burn rate, and get a breakdown by category. Voice input understands "Netflix $15 on the 5th of every month". Bill due dates show as teal dots on the calendar.' },
                  { title: 'Coming Soon', body: '• SMS check-ins — daily texts without opening the app\n• Wearable integrations — Fitbit and Oura readiness scores in your check-in\n• Calendar sync — two-way Google Calendar integration\n• Spotify / Apple Music — curated focus playlists in the Focus tab' },
                ].map(({ title, body }) => (
                  <div key={title} className={styles.guideSection}>
                    <p className={styles.guideSectionTitle}>{title}</p>
                    <p className={styles.guideSectionBody}>{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TUTORIAL OVERLAY — FIX 4 */}
        {showTutorial && (() => {
          const TUTORIAL_STEPS = [
            { icon: '☑️', title: 'Your Task Deck', body: 'Add tasks by typing or tapping the mic. Star a task to set it as your priority focus. Drag to reorder. Tap any task to edit details, set a due time, or add notes.' },
            { icon: '💬', title: 'Your AI Coach Checks In', body: 'Three times a day — morning, midday, and evening — Cinis reaches out. It knows your task list and coaches you in your style. The more you engage, the smarter it gets.' },
            { icon: '🎯', title: 'Lock In With Focus Mode', body: 'Pick a task, pick a duration (5 to 60 minutes), and go. When time\'s up, tell Cinis how it went. Nailed it, made progress, or got stuck — each response shapes what happens next.' },
            { icon: '📓', title: 'Think Out Loud', body: 'The journal is your private space. Cinis listens, reflects back what it notices, and asks one good question. If you mention something that sounds like a task, it offers to add it. Entries are saved automatically.' },
          ]
          const step = TUTORIAL_STEPS[tutorialStep]
          const isLast = tutorialStep === TUTORIAL_STEPS.length - 1
          return (
            <div className={styles.tutorialOverlay}>
              <div className={styles.tutorialCard}>
                <div className={styles.tutorialIcon}>{step.icon}</div>
                <div className={styles.tutorialTitle}>{step.title}</div>
                <div className={styles.tutorialBody}>{step.body}</div>
                <div className={styles.tutorialFooter}>
                  <div className={styles.tutorialDots}>
                    {TUTORIAL_STEPS.map((_, i) => (
                      <div key={i} className={`${styles.tutorialDot} ${i === tutorialStep ? styles.tutorialDotActive : ''}`} />
                    ))}
                  </div>
                  <div className={styles.tutorialActions}>
                    <button className={styles.tutorialSkip} onClick={() => dismissTutorial(true)}>Skip</button>
                    <button className={styles.tutorialNext} onClick={() => {
                      if (isLast) { dismissTutorial(true) }
                      else setTutorialStep(s => s + 1)
                    }}>
                      {isLast ? "Let's go →" : 'Next →'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* PERSONA SETTINGS MODAL */}
        {showPersonaModal && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowPersonaModal(false)}>
            <div className={styles.modal} style={{ maxWidth: '600px' }}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>My persona</h2>
                <button onClick={() => setShowPersonaModal(false)} className={styles.modalClose}>×</button>
              </div>
              <p className={styles.personaModalSub}>Pick up to 3. Your first choice is your dominant style.</p>
              <div className={styles.personaModalGrid}>
                {PERSONAS_LIST.map(({ key, label, desc }) => {
                  const idx = personaSelection.indexOf(key)
                  const selected = idx !== -1
                  return (
                    <div key={key} className={`${styles.personaCard} ${selected ? styles.personaCardSelected : ''}`}
                      onClick={() => togglePersonaSelection(key)}>
                      {selected && <span className={styles.personaBadge}>{PERSONA_BADGE[idx] || 'Accent'}</span>}
                      <p className={styles.personaCardLabel}>{label}</p>
                      <p className={styles.personaCardDesc}>{desc}</p>
                    </div>
                  )
                })}
              </div>
              <div className={styles.personaVoiceBlock}>
                <p className={styles.personaVoiceTitle}>Your coach's voice</p>
                <div className={styles.personaVoiceRow}>
                  {[['female', 'Female', 'Warmer, more empathetic'], ['male', 'Male', 'More direct, action-oriented']].map(([val, label, hint]) => (
                    <button key={val} className={`${styles.personaVoiceBtn} ${personaVoice === val ? styles.personaVoiceBtnActive : ''}`}
                      onClick={() => setPersonaVoice(val)}>
                      {label}
                      <span className={styles.personaVoiceHint}>{hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button className={styles.modalSubmit} onClick={savePersona} disabled={personaSelection.length === 0 || personaSaving}>
                {personaSaving ? 'Saving...' : 'Save persona'}
              </button>
            </div>
          </div>
        )}

        {/* STREAK CELEBRATION OVERLAY */}
        {showStreakCelebration && (() => {
          const MILESTONE_TEXT = { 7: 'One week strong.', 14: 'Two weeks.', 30: 'A whole month.', 60: 'Two months.', 90: 'Ninety days.', 365: 'A full year.' }
          const subtext = MILESTONE_TEXT[streakCelebMilestone] || ''
          return (
            <div className={styles.streakOverlay} onClick={() => setShowStreakCelebration(false)}>
              <div className={styles.streakContent}>
                {Array.from({ length: 20 }, (_, i) => {
                  const angle = (i / 20) * 360
                  const dist = 80 + (i % 3) * 30
                  const px = Math.round(Math.cos(angle * Math.PI / 180) * dist)
                  const py = Math.round(Math.sin(angle * Math.PI / 180) * dist)
                  return (
                    <div
                      key={i}
                      className={styles.streakParticle}
                      style={{ '--px': `${px}px`, '--py': `${py}px`, animationDelay: `${(i % 5) * 50}ms`, opacity: 0.4 + (i % 3) * 0.2 }}
                    />
                  )
                })}
                <div className={styles.streakNum}>{streakCelebMilestone}</div>
                <div className={styles.streakLabel}>Day Streak</div>
                <div className={styles.streakSubtext}>{subtext}</div>
                <div className={styles.streakDismiss}>Tap anywhere to continue</div>
              </div>
            </div>
          )
        })()}

      </div>

      {isDebug && (
        <DebugPanel
          user={user}
          profile={profile}
          tasks={tasks}
          bills={bills}
          journalEntries={journalEntries}
          activeTab={activeTab}
          debugRef={debugRef}
          showAddModal={showAddModal}
          showPersonaModal={showPersonaModal}
          showSessionEndModal={showSessionEndModal}
          showAddBillModal={showAddBillModal}
          showGuideModal={showGuideModal}
          showAlarmsModal={showAlarmsModal}
        />
      )}
    </>
  )
}
