import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Dashboard.module.css'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import SortableTaskCard from '../components/SortableTaskCard'
import { applyAccentColor, DEFAULT_ACCENTS } from '../lib/accentColor'
import { saveTaskOrder } from '../lib/taskOrder'
import { isDueSoon as billIsDueSoon, formatBillAmount, getBillCategory, getNextDueDate } from '../lib/billUtils'

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
]

function applyTheme(theme) {
  if (!theme || typeof document === 'undefined') return
  document.documentElement.style.setProperty('--accent', theme.accent)
  document.documentElement.style.setProperty('--accent-gradient', theme.gradient)
  document.documentElement.style.setProperty('--logo-color', theme.logo)
}

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
  { id: 'focus', label: 'Focus', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
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
  { id: 'finance', label: 'Finance', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  )},
  { id: 'progress', label: 'Progress', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )},
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

function getTaskOccurrencesForMonth(tasks, year, month) {
  const result = {}
  const addToDate = (dStr, task) => {
    if (!result[dStr]) result[dStr] = []
    result[dStr].push(task)
  }
  tasks.forEach(task => {
    if (task.archived) return
    const base = taskBaseDate(task)
    if (!base) return
    if (task.recurrence === 'daily') {
      for (let i = 0; i < 365; i++) {
        const d = new Date(base); d.setDate(d.getDate() + i)
        if (d.getFullYear() === year && d.getMonth() === month) addToDate(localDateStr(d), task)
      }
    } else if (task.recurrence === 'weekly') {
      for (let i = 0; i < 52; i++) {
        const d = new Date(base); d.setDate(d.getDate() + i * 7)
        if (d.getFullYear() === year && d.getMonth() === month) addToDate(localDateStr(d), task)
      }
    } else {
      if (base.getFullYear() === year && base.getMonth() === month) addToDate(localDateStr(base), task)
    }
  })
  return result
}

function formatTimer(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
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
  const [focusPhase, setFocusPhase] = useState('setup') // setup | active | complete | stuck
  const [focusDuration, setFocusDuration] = useState(25)
  const [focusCustom, setFocusCustom] = useState('')
  const [focusTimeLeft, setFocusTimeLeft] = useState(0)
  const [focusRunning, setFocusRunning] = useState(false)
  const [focusAiResponse, setFocusAiResponse] = useState('')
  const [focusAiLoading, setFocusAiLoading] = useState(false)
  const focusIntervalRef = useRef(null)

  // Progress
  const [weeklySummary, setWeeklySummary] = useState('')
  const [weeklySummaryLoading, setWeeklySummaryLoading] = useState(false)
  const [weeklySummaryInitialized, setWeeklySummaryInitialized] = useState(false)

  // Finance
  const [bills, setBills] = useState([])
  const [billsLoaded, setBillsLoaded] = useState(false)
  const [showAddBillModal, setShowAddBillModal] = useState(false)
  const [newBillName, setNewBillName] = useState('')
  const [newBillAmount, setNewBillAmount] = useState('')
  const [newBillDueDay, setNewBillDueDay] = useState('')
  const [newBillFrequency, setNewBillFrequency] = useState('monthly')
  const [newBillCategory, setNewBillCategory] = useState('Other')
  const [newBillAutoTask, setNewBillAutoTask] = useState(true)
  const [addingBill, setAddingBill] = useState(false)

  // Mobile more drawer
  const [showMoreDrawer, setShowMoreDrawer] = useState(false)

  // Themes
  const [activeTheme, setActiveTheme] = useState(THEMES[0])

  // Focus subtab
  const [focusSubTab, setFocusSubTab] = useState('session')

  // Progress time band
  const [progressBand, setProgressBand] = useState('week')

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

  // Journal reminder
  const [journalReminderShown, setJournalReminderShown] = useState(false)
  const [showJournalReminder, setShowJournalReminder] = useState(false)

  // Settings
  const [settingsName, setSettingsName] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [notifMorning, setNotifMorning] = useState(true)
  const [notifEvening, setNotifEvening] = useState(true)

  // Bill voice input
  const [billListening, setBillListening] = useState(false)
  const [billVoiceTranscript, setBillVoiceTranscript] = useState('')
  const [billParsing, setBillParsing] = useState(false)
  const billRecognitionRef = useRef(null)

  // ── Effects ──────────────────────────────────────────────────────────────

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
    }
  }, [detailTask?.id])

  useEffect(() => {
    if (!profile) return
    const themeId = profile.accent_color && profile.accent_color.startsWith('#')
      ? null // legacy hex color, map to closest or default
      : profile.accent_color
    const theme = THEMES.find(t => t.id === themeId) || THEMES.find(t => t.accent === profile.accent_color) || THEMES[0]
    setActiveTheme(theme)
    applyTheme(theme)
    if (profile.full_name) setSettingsName(profile.full_name)
  }, [profile])

  useEffect(() => {
    if (activeTab === 'checkin' && !checkinInitialized && user) {
      setCheckinInitialized(true)
      setCheckinLoading(true)
      fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, checkInType: getCheckinType() })
      })
        .then(r => r.json())
        .then(data => {
          if (data.message) setCheckinMessages([{ role: 'assistant', content: data.message }])
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
    if (activeTab === 'journal' && user && !journalEntriesLoaded) {
      fetchJournalEntries(user.id)
    }
  }, [activeTab, user])

  useEffect(() => {
    if (activeTab === 'progress' && user && !weeklySummaryInitialized) {
      fetchWeeklySummary()
    }
  }, [activeTab, user])

  useEffect(() => {
    if (activeTab === 'finance' && user && !billsLoaded) {
      fetchBills(user.id)
    }
  }, [activeTab, user])

  // Cleanup focus timer on unmount
  useEffect(() => {
    return () => clearInterval(focusIntervalRef.current)
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

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data)
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

  const fetchWeeklySummary = async () => {
    if (!user) return
    setWeeklySummaryInitialized(true)
    setWeeklySummaryLoading(true)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, checkInType: 'weekly_summary' })
      })
      const data = await res.json()
      setWeeklySummary(data.message || '')
    } catch {
      setWeeklySummary('')
    }
    setWeeklySummaryLoading(false)
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
    if (!newTitle.trim() || !user) return
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
        const res = await fetch('/api/parse-task', {
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
        const res = await fetch('/api/parse-bill', {
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
    const userMsg = { role: 'user', content: checkinInput.trim() }
    const updated = [...checkinMessages, userMsg]
    setCheckinMessages(updated); setCheckinInput(''); setCheckinLoading(true)
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, checkInType: getCheckinType(), messages: updated })
      })
      const data = await res.json()
      if (data.message) setCheckinMessages(prev => [...prev, { role: 'assistant', content: data.message }])
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
    const content = journalInput.trim()
    const newMsg = { role: 'user', content }
    setJournalMessages(prev => [...prev, newMsg])
    setJournalInput(''); setJournalLoading(true)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, content, conversationHistory: journalMessages })
      })
      const data = await res.json()
      setJournalMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      if (!journalReminderShown) { setJournalReminderShown(true); setShowJournalReminder(true) }
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
          setFocusRunning(false); setFocusPhase('complete')
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
            setFocusRunning(false); setFocusPhase('complete'); return 0
          }
          return prev - 1
        })
      }, 1000)
      setFocusRunning(true)
    }
  }

  const handleFocusResult = async (result) => {
    const dur = focusCustom ? parseInt(focusCustom) : focusDuration
    if (result === 'complete') {
      if (topTask) completeTask(topTask)
      setFocusPhase('setup'); setFocusCustom('')
    } else if (result === 'progress') {
      if (topTask) {
        await supabase.from('tasks').update({ notes: 'In progress' }).eq('id', topTask.id)
        setTasks(prev => prev.map(t => t.id === topTask.id ? { ...t, notes: 'In progress' } : t))
      }
      setFocusPhase('setup'); setFocusCustom('')
    } else if (result === 'stuck') {
      setFocusPhase('stuck'); setFocusAiLoading(true)
      try {
        const res = await fetch('/api/focus', {
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
      auto_task: newBillAutoTask, created_at: new Date().toISOString()
    }
    const { data } = await supabase.from('bills').insert(bill).select().single()
    if (data) setBills(prev => [data, ...prev])
    setNewBillName(''); setNewBillAmount(''); setNewBillDueDay('')
    setNewBillFrequency('monthly'); setNewBillCategory('Other'); setNewBillAutoTask(true)
    setAddingBill(false); setShowAddBillModal(false)
  }

  const deleteBill = async (id) => {
    await supabase.from('bills').delete().eq('id', id)
    setBills(prev => prev.filter(b => b.id !== id))
  }

  const saveSettings = async () => {
    if (!user || !settingsName.trim()) return
    setSettingsSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, updates: { full_name: settingsName.trim() } }),
    })
    setProfile(prev => ({ ...prev, full_name: settingsName.trim() }))
    setSettingsSaving(false)
    showToast('Settings saved')
  }

  const saveTheme = async (theme) => {
    applyTheme(theme)
    setActiveTheme(theme)
    setProfile(prev => ({ ...prev, accent_color: theme.id }))
    if (user) {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, updates: { accent_color: theme.id } }),
      })
    }
  }

  // ── Persona ───────────────────────────────────────────────────────────────

  const openPersonaModal = () => {
    setPersonaSelection(profile?.persona_blend || [])
    setPersonaVoice(profile?.persona_voice || 'female')
    setShowPersonaModal(true)
  }

  const savePersona = async () => {
    if (!personaSelection.length || !user) return
    setPersonaSaving(true)
    const updates = { persona_blend: personaSelection, persona_voice: personaVoice, persona_set: true }
    await supabase.from('profiles').update(updates).eq('id', user.id)
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

  const handleRunRollover = async () => {
    try {
      const res = await fetch('/api/rollover-tasks', { method: 'POST' })
      const data = await res.json()
      showToast(`Rolled ${data.rolled} task${data.rolled !== 1 ? 's' : ''}`)
      if (data.rolled > 0) fetchTasks(user.id)
    } catch { showToast('Rollover failed') }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut(); router.push('/')
  }

  const showToast = (msg) => {
    setToast(msg); setTimeout(() => setToast(null), 2500)
  }

  const switchTab = (id) => {
    setActiveTab(id); setShowMoreDrawer(false)
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = pendingTasks.findIndex(t => t.id === active.id)
    const newIndex = pendingTasks.findIndex(t => t.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(pendingTasks, oldIndex, newIndex)
    // Optimistic update: merge reordered pending with completed
    setTasks([...reordered, ...completedTasks])
    await saveTaskOrder(supabase, reordered)
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────

  function calTasksForDay(dStr) {
    const [y, m, d] = dStr.split('-').map(Number)
    const target = new Date(y, m - 1, d)
    return tasks.filter(t => {
      if (t.archived) return false
      const base = taskBaseDate(t)
      if (!base) return false
      if (t.recurrence === 'daily') return target >= base
      if (t.recurrence === 'weekly') {
        if (target < base) return false
        const diffDays = Math.round((target - base) / 86400000)
        return diffDays % 7 === 0
      }
      return localDateStr(base) === dStr
    })
  }

  function calPrevMonth() { setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1)) }
  function calNextMonth() { setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1)) }

  // ── Derived values ────────────────────────────────────────────────────────

  const pendingTasks = sortByPriority(tasks.filter(t => !t.completed))
  const completedTasks = tasks.filter(t => t.completed)
  const rawName = profile?.full_name || ''
  const firstName = rawName.includes('@') ? 'there' : (rawName.split(' ')[0] || 'there')
  const topTask = pendingTasks[0] || null
  const restTasks = pendingTasks.slice(1)

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
      const day = new Date(t.completed_at).toLocaleDateString('en-US', { weekday: 'short' })
      dayCounts[day] = (dayCounts[day] || 0) + 1
    })
    if (!Object.keys(dayCounts).length) return 'N/A'
    return Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0][0]
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
      <div className={styles.appShell} style={{ background: `var(--accent-gradient), #110d06` }}>

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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
              </svg>
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
                            setNewTitle(`First step: ${topTask.title}`); setShowAddModal(true)
                          }}>· Break it down →</button>
                        )}
                      </div>
                    )}
                    <div className={styles.focusCardBody}>
                      <button onClick={() => completeTask(topTask)} className={styles.focusCheck} aria-label="Complete task" />
                      <div className={styles.focusTaskInfo} onClick={() => setDetailTask(topTask)} style={{ cursor: 'pointer' }}>
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
                        {topTask.notes && <span className={styles.focusNotes}>{topTask.notes}</span>}
                        <div className={styles.focusBadgeRow}>
                          {topTask.consequence_level === 'external' && <span className={styles.externalBadge}>External commitment</span>}
                          {topTask.recurrence && topTask.recurrence !== 'none' && (
                            <span className={styles.recurrenceBadge}>{topTask.recurrence === 'daily' ? '↻ Daily' : '↻ Weekly'}</span>
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

              {restTasks.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={restTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    <div className={styles.taskGroup}>
                      <div className={styles.taskGroupLabel}>Up next</div>
                      {restTasks.map(task => {
                        const dueFmt = task.due_time ? formatDueTime(task.due_time) : null
                        return (
                          <SortableTaskCard key={task.id} id={task.id}>
                            <div className={styles.taskCard}>
                              <button onClick={() => completeTask(task)} className={styles.taskCheck} aria-label="Complete" />
                              <div className={styles.taskInfo} onClick={() => setDetailTask(task)} style={{ cursor: 'pointer' }}>
                                <span className={styles.taskTitle}>{task.title}</span>
                                {task.notes && <span className={styles.taskNotes}>{task.notes}</span>}
                                <div className={styles.taskMeta}>
                                  {dueFmt && <span className={`${styles.taskDueTime} ${dueFmt.urgent ? styles.taskDueUrgent : ''}`}>{dueFmt.label}</span>}
                                  {task.rollover_count > 0 && <span className={styles.taskRollover}>↷ {task.rollover_count}×</span>}
                                  {task.consequence_level === 'external' && <span className={styles.taskExternal}>External</span>}
                                  {task.recurrence && task.recurrence !== 'none' && <span className={styles.taskRecurrence}>↻ {task.recurrence}</span>}
                                </div>
                              </div>
                              <div className={styles.taskActions}>
                                <button onClick={() => rescheduleTask(task)} className={styles.taskAction} title="Push to tomorrow">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                                </button>
                                <button onClick={() => archiveTask(task)} className={styles.taskActionDelete} title="Remove">×</button>
                              </div>
                            </div>
                          </SortableTaskCard>
                        )
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {pendingTasks.length === 0 && completedTasks.length === 0 && (
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
                          {item.type === 'bill' && item.amount ? ` · $${parseFloat(item.amount).toFixed(0)}` : ''}
                        </span>
                      </div>
                      <span className={`${styles.comingUpDue} ${item.daysUntil <= 1 ? styles.comingUpDueSoon : ''}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {completedTasks.length > 0 && (
                <div className={styles.taskGroup} style={{ marginTop: '32px' }}>
                  <div className={styles.taskGroupLabel}>Done today · {completedTasks.length} {completedTasks.length === 1 ? 'win' : 'wins'} 🔥</div>
                  {completedTasks.map(task => (
                    <div key={task.id} className={`${styles.taskCard} ${styles.taskDone}`}>
                      <button onClick={() => uncompleteTask(task)} className={`${styles.taskCheck} ${styles.taskCheckDone}`}>✓</button>
                      <div className={styles.taskInfo}><span className={styles.taskTitleDone}>{task.title}</span></div>
                      <button onClick={() => archiveTask(task)} className={styles.taskActionDelete} title="Remove">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CHECK-IN ── */}
          {activeTab === 'checkin' && (() => {
            const type = getCheckinType()
            const typeLabel = type === 'morning' ? 'Morning check-in' : type === 'midday' ? 'Midday check-in' : 'Evening check-in'
            const personaLabel = (() => {
              const blend = profile?.persona_blend
              if (!blend || blend.length === 0) return 'Default coaching style'
              const nameMap = { drill_sergeant: 'The Drill Sergeant', coach: 'The Coach', thinking_partner: 'The Thinking Partner', hype_person: 'The Hype Person', strategist: 'The Strategist' }
              return blend.map(k => nameMap[k] || k).join(' · ')
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3L2 6"/><path d="M22 6l-3-3"/></svg>
                    </button>
                    <button onClick={() => setActiveTab('tasks')} className={styles.checkinSkipBtn}>Skip to tasks</button>
                  </div>
                </div>
                <div className={styles.checkinMessages}>
                  <div className={styles.checkinSpacer} />
                  {checkinMessages.map((msg, i) => (
                    <div key={i} className={msg.role === 'assistant' ? styles.checkinBubbleAI : styles.checkinBubbleUser}>
                      {msg.content}
                    </div>
                  ))}
                  {checkinLoading && <div className={styles.checkinBubbleAI}><span className={styles.checkinTyping}>···</span></div>}
                  <div ref={checkinEndRef} />
                </div>
                <form onSubmit={sendCheckinMessage} className={styles.checkinForm}>
                  <input type="text" placeholder="Reply..." value={checkinInput}
                    onChange={e => setCheckinInput(e.target.value)}
                    className={styles.checkinInput} autoFocus />
                  <button type="submit" disabled={checkinLoading || !checkinInput.trim()} className={styles.checkinSendBtn}>→</button>
                </form>
              </div>
            )
          })()}

          {/* ── FOCUS ── */}
          {activeTab === 'focus' && (
            <div className={styles.focusView}>
              {/* Sub-tab nav */}
              <div className={styles.focusSubNav}>
                {[['session','Session'],['fuel','Fuel'],['move','Move'],['supplements','Supplements']].map(([id, label]) => (
                  <button key={id} onClick={() => setFocusSubTab(id)}
                    className={`${styles.focusSubNavBtn} ${focusSubTab === id ? styles.focusSubNavBtnActive : ''}`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* SESSION */}
              {focusSubTab === 'session' && <>
                {focusPhase === 'setup' && (
                  <div className={styles.focusSetup}>
                    <p className={styles.focusSetupLabel}>Priority task</p>
                    <h2 className={styles.focusSetupTask}>{topTask?.title || 'No tasks — add one first'}</h2>
                    {topTask && (
                      <>
                        <p className={styles.focusDurationLabel}>Session length</p>
                        <div className={styles.focusDurationRow}>
                          {[15, 25, 45].map(d => (
                            <button key={d}
                              onClick={() => { setFocusDuration(d); setFocusCustom('') }}
                              className={`${styles.focusDurationBtn} ${focusDuration === d && !focusCustom ? styles.focusDurationBtnActive : ''}`}>
                              {d}m
                            </button>
                          ))}
                          <input type="number" placeholder="Custom" value={focusCustom}
                            onChange={e => { setFocusCustom(e.target.value); setFocusDuration(0) }}
                            className={styles.focusCustomInput} min="1" max="180" />
                        </div>
                        <button onClick={startFocus} className={styles.focusStartBtn}>Start session →</button>
                      </>
                    )}
                    {!topTask && <button onClick={() => setShowAddModal(true)} className={styles.focusStartBtn}>+ Add a task</button>}
                    <div className={styles.focusMusicStub}>
                      🎵 Music — connect Spotify, Apple Music, or YouTube in Settings
                    </div>
                  </div>
                )}
                {focusPhase === 'active' && (
                  <div className={styles.focusActive}>
                    <p className={styles.focusActiveTask}>{topTask?.title}</p>
                    <div className={styles.focusTimerDisplay}>{formatTimer(focusTimeLeft)}</div>
                    <button onClick={toggleFocusPause} className={styles.focusPauseBtn}>{focusRunning ? 'Pause' : 'Resume'}</button>
                    <button onClick={() => { clearInterval(focusIntervalRef.current); setFocusPhase('setup') }} className={styles.focusAbandonBtn}>Abandon session</button>
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
              </>}

              {/* FUEL */}
              {focusSubTab === 'fuel' && (
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
              )}

              {/* MOVE */}
              {focusSubTab === 'move' && (
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
              )}

              {/* SUPPLEMENTS */}
              {focusSubTab === 'supplements' && (
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
              )}
            </div>
          )}

          {/* ── CALENDAR ── */}
          {activeTab === 'calendar' && (() => {
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
                            <div key={t.id} className={`${styles.calTaskChip} ${t.completed ? styles.calTaskChipDone : ''} ${t.consequence_level === 'external' ? styles.calTaskChipExt : ''}`}>
                              <button onClick={() => t.completed ? uncompleteTask(t) : completeTask(t)} className={styles.calChipCheck}>{t.completed ? '✓' : ''}</button>
                              <div className={styles.calChipBody} onClick={() => setDetailTask(t)}>
                                <span className={styles.calChipTitle}>{t.title}</span>
                                <div className={styles.calChipBadges}>
                                  {t.consequence_level === 'external' && <span className={styles.calChipExtBadge}>Ext</span>}
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
                      return (
                        <div key={h} className={`${styles.calHourSlot} ${slotTasks.length > 0 ? styles.calHourSlotFilled : ''}`}>
                          <div className={styles.calHourLabel}>{label}</div>
                          <div className={styles.calHourLine} />
                          <div className={styles.calHourTasks}>
                            {slotTasks.map(t => (
                              <div key={t.id} className={`${styles.calTaskChip} ${t.completed ? styles.calTaskChipDone : ''} ${t.consequence_level === 'external' ? styles.calTaskChipExt : ''}`}>
                                <button onClick={() => t.completed ? uncompleteTask(t) : completeTask(t)} className={styles.calChipCheck}>{t.completed ? '✓' : ''}</button>
                                <div className={styles.calChipBody} onClick={() => setDetailTask(t)}>
                                  <span className={styles.calChipTitle}>{t.title}</span>
                                  <div className={styles.calChipBadges}>
                                    {t.consequence_level === 'external' && <span className={styles.calChipExtBadge}>Ext</span>}
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
                </div>
              )
            }

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
              </div>
            )
          })()}

          {/* ── JOURNAL ── */}
          {activeTab === 'journal' && (
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
                    {[['Daily', 'daily'], ['Weekly', 'weekly']].map(([label, rec]) => (
                      <button key={rec} className={styles.journalTaskYes} onClick={async () => {
                        await addTaskQuick(`Journal session`)
                        setShowJournalReminder(false)
                        showToast(`${label} journal reminder added`)
                      }}>{label}</button>
                    ))}
                    <button className={styles.journalTaskNo} onClick={() => setShowJournalReminder(false)}>No thanks</button>
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
              <form onSubmit={sendJournalMessage} className={styles.journalForm}>
                <textarea placeholder="What's on your mind..."
                  value={journalInput} onChange={e => setJournalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendJournalMessage(e) } }}
                  className={styles.journalTextarea} rows={3} />
                <div className={styles.journalFormFooter}>
                  <span className={styles.journalHint}>Shift+Enter for new line</span>
                  <button type="submit" disabled={journalLoading || !journalInput.trim()} className={styles.journalSendBtn}>Send →</button>
                </div>
              </form>

              {/* Past entries deck — below the input */}
              {journalEntries.length > 0 && (
                <div className={styles.journalPast} style={{ marginTop: '36px' }}>
                  <p className={styles.journalPastLabel}>Past entries</p>
                  {journalEntries.map(entry => (
                    <div key={entry.id} className={styles.journalPastEntry}
                      onClick={() => setJournalExpandedEntry(journalExpandedEntry === entry.id ? null : entry.id)}>
                      <div className={styles.journalPastEntryHeader}>
                        <span className={styles.journalPastDate}>
                          {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {' · '}
                          {new Date(entry.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <span className={styles.journalPastPreview}>
                          {journalExpandedEntry === entry.id ? entry.content : `${entry.content.slice(0, 72)}${entry.content.length > 72 ? '…' : ''}`}
                        </span>
                      </div>
                      {journalExpandedEntry === entry.id && entry.ai_response && (
                        <div className={styles.journalPastResponse}>{entry.ai_response}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PROGRESS ── */}
          {activeTab === 'progress' && (
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
                const todayTasks = tasks.filter(t => t.completed && t.completed_at && new Date(t.completed_at).toDateString() === new Date().toDateString())
                const todayJournalCount = journalEntries.filter(e => new Date(e.created_at).toDateString() === new Date().toDateString()).length
                return (
                  <div>
                    <div className={styles.progressStats}>
                      <div className={styles.progressStat}><span className={styles.progressStatNum}>{todayTasks.length}</span><span className={styles.progressStatLabel}>Done today</span></div>
                      <div className={styles.progressStat}><span className={styles.progressStatNum}>{pendingTasks.length}</span><span className={styles.progressStatLabel}>Still pending</span></div>
                      <div className={styles.progressStat}><span className={styles.progressStatNum}>{todayJournalCount}</span><span className={styles.progressStatLabel}>Journal entries</span></div>
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
                    ) : <div className={styles.progressEmpty}><p className={styles.emptyText}>Nothing completed yet today.</p><p className={styles.emptySubtext}>Complete a task to see it here.</p></div>}
                  </div>
                )
              })()}

              {progressBand === 'week' && (
                <div>
                  <div className={styles.progressStats}>
                    <div className={styles.progressStat}><span className={styles.progressStatNum}>{completedThisWeek.length}</span><span className={styles.progressStatLabel}>Completed</span></div>
                    <div className={styles.progressStat}><span className={styles.progressStatNum}>{getStreak()}</span><span className={styles.progressStatLabel}>Day streak</span></div>
                    <div className={styles.progressStat}><span className={styles.progressStatNum}>{getBestDay()}</span><span className={styles.progressStatLabel}>Best day</span></div>
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
                    {weeklySummaryLoading ? <p className={styles.progressSummaryLoading}>···</p>
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
                      <div className={styles.progressStat}><span className={styles.progressStatNum}>{getBestDay()}</span><span className={styles.progressStatLabel}>Best day</span></div>
                    </div>
                    <div className={styles.progressSummaryCard}>
                      <p className={styles.progressSummaryLabel}>Monthly insight</p>
                      {weeklySummaryLoading ? <p className={styles.progressSummaryLoading}>···</p>
                        : weeklySummary ? <p className={styles.progressSummaryText}>{weeklySummary}</p>
                        : <button onClick={fetchWeeklySummary} className={styles.progressSummaryRefresh}>Generate insight</button>}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeTab === 'settings' && (
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
                        {THEMES.map(theme => (
                          <button key={theme.id} title={theme.name}
                            onClick={() => saveTheme(theme)}
                            className={`${styles.accentSwatch} ${activeTheme?.id === theme.id ? styles.accentSwatchActive : ''}`}
                            style={{ background: theme.accent }}
                          />
                        ))}
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
                    { key: 'evening', label: 'Evening wrap-up', sub: 'Daily at 9pm', val: notifEvening, set: setNotifEvening },
                  ].map(({ key, label, sub, val, set }) => (
                    <div key={key} className={styles.settingsRow}>
                      <div className={styles.settingsRowLeft}>
                        <span className={styles.settingsRowLabel}>{label}</span>
                        <span className={styles.settingsRowSub}>{sub}</span>
                      </div>
                      <button onClick={() => { set(v => !v); if (!val && typeof Notification !== 'undefined') Notification.requestPermission() }}
                        className={`${styles.notifToggle} ${val ? styles.notifToggleOn : ''}`} />
                    </div>
                  ))}
                  <div className={styles.settingsRow}>
                    <div className={styles.settingsRowLeft}>
                      <span className={styles.settingsRowLabel}>Push notifications</span>
                      <span className={styles.settingsRowSub}>Required for alarms &amp; check-ins</span>
                    </div>
                    <button className={styles.connectionBtn} onClick={() => typeof Notification !== 'undefined' && Notification.requestPermission().then(p => showToast(p === 'granted' ? 'Notifications enabled' : 'Permission denied'))}>
                      Enable
                    </button>
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
                      <button className={styles.connectionBtn} onClick={() => showToast(`${name} coming soon`)}>
                        Connect
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* How to get the most out of FocusBuddy */}
              <div className={styles.settingsSection}>
                <button className={styles.settingsTipsToggle} onClick={() => setShowGuideModal(true)}>
                  How to get the most out of FocusBuddy →
                </button>
              </div>
            </div>
          )}

          {/* ── FINANCE ── */}
          {activeTab === 'finance' && (
            <div className={styles.view}>
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
            </div>
          )}

        </main>

        {/* BOTTOM NAV (mobile) */}
        <nav className={styles.bottomNav}>
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
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                </span>
                <span>Settings</span>
              </button>
            </div>
          </div>
        )}

        {/* ADD TASK MODAL */}
        {showAddModal && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>New task</h2>
                <div className={styles.modalHeaderRight}>
                  <button type="button" onClick={listening ? stopListening : startListening}
                    className={`${styles.micBtn} ${listening ? styles.micBtnActive : ''}`}
                    title={listening ? 'Stop recording' : 'Speak your task'}>
                    {listening ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    )}
                  </button>
                  <button onClick={() => { setShowAddModal(false); resetForm() }} className={styles.modalClose}>×</button>
                </div>
              </div>

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
                    value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    className={styles.fieldInput} required />
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
                        className={`${styles.quickBtn} ${newDueTime === val ? styles.quickBtnActive : ''}`}
                        disabled={!newDueDate}>{label}</button>
                    ))}
                    <input type="time" value={newDueTime} onChange={e => setNewDueTime(e.target.value)}
                      className={styles.fieldInputCompact} disabled={!newDueDate} />
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
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
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
                  <label className={styles.fieldLabel}>Frequency</label>
                  <div className={styles.toggleRow}>
                    {['monthly', 'weekly', 'yearly'].map(f => (
                      <button key={f} type="button" onClick={() => setNewBillFrequency(f)}
                        className={`${styles.toggleBtn} ${newBillFrequency === f ? styles.toggleBtnActive : ''}`}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
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

        {/* TASK DETAIL MODAL */}
        {detailTask && (
          <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setDetailTask(null)}>
            <div className={styles.modal}>
              <div className={styles.modalHeader}>
                <h2 className={styles.detailTitle}>{detailTask.title}</h2>
                <button onClick={() => setDetailTask(null)} className={styles.modalClose}>×</button>
              </div>
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
              <div className={styles.detailActions}>
                {detailTask.completed ? (
                  <button className={styles.detailBtnSecondary} onClick={() => { uncompleteTask(detailTask); setDetailTask(null) }}>Mark incomplete</button>
                ) : (
                  <button className={styles.detailBtnPrimary} onClick={() => { completeTask(detailTask); setDetailTask(null) }}>Mark complete</button>
                )}
                <button className={styles.detailBtnSecondary} onClick={() => { rescheduleTask(detailTask); setDetailTask(null) }}>Push to tomorrow</button>
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
    </>
  )
}
