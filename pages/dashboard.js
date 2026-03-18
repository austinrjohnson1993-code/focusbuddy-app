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
import { CheckSquare, ChatCircle, Target, CalendarBlank, Notebook, Wallet, ChartLineUp, Plus, Trash, Archive, Star, Gear, MagnifyingGlass, X, CaretLeft, CaretRight, CaretDown, Receipt, Scales, Books, Robot, List, Timer, ChartBar, Lightning, ArrowCounterClockwise, CheckCircle, Microphone } from '@phosphor-icons/react'

const THEMES = [
  { id: 'orange-bronze', name: 'Classic', accent: '#ff4d1c', gradient: 'radial-gradient(ellipse at top left, rgba(101,60,10,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(80,45,8,0.35) 0%, transparent 60%)', logo: '#ff4d1c' },
  { id: 'teal-ocean', name: 'Ocean', accent: '#2dd4bf', gradient: 'radial-gradient(ellipse at top left, rgba(15,80,90,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(10,60,70,0.35) 0%, transparent 60%)', logo: '#2dd4bf' },
  { id: 'purple-cosmos', name: 'Cosmos', accent: '#8b5cf6', gradient: 'radial-gradient(ellipse at top left, rgba(60,20,120,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(40,10,90,0.35) 0%, transparent 60%)', logo: '#8b5cf6' },
  { id: 'blue-arctic', name: 'Arctic', accent: '#3b82f6', gradient: 'radial-gradient(ellipse at top left, rgba(15,40,100,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(10,30,80,0.35) 0%, transparent 60%)', logo: '#3b82f6' },
  { id: 'green-forest', name: 'Forest', accent: '#22c55e', gradient: 'radial-gradient(ellipse at top left, rgba(10,70,30,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(8,50,20,0.35) 0%, transparent 60%)', logo: '#22c55e' },
  { id: 'rose-sunset', name: 'Sunset', accent: '#f43f5e', gradient: 'radial-gradient(ellipse at top left, rgba(120,20,40,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(90,15,30,0.35) 0%, transparent 60%)', logo: '#f43f5e' },
  { id: 'amber-desert', name: 'Desert', accent: '#f59e0b', gradient: 'radial-gradient(ellipse at top left, rgba(120,70,5,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(90,50,5,0.35) 0%, transparent 60%)', logo: '#f59e0b' },
  { id: 'cyan-electric', name: 'Electric', accent: '#06b6d4', gradient: 'radial-gradient(ellipse at top left, rgba(5,70,100,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(5,50,80,0.35) 0%, transparent 60%)', logo: '#06b6d4' },
  { id: 'indigo-night', name: 'Night', accent: '#6366f1', gradient: 'radial-gradient(ellipse at top left, rgba(30,20,100,0.4) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(20,15,80,0.35) 0%, transparent 60%)', logo: '#6366f1' },
  { id: 'drill-sergeant', name: 'Command', accent: '#ef4444', gradient: 'radial-gradient(ellipse at top left, rgba(100,10,10,0.5) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(80,5,5,0.4) 0%, transparent 60%)', logo: '#ef4444' },
  { id: 'midnight', name: 'Midnight', accent: '#ffffff', gradient: 'radial-gradient(ellipse at top left, rgba(40,40,40,0.5) 0%, transparent 60%), radial-gradient(ellipse at bottom right, rgba(20,20,20,0.4) 0%, transparent 60%)', logo: '#ffffff', bg: '#000000' },
]

function applyTheme(theme) {
  if (!theme || typeof document === 'undefined') return
  const root = document.documentElement
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-gradient', theme.gradient)
  root.style.setProperty('--logo-color', theme.logo)
  // Override background/text for themes that need it (Midnight)
  root.style.setProperty('--night', theme.bg || '#0d1117')
  root.style.setProperty('--cream', theme.textColor || '#f0ead6')
  root.removeAttribute('data-theme')
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
  try { localStorage.setItem(key, JSON.stringify(messages.slice(-20))) } catch {}
}

const NAV_ITEMS = [
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={22} /> },
  { id: 'checkin', label: 'Check-in', icon: <ChatCircle size={22} /> },
  { id: 'focus', label: 'Focus', icon: <Target size={22} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarBlank size={22} /> },
  { id: 'journal', label: 'Journal', icon: <Notebook size={22} /> },
  { id: 'finance', label: 'Finance', icon: <Wallet size={22} /> },
  { id: 'progress', label: 'Progress', icon: <ChartLineUp size={22} /> },
]

const NAV_PRIMARY_IDS = ['tasks', 'checkin', 'focus', 'calendar']
const NAV_MORE_IDS = ['journal', 'finance', 'progress', 'settings']

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

// Custom hook for live countdowns — only ticks for today's tasks
function useCountdown(targetTime) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    if (!targetTime) { setTimeLeft(''); return }
    const update = () => {
      const now = new Date()
      const target = new Date(targetTime)
      if (target.toDateString() !== now.toDateString()) { setTimeLeft(''); return }
      const diff = target - now
      if (diff <= 0) { setTimeLeft('Now'); return }
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      if (hours > 0) setTimeLeft(`in ${hours}h ${mins}m`)
      else setTimeLeft(`in ${mins}m`)
    }
    update()
    const interval = setInterval(update, 30000)
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
  const [journalPendingTask, setJournalPendingTask] = useState(null)
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

  // Live tick for countdown displays in task list
  const [tickNow, setTickNow] = useState(() => new Date())

  // Settings
  const [settingsName, setSettingsName] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [notifMorning, setNotifMorning] = useState(true)
  const [notifMidday, setNotifMidday] = useState(false)
  const [notifEvening, setNotifEvening] = useState(true)
  const [notifPermission, setNotifPermission] = useState(() => typeof Notification !== 'undefined' ? Notification.permission : 'default')

  // Bill voice input
  const [billListening, setBillListening] = useState(false)
  const [billVoiceTranscript, setBillVoiceTranscript] = useState('')
  const [billParsing, setBillParsing] = useState(false)
  const billRecognitionRef = useRef(null)

  // Next move
  const [nextMoveLoading, setNextMoveLoading] = useState(false)
  const [nextMoveResult, setNextMoveResult] = useState(null) // { raw, taskName, taskId }

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
  }, [profile])

  useEffect(() => {
    if (activeTab === 'checkin' && !checkinInitialized && user) {
      setCheckinInitialized(true)
      const historyKey = `focusbuddy_checkin_history_${user.id}`
      const saved = loadChatHistory(historyKey)
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
          if (data.message) {
            const msgs = [{ role: 'assistant', content: data.message }]
            setCheckinMessages(msgs)
            saveChatHistory(historyKey, msgs)
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
      const journalKey = `focusbuddy_journal_history_${user.id}`
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

  // Global Escape key → close topmost modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (showSessionEndModal) { setShowSessionEndModal(false); return }
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
    const { data } = await supabase
      .from('tasks').select('*').eq('user_id', userId).eq('archived', false)
      .order('sort_order', { ascending: true, nullsLast: true })
      .order('created_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
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

  const fetchBills = async (userId) => {
    setBillsLoaded(true)
    const { data } = await supabase
      .from('bills').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    setBills(data || [])
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
      new Notification(alarm.title, { body: 'FocusBuddy reminder', icon: '/favicon.ico' })
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
      created_at: new Date().toISOString(), scheduled_for: new Date().toISOString()
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
      priority_score: 0, created_at: new Date().toISOString(), scheduled_for: new Date().toISOString()
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

  const sendCheckinMessage = async (e) => {
    e.preventDefault()
    if (!checkinInput.trim() || checkinLoading) return
    const historyKey = `focusbuddy_checkin_history_${user.id}`
    const userMsg = { role: 'user', content: checkinInput.trim() }
    const updated = [...checkinMessages, userMsg]
    setCheckinMessages(updated); setCheckinInput(''); setCheckinLoading(true)
    try {
      const res = await loggedFetch('/api/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, checkInType: getCheckinType(), messages: updated, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
      })
      const data = await res.json()
      if (data.message) {
        setCheckinMessages(prev => {
          const next = [...prev, { role: 'assistant', content: data.message }]
          saveChatHistory(historyKey, next)
          return next
        })
      } else {
        saveChatHistory(historyKey, updated)
      }
      fetchTasks(user.id)
      if (billsLoaded) fetchBills(user.id)
      fetchAlarms(user.id)
    } catch {
      setCheckinMessages(prev => [...prev, { role: 'assistant', content: "I'm here. Keep going." }])
    }
    setCheckinLoading(false)
  }

  // ── Journal ───────────────────────────────────────────────────────────────

  const sendJournalMessage = async (e) => {
    e.preventDefault()
    if (!journalInput.trim() || journalLoading) return
    const journalKey = `focusbuddy_journal_history_${user.id}`
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
      setJournalMessages(prev => {
        const next = [...prev, { role: 'assistant', content: data.message }]
        saveChatHistory(journalKey, next)
        return next
      })
      const userMsgCount = journalMessages.filter(m => m.role === 'user').length + 1
      if (!journalReminderShown && userMsgCount >= 3) { setJournalReminderShown(true); setShowJournalReminder(true) }
      if (data.extractedTasks?.length > 0) setJournalPendingTask(data.extractedTasks[0])
    } catch {
      setJournalMessages(prev => [...prev, { role: 'assistant', content: "I'm here. Keep going." }])
    }
    setJournalLoading(false)
  }

  const addJournalTask = async () => {
    if (!journalPendingTask) return
    await addTaskQuick(journalPendingTask)
    setJournalPendingTask(null)
  }

  const newJournalEntry = async () => {
    // Save current conversation to DB (already saved per message by API, just clear UI)
    setJournalMessages([])
    setJournalPendingTask(null)
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
    applyTheme(theme)
    setActiveTheme(theme)
    setProfile(prev => ({ ...prev, accent_color: theme.id }))
    if (typeof localStorage !== 'undefined') localStorage.setItem('fb_accent_color', theme.id)
    if (user) {
      // Direct Supabase update for reliability, plus API route as backup
      await supabase.from('profiles').update({ accent_color: theme.id }).eq('id', user.id)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('[settings] No session token available')
        return
      }
      const payload = { userId: user.id, updates: { accent_color: theme.id } }
      const response = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      }).catch(() => null)
      if (response) console.log('[settings] saved successfully', response.status)
    }
  }

  // ── Push notification toggle ───────────────────────────────────────────────

  const handleEnablePush = async () => {
    try {
      const sub = await requestNotificationPermission()
      if (sub) {
        await supabase.from('profiles').update({
          push_notifications_enabled: true,
          push_subscription: sub.toJSON()
        }).eq('id', user.id)
        try { localStorage.setItem('fb_push_enabled', 'true') } catch {}
        setProfile(prev => ({ ...prev, push_notifications_enabled: true }))
        setNotifPermission('granted')
        showToast('Push notifications enabled')
      } else {
        showToast('Permission denied')
      }
    } catch (err) {
      console.error('[push] enable error:', err)
      showToast('Could not enable notifications')
    }
  }

  const handleDisablePush = async () => {
    try {
      await disablePushNotifications(supabase, user.id)
      setProfile(prev => ({ ...prev, push_notifications_enabled: false }))
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
    const updates = { persona_blend: personaSelection, persona_voice: personaVoice, persona_set: true }
    await supabase.from('profiles').update(updates).eq('id', user.id)
    setProfile(prev => ({ ...prev, persona_blend: personaSelection, persona_voice: personaVoice }))
    setPersonaSaving(false); setShowPersonaModal(false)
    showToast('Persona updated')
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
        created_at: new Date().toISOString(), scheduled_for: t.due_date ? new Date(`${t.due_date}T09:00`).toISOString() : new Date().toISOString()
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
            <span className="brand" style={{ color: 'var(--logo-color, var(--accent))' }}><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
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
            <button onClick={() => setShowGuideModal(true)}
              className={styles.settingsFooterBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Guide
            </button>
            <button
              onClick={() => switchTab('settings')}
              className={`${styles.settingsFooterBtn} ${activeTab === 'settings' ? styles.settingsFooterBtnActive : ''}`}>
              <Gear size={16} />
              Settings
            </button>
            <button onClick={handleSignOut} className={styles.signOutBtn}>Sign out</button>
            <button onClick={handleRunRollover} className={styles.rolloverDevBtn}>Run rollover</button>
          </div>
        </aside>

        {/* MAIN */}
        <main className={styles.main}>

          {/* ── TASKS ── */}
          {activeTab === 'tasks' && (
          <TabErrorBoundary tabName="Tasks">
            <div className={styles.view}>
              <div className={styles.viewHeader}>
                <div>
                  <h1 className={styles.greetingText}>
                    {greeting}, <span className={styles.name}>{rawName.includes('@') ? 'there' : (rawName || 'there')}</span>
                  </h1>
                  <p className={styles.headerSub}>
                    {allPendingTasks.length === 0
                      ? "You're all caught up. Seriously — well done."
                      : `${allPendingTasks.length} thing${allPendingTasks.length !== 1 ? 's' : ''} on your list.`}
                  </p>
                </div>
                <button onClick={() => setShowAddModal(true)} className={styles.addTaskBtn}>
                  <span>+</span> Add task
                </button>
              </div>

              {/* ── Next Move Button ── */}
              {allPendingTasks.length > 0 && (
                <div className={styles.nextMoveWrap}>
                  <button
                    className={styles.nextMoveBtn}
                    onClick={fetchNextMove}
                    disabled={nextMoveLoading}
                  >
                    {nextMoveLoading
                      ? <><span className={styles.nextMoveSpinner} /> thinking…</>
                      : <>What&rsquo;s my next move? &rarr;</>
                    }
                  </button>
                  {nextMoveResult && (
                    <div className={styles.nextMoveCard}>
                      <button
                        className={styles.nextMoveDismiss}
                        onClick={() => setNextMoveResult(null)}
                        aria-label="Dismiss"
                      >✕</button>
                      <p className={styles.nextMoveText}>
                        {nextMoveResult.taskName ? (
                          (() => {
                            const parts = nextMoveResult.raw.split(/\*\*(.+?)\*\*/)
                            return parts.map((part, i) => {
                              if (i % 2 === 1) {
                                // This is the bolded task name
                                const matchedTask = tasks.find(t => t.title.toLowerCase().includes(part.toLowerCase()))
                                return (
                                  <strong
                                    key={i}
                                    className={styles.nextMoveTaskName}
                                    onClick={() => {
                                      if (matchedTask) {
                                        setElectedTaskId(matchedTask.id)
                                        setNextMoveResult(null)
                                      }
                                    }}
                                    style={matchedTask ? { cursor: 'pointer' } : {}}
                                  >
                                    {part}
                                  </strong>
                                )
                              }
                              return <span key={i}>{part}</span>
                            })
                          })()
                        ) : (
                          nextMoveResult.raw
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.focusCardWrap}>
                {electedTask ? (
                  <>
                    <div className={styles.focusLabel}>
                      <span className={styles.focusDot} />
                      {electedTask.due_time ? 'Time sensitive task' : 'Priority focus'}
                    </div>
                    <div className={`${styles.focusCard} ${completing === electedTask.id ? styles.focusCardCompleting : ''}`}>
                      {electedTask.rollover_count > 0 && (
                        <div className={styles.rolloverBadge}>
                          ↷ Rolled over {electedTask.rollover_count}×
                          {electedTask.rollover_count >= 2 && (
                            <button className={styles.breakItDown} onClick={() => {
                              setNewTitle(`First step: ${electedTask.title}`)
                              setNewDueDate(electedTask.scheduled_for ? new Date(electedTask.scheduled_for).toISOString().split('T')[0] : '')
                              setShowAddModal(true)
                            }}>· Break it down →</button>
                          )}
                        </div>
                      )}
                      <div className={styles.focusCardBody}>
                        <button onClick={() => completeTask(electedTask)} className={styles.focusCheck} aria-label="Complete task" />
                        <div className={styles.focusTaskInfo} onClick={() => setDetailTask(electedTask)} style={{ cursor: 'pointer' }}>
                          <span className={styles.focusTaskTitle}>{electedTask.title}</span>
                          {topTaskCountdown && (
                            <span style={{ fontSize: '13px', color: 'var(--accent)', opacity: 0.9, fontWeight: 600 }}>
                              {topTaskCountdown}
                            </span>
                          )}
                          {!topTaskCountdown && (() => {
                            const fmt = electedTask.due_time ? formatDueTime(electedTask.due_time) : null
                            const dateLabel = getTaskDateLabel(electedTask)
                            const dateDisplay = dateLabel
                              ? (fmt ? `${dateLabel} · ${fmt.label}` : dateLabel)
                              : (fmt ? fmt.label : null)
                            if (!dateDisplay) return null
                            return (
                              <span className={`${styles.focusDueTime} ${fmt?.urgent ? styles.focusDueUrgent : ''}`}>
                                {fmt?.urgent && <span className={styles.urgentDot} />}
                                {dateDisplay}
                              </span>
                            )
                          })()}
                          {electedTask.notes && <span className={styles.focusNotes}>{electedTask.notes}</span>}
                          <div className={styles.focusBadgeRow}>
                            {electedTask.consequence_level === 'external' && <span className={styles.externalBadge}>External commitment</span>}
                            {electedTask.recurrence && electedTask.recurrence !== 'none' && (
                              <span className={styles.recurrenceBadge}>{electedTask.recurrence === 'daily' ? '↻ Daily' : '↻ Weekly'}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.focusCardActions}>
                        <button onClick={() => switchTab('focus')} className={styles.focusAction} style={{ color: 'var(--accent)', fontWeight: 700 }}>
                          Start timer →
                        </button>
                        <button onClick={() => rescheduleTask(electedTask)} className={styles.focusAction}>
                          <CaretRight size={12} style={{marginRight:'5px'}} />
                          Push to tomorrow
                        </button>
                        <button onClick={() => archiveTask(electedTask)} className={styles.focusActionDelete}>×</button>
                      </div>
                    </div>
                    {allPendingTasks.length > 1 && <div className={styles.stackCard2} />}
                    {allPendingTasks.length > 2 && <div className={styles.stackCard3} />}
                  </>
                ) : (
                  <div className={styles.priorityEmptyCard}>
                    <span className={styles.priorityEmptyIcon}>☆</span>
                    <p className={styles.priorityEmptyText}>No priority selected</p>
                    <p className={styles.priorityEmptySub}>Star a task below to set your focus</p>
                  </div>
                )}
              </div>

              {allPendingTasks.length > 0 && (
                <>
                  {!dragHintDismissed && (
                    <div className={styles.dragHintBanner}>
                      <span>⠿ Drag to set your priority order — top task becomes your focus</span>
                      <button onClick={dismissDragHint} className={styles.dragHintClose}>×</button>
                    </div>
                  )}
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <Droppable droppableId="upnext-tasks">
                      {(provided) => (
                        <div className={styles.taskGroup} ref={provided.innerRef} {...provided.droppableProps}>
                          <div className={styles.taskGroupLabel}>Up next</div>
                          {allPendingTasks.map((task, index) => {
                            const dueFmt = task.due_time ? formatDueTime(task.due_time) : null
                            const dateLabel = getTaskDateLabel(task)
                            const countdown = getCountdownDisplay(task.due_time, tickNow)
                            const dateDisplay = countdown
                              ? null
                              : (dateLabel
                                  ? (dueFmt ? `${dateLabel} · ${dueFmt.label}` : dateLabel)
                                  : (dueFmt ? dueFmt.label : null))
                            const isElected = task.id === electedTaskId
                            const isBillTask = task.title?.startsWith('Pay: ')
                            return (
                              <Draggable key={String(task.id)} draggableId={String(task.id)} index={index}>
                                {(provided) => (
                                  <div ref={provided.innerRef} {...provided.draggableProps} className={`${styles.taskCard}${isBillTask ? ` ${styles.billTaskCard}` : ''}`}>
                                    <button
                                      className={`${styles.starBtn} ${isElected ? styles.starBtnActive : ''}`}
                                      onClick={e => { e.stopPropagation(); setElectedTaskId(isElected ? null : task.id) }}
                                      title={isElected ? 'Remove priority' : 'Set as priority focus'}
                                    >{isElected ? '★' : '☆'}</button>
                                    <span {...provided.dragHandleProps} className={styles.dragHandle} title="Drag to reorder">⠿</span>
                                    <button onClick={() => completeTask(task)} className={styles.taskCheck} aria-label="Complete" />
                                    <div className={styles.taskInfo} onClick={() => setDetailTask(task)} style={{ cursor: 'pointer' }}>
                                      <span className={styles.taskTitle}>{isBillTask && <Receipt size={16} style={{ marginRight: '4px', verticalAlign: 'middle', opacity: 0.7 }} />}{task.title}{isBillTask && <span className={styles.billBadge}>Bill</span>}</span>
                                      {task.notes && <span className={styles.taskNotes}>{task.notes}</span>}
                                      <div className={styles.taskMeta}>
                                        {countdown && <span className={`${styles.taskDueTime} ${styles.taskDueUrgent}`} style={{ color: 'var(--accent)' }}>{countdown}</span>}
                                        {!countdown && dateDisplay && <span className={`${styles.taskDueTime} ${dueFmt?.urgent ? styles.taskDueUrgent : ''}`}>{dateDisplay}</span>}
                                        {task.rollover_count > 0 && <span className={styles.taskRollover}>↷ {task.rollover_count}×</span>}
                                        {task.consequence_level === 'external' && <span className={styles.taskExternal}>External</span>}
                                        {task.recurrence && task.recurrence !== 'none' && <span className={styles.taskRecurrence}>↻ {task.recurrence}</span>}
                                      </div>
                                    </div>
                                    <div className={styles.taskActions}>
                                      <button onClick={e => { e.stopPropagation(); rescheduleTask(task) }} className={styles.taskAction} title="Push to tomorrow">
                                        <CaretRight size={13} />
                                      </button>
                                      <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this task?')) return; archiveTask(task) }} className={styles.taskActionDelete} title="Remove">×</button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            )
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </>
              )}

              {allPendingTasks.length === 0 && completedTasks.length === 0 && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>✦</div>
                  <p className={styles.emptyText}>Nothing on your list.</p>
                  <p className={styles.emptySubtext}>Add your first task and FocusBuddy will handle the rest.</p>
                  <button onClick={() => setShowAddModal(true)} className={styles.emptyAddBtn}>+ Add your first task</button>
                </div>
              )}

              {/* ── Coming up ── */}
              {comingUpItems.length > 0 && (
                <div className={styles.taskGroup} style={{ marginTop: '28px' }}>
                  <div className={styles.taskGroupLabel}>Coming up</div>
                  {comingUpItems.map(item => (
                    <div key={item.id} className={styles.comingUpCard}
                      onClick={() => item.type === 'task' && item.task && setDetailTask(item.task)}>
                      <div className={styles.comingUpLeft}>
                        <span className={`${styles.comingUpBadge} ${item.type === 'bill' ? styles.comingUpBadgeBill : styles.comingUpBadgeTask}`}>
                          {item.type === 'bill' ? 'Bill' : 'Recurring'}
                        </span>
                        <span className={styles.comingUpTitle}>
                          {item.title}
                          {item.type === 'bill' && item.amount ? ` · ${fmtMoney(item.amount)}` : ''}
                        </span>
                      </div>
                      <span className={`${styles.comingUpDue} ${item.daysUntil <= 1 ? styles.comingUpDueSoon : ''}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Routines ── */}
              {pendingChores.length > 0 && (
                <div className={styles.routinesGroup}>
                  <button className={styles.routinesHeader} onClick={() => setRoutinesExpanded(v => !v)}>
                    <span>🧹 Routines — {pendingChores.length} task{pendingChores.length !== 1 ? 's' : ''} today</span>
                    <span className={styles.routinesChevron}>{routinesExpanded ? '▲' : '▼'}</span>
                  </button>
                  {routinesExpanded && (
                    <div className={styles.routinesList}>
                      {pendingChores.map(task => (
                        <div key={task.id} className={styles.routineItem}>
                          <button onClick={() => completeTask(task)} className={styles.taskCheck} aria-label="Complete" />
                          <span className={styles.routineTitle}>{task.title}</span>
                          <span className={styles.routineBadge}>{task.recurrence}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {completedTasks.length > 0 && (
                <div className={styles.taskGroup} style={{ marginTop: '32px' }}>
                  <div className={styles.taskGroupLabel}>Done today · {completedTasks.length} {completedTasks.length === 1 ? 'win' : 'wins'} 🔥</div>
                  {completedTasks.map(task => (
                    <div key={task.id} className={`${styles.taskCard} ${styles.taskDone}`}>
                      <button onClick={() => uncompleteTask(task)} className={`${styles.taskCheck} ${styles.taskCheckDone}`}>✓</button>
                      <div className={styles.taskInfo}><span className={styles.taskTitleDone}>{task.title}</span></div>
                      <button onClick={e => { e.stopPropagation(); if (!window.confirm('Delete this task?')) return; archiveTask(task) }} className={styles.taskActionDelete} title="Remove">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabErrorBoundary>
          )}

          {/* ── CHECK-IN ── */}
          {activeTab === 'checkin' && (
          <TabErrorBoundary tabName="Check-in">
          {(() => {
            const type = getCheckinType()
            const typeLabel = type === 'morning' ? 'Morning check-in' : type === 'midday' ? 'Midday check-in' : 'Evening check-in'
            const personaLabel = (() => {
              const blend = profile?.persona_blend
              if (!blend || blend.length === 0) return 'Default coaching style'
              const nameMap = { drill_sergeant: 'The Drill Sergeant', coach: 'The Coach', thinking_partner: 'The Thinking Partner', hype_person: 'The Hype Person', strategist: 'The Strategist' }
              return nameMap[blend[0]] || blend[0]
            })()
            return (
              <div className={styles.checkinWrap}>
                <div className={styles.checkinHeader}>
                  <div>
                    <div className={styles.checkinTypeTag}>{typeLabel}</div>
                    <div className={styles.checkinPersonaTag}>{personaLabel}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button onClick={() => setShowAlarmsModal(true)} className={styles.checkinSkipBtn} title="Alarms">
                      <Timer size={16} />
                    </button>
                    <button onClick={() => switchTab('tasks')} className={styles.checkinSkipBtn}>Skip to tasks</button>
                  </div>
                </div>
                <div className={styles.checkinMessages}>
                  {checkinMessages.map((msg, i) => (
                    <div key={i} className={msg.role === 'assistant' ? styles.checkinBubbleAI : styles.checkinBubbleUser}>
                      {msg.content}
                    </div>
                  ))}
                  {checkinLoading && <div className={styles.checkinBubbleAI}><span className={styles.checkinTyping}>···</span></div>}
                  <div ref={checkinEndRef} />
                </div>
                {checkinMessages.length > 1 && (
                  <button className={styles.clearHistoryBtn} onClick={() => {
                    try { localStorage.removeItem(`focusbuddy_checkin_history_${user.id}`) } catch {}
                    setCheckinMessages([])
                    setCheckinInitialized(false)
                  }}>Clear history</button>
                )}
                <form onSubmit={sendCheckinMessage} className={styles.checkinForm}>
                  <input type="text" placeholder="Reply..." value={checkinInput}
                    onChange={e => setCheckinInput(e.target.value)}
                    className={styles.checkinInput} autoFocus />
                  <button type="submit" disabled={checkinLoading || !checkinInput.trim()} className={styles.checkinSendBtn}>→</button>
                </form>
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
                          <p className={styles.focusStuckLabel}>FocusBuddy</p>
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
            // Bills with due_day in this month
            const billDueDays = {}
            bills.forEach(b => {
              if (b.due_day) {
                const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(b.due_day).padStart(2, '0')}`
                if (!billDueDays[dStr]) billDueDays[dStr] = []
                billDueDays[dStr].push(b)
              }
            })

            if (calView === 'day' && calDay) {
              const dayDStr = localDateStr(calDay)
              const dayTasks = calTasksForDay(dayDStr)
              const unscheduled = dayTasks.filter(t => !t.due_time)
              const scheduled = dayTasks.filter(t => !!t.due_time)
              const HOURS = Array.from({ length: 18 }, (_, i) => i + 6)
              const tasksByHour = {}
              scheduled.forEach(t => {
                const h = new Date(t.due_time).getHours()
                if (!tasksByHour[h]) tasksByHour[h] = []
                tasksByHour[h].push(t)
              })
              const dayBillsDue = bills.filter(b => b.due_day === calDay.getDate())
              const dayLabel = calDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              return (
                <div className={styles.calViewWrap}>
                  <div className={styles.calDayViewHeader}>
                    <button className={styles.calBackBtn} onClick={() => setCalView('month')}>← Back</button>
                    <div className={styles.calDayTitleBlock}>
                      <h2 className={styles.calDayTitle}>{dayLabel}</h2>
                      <p className={styles.calDaySub}>{dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={() => {
                      if (calDay) {
                        const d = calDay
                        setNewDueDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
                      }
                      setShowAddModal(true)
                    }} className={styles.calAddBtn}>+ Add</button>
                  </div>
                  <div className={styles.calTimeline}>
                    {unscheduled.length > 0 && (
                      <div className={styles.calUnscheduledBlock}>
                        <div className={styles.calSlotLabel}>Unscheduled — drag to a time slot</div>
                        <div className={styles.calSlotTasks}>
                          {unscheduled.map(t => (
                            <div
                              key={t.id}
                              draggable={true}
                              onDragStart={e => e.dataTransfer.setData('taskId', t.id)}
                              className={`${styles.calTaskChip} ${t.completed ? styles.calTaskChipDone : ''} ${t.consequence_level === 'external' ? styles.calTaskChipExt : ''}`}
                            >
                              <button onClick={() => t.completed ? uncompleteTask(t) : completeTask(t)} className={styles.calChipCheck}>{t.completed ? '✓' : ''}</button>
                              <div className={styles.calChipBody} onClick={() => setDetailTask(t)}>
                                <span className={styles.calChipTitle}>{t.title}</span>
                                <div className={styles.calChipBadges}>
                                  {t.consequence_level === 'external' && <span className={styles.calChipExtBadge} title="External commitment">Ext</span>}
                                  {t.rollover_count > 0 && <span className={styles.calChipRollover}>↷{t.rollover_count}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {HOURS.map(h => {
                      const slotTasks = tasksByHour[h] || []
                      const label = h === 0 ? '12am' : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`
                      const isCurrentHour = calDay && calDay.toDateString() === new Date().toDateString() && h === new Date().getHours()
                      return (
                        <div
                          key={h}
                          id={isCurrentHour ? 'time-slot-now' : undefined}
                          className={`${styles.calHourSlot} ${slotTasks.length > 0 ? styles.calHourSlotFilled : ''} ${dragOverHour === h ? styles.timeSlotDragOver : ''}`}
                          onDragOver={e => { e.preventDefault(); setDragOverHour(h) }}
                          onDragLeave={() => setDragOverHour(null)}
                          onDrop={e => handleDropOnTimeSlot(e, h)}
                        >
                          <div className={styles.calHourLabel}>{label}</div>
                          {isCurrentHour && <div className={styles.calNowLine}><div className={styles.calNowDot} /></div>}
                          <div className={styles.calHourLine} />
                          <div className={styles.calHourTasks}>
                            {slotTasks.map(t => (
                              <div
                                key={t.id}
                                draggable={true}
                                onDragStart={e => e.dataTransfer.setData('taskId', t.id)}
                                className={`${styles.calTaskChip} ${t.completed ? styles.calTaskChipDone : ''} ${t.consequence_level === 'external' ? styles.calTaskChipExt : ''}`}>
                                <button onClick={() => t.completed ? uncompleteTask(t) : completeTask(t)} className={styles.calChipCheck}>{t.completed ? '✓' : ''}</button>
                                <div className={styles.calChipBody} onClick={() => setDetailTask(t)}>
                                  <span className={styles.calChipTitle}>{t.title}</span>
                                  <div className={styles.calChipBadges}>
                                    {t.consequence_level === 'external' && <span className={styles.calChipExtBadge} title="External commitment">Ext</span>}
                                    {t.rollover_count > 0 && <span className={styles.calChipRollover}>↷{t.rollover_count}</span>}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {dayBillsDue.length > 0 && (
                    <div className={styles.calBillsBlock}>
                      <div className={styles.calBillsLabel}>Bills Due</div>
                      {dayBillsDue.map(bill => (
                        <div key={bill.id} className={styles.calBillRow}>
                          <span className={styles.calBillName}>{bill.name}</span>
                          <span className={styles.calBillAmount}>{fmtMoney(bill.amount)}</span>
                          <span className={styles.calBillCat}>{bill.category || 'Other'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <div className={styles.calViewWrap}>
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
                    const dayTasks = monthOccurrences[dStr] || []
                    const dayBills = billDueDays[dStr] || []
                    const isToday = dStr === todayDStr
                    return (
                      <div key={idx} className={`${styles.calCell} ${isToday ? styles.calCellToday : ''}`}
                        onClick={() => { setCalDay(new Date(year, month, day)); setCalView('day') }}>
                        <span className={styles.calCellNum}>{day}</span>
                        {(dayTasks.length > 0 || dayBills.length > 0) && (
                          <div className={styles.calDots}>
                            {dayTasks.slice(0, 2).map((t, di) => (
                              <span key={`t${di}`} className={styles.calDot}
                                style={{ background: t.consequence_level === 'external' ? 'var(--accent)' : 'rgba(240,234,214,0.4)' }} />
                            ))}
                            {dayBills.slice(0, 1).map((b, bi) => (
                              <span key={`b${bi}`} className={styles.calDot} style={{ background: '#00b5a5' }} />
                            ))}
                            {(dayTasks.length + dayBills.length) > 3 && <span className={styles.calDotMore}>+</span>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className={styles.calendarHint}>Tap a day to view your schedule</p>

                {/* ── Upcoming tasks list — always visible below month grid ── */}
                {(() => {
                  const upcomingTasks = tasks
                    .filter(t => !t.completed && !t.archived && t.due_date)
                    .sort((a, b) => (a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0))
                  const today = todayStr()
                  const tomorrow = tomorrowStr()
                  const fmtUpcomingDate = (dateStr) => {
                    if (dateStr === today) return 'Today'
                    if (dateStr === tomorrow) return 'Tomorrow'
                    const [y, m, d] = dateStr.split('-').map(Number)
                    const dt = new Date(y, m - 1, d)
                    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
                    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                    const diffDays = Math.round((dt - new Date(today)) / 86400000)
                    if (diffDays <= 6) return `${days[dt.getDay()]} ${months[dt.getMonth()]} ${d}`
                    return `${days[dt.getDay()]} ${months[dt.getMonth()]} ${d}`
                  }
                  return (
                    <div className={styles.calUpcomingSection}>
                      <p className={styles.calUpcomingLabel}>Upcoming tasks</p>
                      {upcomingTasks.length === 0 ? (
                        <p className={styles.calUpcomingEmpty}>No upcoming tasks — add a due date to any task to see it here.</p>
                      ) : (
                        <div className={styles.calUpcomingList}>
                          {upcomingTasks.map(t => (
                            <div key={t.id} className={styles.calUpcomingRow} onClick={() => setDetailTask(t)}>
                              <div className={styles.calUpcomingDate}>{fmtUpcomingDate(t.due_date)}</div>
                              <div className={styles.calUpcomingTitle}>{t.title}</div>
                              {t.consequence_level === 'external' && <span className={styles.calUpcomingExt}>Ext</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}
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

              {/* Task extraction banner */}
              {journalPendingTask && (
                <div className={styles.journalTaskBanner}>
                  <span className={styles.journalTaskBannerText}>I noticed a task: <strong>{journalPendingTask}</strong></span>
                  <div className={styles.journalTaskBannerBtns}>
                    <button onClick={addJournalTask} className={styles.journalTaskYes}>Add it</button>
                    <button onClick={() => setJournalPendingTask(null)} className={styles.journalTaskNo}>Skip</button>
                  </div>
                </div>
              )}

              {/* Input */}
              {journalMessages.length > 1 && (
                <button className={styles.clearHistoryBtn} onClick={() => {
                  try { localStorage.removeItem(`focusbuddy_journal_history_${user.id}`) } catch {}
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
            <div className={styles.view}>
              <div className={styles.header}>
                <h1 className={styles.greetingText}>Progress</h1>
              </div>

              {/* Time band selector */}
              <div className={styles.progressBands}>
                {[['today','Today'],['week','This week'],['month','This month']].map(([id, label]) => (
                  <button key={id} onClick={() => setProgressBand(id)}
                    className={`${styles.progressBandBtn} ${progressBand === id ? styles.progressBandBtnActive : ''}`}>
                    {label}
                  </button>
                ))}
              </div>

              {progressBand === 'today' && (() => {
                if (!user?.id) {
                  return <p style={{color:'rgba(240,234,214,0.5)', padding:'24px 0'}}>Loading...</p>
                }
                if (progressTodayError) return <p style={{color:'rgba(240,234,214,0.5)', padding:'24px 0'}}>Couldn't load today's stats. Try refreshing.</p>
                try {
                  const safeJournalEntries = Array.isArray(journalEntries) ? journalEntries : []
                  const todayStr = new Date().toISOString().split('T')[0]
                  const todayTasks = (tasks || []).filter(t => t.completed && t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString())
                  const journalCount = safeJournalEntries.filter(j => j.created_at?.startsWith(todayStr)).length
                  const stillPending = (allPendingTasks || []).length
                  return (
                    <div>
                      <div className={styles.progressStats}>
                        <div className={styles.progressStat}><span className={styles.progressStatNum}>{todayTasks.length}</span><span className={styles.progressStatLabel}>Done today</span></div>
                        <div className={styles.progressStat}><span className={styles.progressStatNum}>{stillPending}</span><span className={styles.progressStatLabel}>Still pending</span></div>
                        <div className={styles.progressStat}><span className={styles.progressStatNum}>{journalCount}</span><span className={styles.progressStatLabel}>Journal entries</span></div>
                      </div>
                      {todayTasks.length > 0 ? (
                        <div className={styles.progressWins}>
                          <p className={styles.progressWinsLabel}>Today's wins</p>
                          {todayTasks.map(t => (
                            <div key={t.id} className={styles.progressWinItem}>
                              <span className={styles.progressWinDot}>✓</span>
                              <span className={styles.progressWinTitle}>{t.title}</span>
                              <span className={styles.progressWinTime}>{new Date(t.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={styles.progressDayOneEmpty}>
                          <p className={styles.progressDayOneHeadline}>Day one starts now.</p>
                          <p className={styles.progressDayOneSub}>Complete your first task and it'll show up here.</p>
                          <button onClick={() => setActiveTab('tasks')} className={styles.progressDayOneCta}>Go to Tasks</button>
                        </div>
                      )}
                    </div>
                  )
                } catch (e) {
                  setProgressTodayError(true)
                  return <p style={{color:'rgba(240,234,214,0.5)', padding:'24px 0'}}>Couldn't load today's stats. Try refreshing.</p>
                }
              })()}

              {progressBand === 'week' && (
                <div>
                  <div className={styles.progressStats}>
                    <div className={styles.progressStat}><span className={styles.progressStatNum}>{completedThisWeek.length}</span><span className={styles.progressStatLabel}>Completed</span></div>
                    <div className={styles.progressStat}><span className={styles.progressStatNum}>{getStreak()}</span><span className={styles.progressStatLabel}>Day streak</span></div>
                    {(() => { const best = getBestDay(); return (
                      <div className={styles.progressStat}>
                        <span className={styles.progressStatNum} style={{ fontSize: '1.2rem' }}>{best ? best.day : '—'}</span>
                        <span className={styles.progressStatLabel}>Best day</span>
                        <span className={styles.progressStatSub}>{best ? `${best.count} task${best.count !== 1 ? 's' : ''}` : 'No data yet'}</span>
                      </div>
                    ) })()}
                  </div>
                  {Object.keys(completedByDay).length > 0 ? (
                    <div className={styles.progressWins}>
                      <p className={styles.progressWinsLabel}>Weekly wins</p>
                      {Object.entries(completedByDay).map(([day, items]) => (
                        <div key={day} className={styles.progressDayGroup}>
                          <p className={styles.progressDayLabel}>{day}</p>
                          {items.map(t => (
                            <div key={t.id} className={styles.progressWinItem}>
                              <span className={styles.progressWinDot}>✓</span>
                              <span className={styles.progressWinTitle}>{t.title}</span>
                              <span className={styles.progressWinTime}>{new Date(t.completed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : <div className={styles.progressEmpty}><p className={styles.emptyText}>No completions this week yet.</p></div>}
                  <div className={styles.progressSummaryCard}>
                    <p className={styles.progressSummaryLabel}>Weekly summary</p>
                    {completedThisWeek.length === 0
                      ? <p className={styles.progressSummaryText}>Complete some tasks this week and come back for your AI summary.</p>
                      : weeklySummaryLoading ? <p className={styles.progressSummaryLoading}>···</p>
                      : weeklySummary ? <p className={styles.progressSummaryText}>{weeklySummary}</p>
                      : <button onClick={fetchWeeklySummary} className={styles.progressSummaryRefresh}>Generate summary</button>}
                  </div>
                </div>
              )}

              {progressBand === 'month' && (() => {
                const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                const completedThisMonth = tasks.filter(t => t.completed && t.completed_at && new Date(t.completed_at) > thirtyDaysAgo)
                const totalCompleted = tasks.filter(t => t.completed).length
                return (
                  <div>
                    <div className={styles.progressStats}>
                      <div className={styles.progressStat}><span className={styles.progressStatNum}>{completedThisMonth.length}</span><span className={styles.progressStatLabel}>This month</span></div>
                      <div className={styles.progressStat}><span className={styles.progressStatNum}>{totalCompleted}</span><span className={styles.progressStatLabel}>All time</span></div>
                      {(() => { const best = getBestDay(); return (
                        <div className={styles.progressStat}>
                          <span className={styles.progressStatNum} style={{ fontSize: '1.2rem' }}>{best ? best.day : '—'}</span>
                          <span className={styles.progressStatLabel}>Best day</span>
                          <span className={styles.progressStatSub}>{best ? `${best.count} task${best.count !== 1 ? 's' : ''}` : 'No data yet'}</span>
                        </div>
                      ) })()}
                    </div>
                    <div className={styles.progressSummaryCard}>
                      <p className={styles.progressSummaryLabel}>Monthly insight</p>
                      {completedThisMonth.length === 0
                        ? <p className={styles.progressSummaryText}>Complete some tasks this month and come back for your AI insight.</p>
                        : monthlySummaryLoading ? <p className={styles.progressSummaryLoading}>···</p>
                        : monthlySummary ? <p className={styles.progressSummaryText}>{monthlySummary}</p>
                        : <button onClick={fetchMonthlySummary} className={styles.progressSummaryRefresh}>Generate insight</button>}
                    </div>
                  </div>
                )
              })()}
            </div>
          </TabErrorBoundary>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && (
          <TabErrorBoundary tabName="Settings">
            <div className={styles.settingsView}>
              <div className={styles.header}>
                <h1 className={styles.greetingText}>Settings</h1>
              </div>

              {/* Account */}
              <div className={styles.settingsSection}>
                <p className={styles.settingsSectionLabel}>Account</p>
                <div className={styles.settingsCard}>
                  <div className={styles.settingsRow}>
                    <div className={styles.settingsRowLeft}>
                      <span className={styles.settingsRowLabel}>Display name</span>
                    </div>
                    <div className={styles.settingsRowRight}>
                      <input
                        type="text" value={settingsName}
                        onChange={e => setSettingsName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveSettings()}
                        className={styles.settingsNameInput}
                        placeholder="Your name"
                      />
                      <button onClick={saveSettings} disabled={settingsSaving || !settingsName.trim()} className={styles.settingsSaveBtn}>
                        {settingsSaving ? '···' : 'Save'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Appearance / Theme */}
              <div className={styles.settingsSection}>
                <p className={styles.settingsSectionLabel}>Theme</p>
                <div className={styles.settingsCard}>
                  <div className={styles.settingsRow}>
                    <div className={styles.settingsRowLeft}>
                      <span className={styles.settingsRowLabel}>Color theme</span>
                      <span className={styles.settingsRowSub}>{activeTheme?.name || 'Classic'}</span>
                    </div>
                    <div className={styles.settingsRowRight}>
                      <div className={styles.themeSwatches}>
                        {THEMES.map(theme => {
                          const swatchBg = theme.id === 'midnight' ? '#000000' : theme.accent
                          return (
                            <div key={theme.id} className={styles.swatchWrap}>
                              <button title={theme.name}
                                onClick={() => saveTheme(theme)}
                                className={`${styles.accentSwatch} ${activeTheme?.id === theme.id ? styles.accentSwatchActive : ''}`}
                                style={{ background: swatchBg }}
                              />
                              <span className={styles.swatchLabel}>{theme.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Persona */}
              <div className={styles.settingsSection}>
                <p className={styles.settingsSectionLabel}>AI Persona</p>
                <div className={styles.settingsCard}>
                  <div className={styles.settingsRow}>
                    <div className={styles.settingsRowLeft}>
                      <span className={styles.settingsRowLabel}>Coaching style</span>
                      <span className={styles.settingsRowSub}>
                        {profile?.persona_blend?.length
                          ? profile.persona_blend.map(k => PERSONAS_LIST.find(p => p.key === k)?.label || k).join(' · ')
                          : 'Not set'}
                      </span>
                    </div>
                    <div className={styles.settingsRowRight}>
                      <button onClick={openPersonaModal} className={styles.connectionBtn}>Edit</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notification preferences */}
              <div className={styles.settingsSection}>
                <p className={styles.settingsSectionLabel}>Check-in notifications</p>
                <div className={styles.settingsCard}>
                  {[
                    { key: 'morning', label: 'Morning check-in', sub: 'Daily at 8am', val: notifMorning, set: setNotifMorning },
                    { key: 'midday', label: 'Midday check-in', sub: 'Daily at 12pm', val: notifMidday, set: setNotifMidday },
                    { key: 'evening', label: 'Evening wrap-up', sub: 'Daily at 9pm', val: notifEvening, set: setNotifEvening },
                  ].map(({ key, label, sub, val, set }) => (
                    <div key={key} className={`${styles.settingsRow} ${notifPermission !== 'granted' ? styles.settingsRowDisabled : ''}`}>
                      <div className={styles.settingsRowLeft}>
                        <span className={styles.settingsRowLabel}>{label}</span>
                        <span className={styles.settingsRowSub}>{sub}</span>
                      </div>
                      <button onClick={() => notifPermission === 'granted' && (set(v => !v))}
                        className={`${styles.notifToggle} ${val ? styles.notifToggleOn : ''}`} />
                    </div>
                  ))}
                  {notifPermission !== 'granted' && (
                    <p className={styles.notifDisabledNote}>Enable push notifications above to activate reminders</p>
                  )}
                  <div className={styles.settingsRow}>
                    <div className={styles.settingsRowLeft}>
                      <span className={styles.settingsRowLabel}>Push notifications</span>
                      <span className={styles.settingsRowSub}>Required for alarms &amp; check-ins</span>
                    </div>
                    {notifPermission === 'denied' ? (
                      <span className={styles.notifDeniedMsg}>Blocked in browser settings</span>
                    ) : profile?.push_notifications_enabled ? (
                      <button className={styles.notifEnabledBtn} onClick={handleDisablePush}>
                        Enabled ✓
                      </button>
                    ) : (
                      <button className={styles.connectionBtn} onClick={handleEnablePush}>
                        Enable
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Connections */}
              <div className={styles.settingsSection}>
                <p className={styles.settingsSectionLabel}>Connections</p>
                <div className={styles.settingsCard}>
                  {[
                    { name: 'Google Calendar', sub: 'Sync events to calendar view' },
                    { name: 'Spotify', sub: 'Play focus playlists' },
                    { name: 'Apple Music', sub: 'Play focus playlists' },
                    { name: 'Fitbit', sub: 'Track activity and sleep' },
                    { name: 'Oura Ring', sub: 'Track readiness and sleep' },
                  ].map(({ name, sub }) => (
                    <div key={name} className={styles.connectionRow}>
                      <div className={styles.connectionInfo}>
                        <span className={styles.connectionName}>{name}</span>
                        <span className={styles.connectionStatus}>{sub}</span>
                      </div>
                      <button className={styles.comingSoonBtn} disabled title="Integration coming in Phase 2">
                        Coming soon
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chore Cadence */}
              <div className={styles.settingsSection}>
                <p className={styles.settingsSectionLabel}>Chore Cadence</p>
                {CHORE_PRESETS.map(preset => {
                  const isActive = profile?.chore_preset === preset.id
                  return (
                    <div key={preset.id} className={`${styles.chorePresetCard} ${isActive ? styles.chorePresetCardActive : ''}`}>
                      <div>
                        <div className={styles.chorePresetName}>
                          {preset.name}
                          {isActive && <span className={styles.choreActiveBadge}>Active</span>}
                        </div>
                        <div className={styles.chorePresetDesc}>{preset.description}</div>
                      </div>
                      {isActive ? (
                        <button className={styles.choreRemoveBtn} onClick={async () => {
                          const { data: { session: choreSession } } = await supabase.auth.getSession()
                          await loggedFetch('/api/chores', {
                            method: 'DELETE',
                            headers: choreSession ? { Authorization: `Bearer ${choreSession.access_token}` } : {},
                          })
                          setProfile(prev => ({ ...prev, chore_preset: null }))
                          fetchTasks(user.id)
                          showToast('Chore routine removed')
                        }}>Remove</button>
                      ) : (
                        <button className={styles.choreSetupBtn} onClick={async () => {
                          const chorePreset = getChoresByPreset(preset.id)
                          if (!chorePreset) return
                          const today = new Date()
                          today.setHours(9, 0, 0, 0)
                          let weekdayIndex = 0
                          const choreTasks = chorePreset.chores.map(chore => {
                            let scheduledFor
                            if (chore.recurrence === 'daily') {
                              scheduledFor = new Date(today)
                            } else if (chore.recurrence === 'monthly') {
                              scheduledFor = new Date(today)
                              scheduledFor.setDate(scheduledFor.getDate() + 14)
                            } else {
                              // weekly, biweekly, twice-weekly → spread across next 7 days
                              scheduledFor = new Date(today)
                              scheduledFor.setDate(scheduledFor.getDate() + (weekdayIndex % 7))
                              weekdayIndex++
                            }
                            return {
                              user_id: user.id,
                              title: chore.title,
                              recurrence: chore.recurrence === 'daily' ? 'daily' : chore.recurrence === 'monthly' ? 'monthly' : 'weekly',
                              consequence_level: 'self',
                              completed: false,
                              archived: false,
                              rollover_count: 0,
                              priority_score: 0,
                              notes: null,
                              due_time: null,
                              scheduled_for: scheduledFor.toISOString(),
                              created_at: new Date().toISOString(),
                            }
                          })
                          await supabase.from('tasks').insert(choreTasks)
                          await supabase.from('profiles').update({ chore_preset: preset.id }).eq('id', user.id)
                          setProfile(prev => ({ ...prev, chore_preset: preset.id }))
                          fetchTasks(user.id)
                          showToast('Chore routine added to your tasks')
                        }}>Set up</button>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* How to get the most out of FocusBuddy */}
              <div className={styles.settingsSection}>
                <button className={styles.settingsTipsToggle} onClick={() => setShowGuideModal(true)}>
                  How to get the most out of FocusBuddy →
                </button>
              </div>
            </div>
          </TabErrorBoundary>
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

              {/* ── BILLS (existing content, untouched) ── */}
              {financeSub === 'bills' && (
                <>
                  <div className={styles.viewHeader}>
                    <div>
                      <h1 className={styles.greetingText}>Monthly expenses</h1>
                      <p className={styles.financeTotal}>{fmtMoney(monthlyTotal)}<span className={styles.financeTotalSub}>/mo</span></p>
                    </div>
                    <button onClick={() => setShowAddBillModal(true)} className={styles.addTaskBtn}>+ Add bill</button>
                  </div>

                  {bills.length === 0 ? (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>💳</div>
                      <p className={styles.emptyText}>No bills tracked yet.</p>
                      <p className={styles.emptySubtext}>Add your recurring expenses to track your monthly burn.</p>
                      <button onClick={() => setShowAddBillModal(true)} className={styles.emptyAddBtn}>+ Add your first bill</button>
                    </div>
                  ) : (
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

        </main>

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

        {/* ADD TASK MODAL */}
        {showAddModal && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && (setShowAddModal(false), resetForm(), setAddMode('single'), setBulkPreview([]), setBulkText(''))}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>New task</h2>
                <div className={styles.modalHeaderRight}>
                  {addMode === 'single' && (
                    <button type="button" onClick={listening ? stopListening : startListening}
                      className={`${styles.micBtn} ${listening ? styles.micBtnActive : ''}`}
                      title={listening ? 'Stop recording' : 'Speak your task'}>
                      {listening ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                      ) : (
                        <Microphone size={18} />
                      )}
                    </button>
                  )}
                  <button onClick={() => { setShowAddModal(false); resetForm(); setAddMode('single'); setBulkPreview([]); setBulkText('') }} className={styles.modalClose}>×</button>
                </div>
              </div>

              {/* Single / Bulk toggle */}
              <div className={styles.modeToggleRow}>
                <button type="button" onClick={() => setAddMode('single')}
                  className={`${styles.modeToggleBtn} ${addMode === 'single' ? styles.modeToggleBtnActive : ''}`}>
                  Single task
                </button>
                <button type="button" onClick={() => setAddMode('bulk')}
                  className={`${styles.modeToggleBtn} ${addMode === 'bulk' ? styles.modeToggleBtnActive : ''}`}>
                  Bulk import
                </button>
              </div>

              {addMode === 'single' && (
                <>
                  {(listening || parsing || voiceTranscript) && (
                    <div className={styles.voiceState}>
                      {listening && (
                        <div className={styles.voiceListening}>
                          <span className={styles.voiceDot} /><span className={styles.voiceDot} /><span className={styles.voiceDot} />
                          <span className={styles.voiceListeningText}>Listening...</span>
                        </div>
                      )}
                      {parsing && <div className={styles.voiceParsing}>Working out the details...</div>}
                      {voiceTranscript && !listening && !parsing && <div className={styles.voiceTranscript}>"{voiceTranscript}"</div>}
                    </div>
                  )}
                  <form onSubmit={addTask} className={styles.modalForm}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>What needs to get done?</label>
                      <input ref={titleInputRef} type="text" placeholder="e.g. Call the insurance company"
                        value={newTitle} onChange={e => { setNewTitle(e.target.value); if (titleInputError) setTitleInputError(false) }}
                        className={`${styles.fieldInput} ${titleInputError ? styles.titleInputError : ''}`} />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Due date</label>
                      <div className={styles.quickRow}>
                        <button type="button" onClick={() => setNewDueDate(todayStr())}
                          className={`${styles.quickBtn} ${newDueDate === todayStr() ? styles.quickBtnActive : ''}`}>Today</button>
                        <button type="button" onClick={() => setNewDueDate(tomorrowStr())}
                          className={`${styles.quickBtn} ${newDueDate === tomorrowStr() ? styles.quickBtnActive : ''}`}>Tomorrow</button>
                        <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className={styles.fieldInputCompact} />
                      </div>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Due time</label>
                      <div className={styles.quickRow}>
                        {[['Morning', '09:00'], ['Afternoon', '14:00'], ['Evening', '18:00']].map(([label, val]) => (
                          <button key={val} type="button"
                            onClick={() => { setNewDueTime(val); if (!newDueDate) setNewDueDate(todayStr()) }}
                            className={`${styles.quickBtn} ${newDueTime === val ? styles.quickBtnActive : ''}`}>{label}</button>
                        ))}
                        <span className={styles.orLabel}>or</span>
                        <input type="time" value={newDueTime} onChange={e => { setNewDueTime(e.target.value); if (!newDueDate) setNewDueDate(todayStr()) }}
                          className={styles.fieldInputCompact} />
                      </div>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Type</label>
                      <div className={styles.toggleRow}>
                        <button type="button" onClick={() => setNewConsequence('self')}
                          className={`${styles.toggleBtn} ${newConsequence === 'self' ? styles.toggleBtnActive : ''}`}>Personal</button>
                        <button type="button" onClick={() => setNewConsequence('external')}
                          className={`${styles.toggleBtn} ${newConsequence === 'external' ? styles.toggleBtnActive : ''}`}>External commitment</button>
                      </div>
                      <p className={styles.fieldHint}>
                        {newConsequence === 'external' ? 'Someone else is counting on this — it gets priority.' : 'This is for you — still important, context matters.'}
                      </p>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Repeat</label>
                      <div className={styles.toggleRow}>
                        {RECURRENCE_OPTIONS.map(opt => (
                          <button key={opt.value} type="button" onClick={() => setNewRecurrence(opt.value)}
                            className={`${styles.toggleBtn} ${newRecurrence === opt.value ? styles.toggleBtnActive : ''}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.fieldLabel}>Notes <span className={styles.fieldLabelOptional}>(optional)</span></label>
                      <input type="text" placeholder="Context that makes this easier to start"
                        value={newNotes} onChange={e => setNewNotes(e.target.value)} className={styles.fieldInput} />
                    </div>
                    <button type="submit" disabled={adding || !newTitle.trim()} className={styles.modalSubmit}>
                      {adding ? 'Adding...' : 'Add to my list'}
                    </button>
                  </form>
                </>
              )}

              {addMode === 'bulk' && (
                <div className={styles.modalForm}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Paste or speak your tasks — one per line</label>
                    <textarea
                      className={styles.bulkTextarea}
                      placeholder={"Call the insurance company\nPay electric bill by Friday\nSchedule dentist appointment next week\nReturn Amazon package"}
                      value={bulkText}
                      onChange={e => setBulkText(e.target.value)}
                    />
                  </div>
                  <div className={styles.bulkActionRow}>
                    <button type="button" onClick={() => navigator.clipboard.readText().then(t => setBulkText(prev => prev ? prev + '\n' + t : t)).catch(() => {})}
                      className={styles.bulkActionBtn}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                      Paste
                    </button>
                    <button type="button" onClick={bulkListening ? () => { bulkRecognitionRef.current?.stop(); setBulkListening(false) } : startBulkListening}
                      className={`${styles.bulkActionBtn} ${bulkListening ? styles.bulkActionBtnActive : ''}`}>
                      {bulkListening ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                      ) : (
                        <Microphone size={14} />
                      )}
                      {bulkListening ? 'Listening...' : 'Speak'}
                    </button>
                    <button type="button" onClick={parseBulkTasks} disabled={bulkParsing || !bulkText.trim()}
                      className={styles.bulkParseBtn}>
                      {bulkParsing ? 'Parsing...' : 'Parse →'}
                    </button>
                  </div>

                  {bulkPreview.length > 0 && (
                    <>
                      <div className={styles.fieldGroup} style={{ marginTop: '16px' }}>
                        <label className={styles.fieldLabel}>Preview — {bulkPreview.length} task{bulkPreview.length !== 1 ? 's' : ''}</label>
                        <div className={styles.bulkPreviewList}>
                          {bulkPreview.map((t, i) => (
                            <div key={t._id} className={styles.bulkPreviewItem}>
                              <input className={styles.bulkPreviewInput} value={t.title}
                                onChange={e => setBulkPreview(prev => prev.map((x, xi) => xi === i ? { ...x, title: e.target.value } : x))} />
                              {t.due_date && <span className={styles.bulkPreviewMeta}>{t.due_date}</span>}
                              <button type="button" onClick={() => setBulkPreview(prev => prev.filter((_, xi) => xi !== i))}
                                className={styles.bulkPreviewRemove}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={addAllBulkTasks} className={styles.modalSubmit}>
                        Add all {bulkPreview.length} task{bulkPreview.length !== 1 ? 's' : ''}
                      </button>
                    </>
                  )}
                </div>
              )}
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

        {/* GUIDE MODAL */}
        {showGuideModal && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowGuideModal(false)}>
            <div className={styles.modal} style={{ maxWidth: '640px' }}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>FocusBuddy Guide</h2>
                <button onClick={() => setShowGuideModal(false)} className={styles.modalClose}>×</button>
              </div>
              <div className={styles.guideContent}>
                {[
                  { title: 'What is FocusBuddy?', body: "FocusBuddy is a personal productivity coach that works like a smart friend, not a corporate app. It knows your tasks, understands how you work, and checks in with you to keep things moving — morning, midday, and evening.\n\nIt's built for people who struggle with task initiation, time blindness, or just need accountability that doesn't feel like a burden." },
                  { title: 'The Check-in', body: "Three times a day, FocusBuddy reaches out — morning to set your priority, midday to check on progress, evening to wrap up. Each check-in is a real conversation. Tell it what happened, what's blocked, or what moved. It adjusts your task list automatically." },
                  { title: 'Your Task Deck', body: 'Tasks are ranked by priority score — external commitments, overdue items, and rolled-over tasks rise to the top. You can drag to reorder. Add tasks by typing or by speaking (tap the mic). Voice input understands natural language like "dentist appointment Friday at 3pm".' },
                  { title: 'Focus Sessions', body: 'The Focus tab starts a countdown timer for your top task — 15, 25, or 45 minutes. When it ends, you report how it went. "Nailed it" marks the task complete. "Made progress" keeps it active. "Got stuck" routes you to a coaching response from FocusBuddy.' },
                  { title: 'The Journal', body: 'Journal is a private space to think out loud. The AI listens, reflects back what it notices, and asks one good question. If you mention something that sounds like a task, it offers to add it. Your past entries are saved below each session.' },
                  { title: 'Your Persona', body: 'FocusBuddy has 6 coaching styles: Drill Sergeant (blunt, direct), Coach (warm, strategic), Thinking Partner (asks questions), Hype Person (celebrates every win), Strategist (systems and logic), and The Empath (emotionally attuned, meets you where you are). Mix up to 3 — your first choice is dominant.' },
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
            { icon: '💬', title: 'Your AI Coach Checks In', body: 'Three times a day — morning, midday, and evening — FocusBuddy reaches out. It knows your task list and coaches you in your style. The more you engage, the smarter it gets.' },
            { icon: '🎯', title: 'Lock In With Focus Mode', body: 'Pick a task, pick a duration (5 to 60 minutes), and go. When time\'s up, tell FocusBuddy how it went. Nailed it, made progress, or got stuck — each response shapes what happens next.' },
            { icon: '📓', title: 'Think Out Loud', body: 'The journal is your private space. FocusBuddy listens, reflects back what it notices, and asks one good question. If you mention something that sounds like a task, it offers to add it. Entries are saved automatically.' },
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
