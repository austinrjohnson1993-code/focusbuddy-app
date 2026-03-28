import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Dashboard.module.css'
import { House, CheckSquare, ChatCircle, Target, CalendarBlank, Wallet, ChartLineUp, Gear, ArrowCounterClockwise, UsersThree, BowlFood, Books } from '@phosphor-icons/react'
import { showToast as libShowToast, ToastContainer } from '../lib/toast.js'
import { applyAccentColor } from '../lib/accentColor'
import CinisMark from '../lib/CinisMark'
import { THEMES, applyTheme, TabErrorBoundary } from '../components/tabs/shared'
import VoiceFAB from '../components/VoiceFAB'
import TutorialOverlay from '../components/TutorialOverlay'
import WelcomeTransition from '../components/WelcomeTransition'

// Tab components
import TabTasks from '../components/tabs/TabTasks'
import TabCheckin from '../components/tabs/TabCheckin'
import TabFocus from '../components/tabs/TabFocus'
import TabCalendar from '../components/tabs/TabCalendar'
import TabHabits from '../components/tabs/TabHabits'
import TabTagTeam from '../components/tabs/TabTagTeam'
import TabFinance from '../components/tabs/TabFinance'
import TabNutrition from '../components/tabs/TabNutrition'
import TabProgress from '../components/tabs/TabProgress'
import TabGuide from '../components/tabs/TabGuide'
import TabSettings from '../components/tabs/TabSettings'
import TabDashboard from '../components/tabs/TabDashboard'

// ── Nav config ──────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: <House size={22} /> },
  { id: 'tasks', label: 'Tasks', icon: <CheckSquare size={22} /> },
  { id: 'checkin', label: 'Check-in', icon: <ChatCircle size={22} /> },
  { id: 'focus', label: 'Focus', icon: <Target size={22} /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarBlank size={22} /> },
  { id: 'habits', label: 'Habits', icon: <ArrowCounterClockwise size={22} /> },
  { id: 'tagteam', label: 'Tag Team', icon: <UsersThree size={22} /> },
  { id: 'finance', label: 'Finance', icon: <Wallet size={22} /> },
  { id: 'nutrition', label: 'Nutrition', icon: <BowlFood size={22} /> },
  { id: 'progress', label: 'Progress', icon: <ChartLineUp size={22} /> },
  { id: 'guide', label: 'Guide', icon: <Books size={22} /> },
  { id: 'settings', label: 'Settings', icon: <Gear size={22} /> },
]
const NAV_PRIMARY_IDS = ['home', 'tasks', 'checkin', 'focus', 'calendar']
const NAV_MORE_IDS = ['habits', 'tagteam', 'finance', 'nutrition', 'progress', 'guide', 'settings']

export default function Dashboard() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('home')
  const [greeting, setGreeting] = useState('')
  const [activeTheme, setActiveTheme] = useState(THEMES[0])
  const [showMoreDrawer, setShowMoreDrawer] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)

  // Voice FAB
  const [voiceFabState, setVoiceFabState] = useState('idle')
  const voiceFabRecognitionRef = useRef(null)
  const debugRef = useRef({ lastCall: null, lastError: null })

  const loggedFetch = useCallback(async (url, opts = {}) => {
    const t0 = Date.now()
    try {
      // Inject Supabase auth token for API routes
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (token) {
        opts.headers = { ...opts.headers, Authorization: `Bearer ${token}` }
      }
      const res = await fetch(url, opts)
      const clone = res.clone()
      const text = await clone.text().catch(() => '')
      debugRef.current.lastCall = { endpoint: url, method: opts.method || 'GET', status: res.status, ms: Date.now() - t0, preview: text.slice(0, 120) }
      return new Response(text, { status: res.status, headers: res.headers })
    } catch (err) {
      debugRef.current.lastCall = { endpoint: url, method: opts.method || 'GET', status: 'ERR', ms: Date.now() - t0, preview: String(err) }
      debugRef.current.lastError = String(err)
      throw err
    }
  }, [])

  const showToast = (msg) => libShowToast(msg)
  const switchTab = (id) => { setActiveTab(id); setShowMoreDrawer(false) }

  // ── Auth + data fetch ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedColor = localStorage.getItem('cinis_accent_color') || localStorage.getItem('fb_accent_color')
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

  const fetchProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      setProfile(data)
      if (data.accent_color) {
        const savedTheme = THEMES.find(t => t.id === data.accent_color) || THEMES.find(t => t.accent === data.accent_color) || THEMES[0]
        applyTheme(savedTheme)
        setActiveTheme(savedTheme)
        if (typeof localStorage !== 'undefined') localStorage.setItem('cinis_accent_color', savedTheme.id)
      }
      // Show welcome transition for first-time users, then tutorial
      const hasSeenWelcome = typeof localStorage !== 'undefined' && localStorage.getItem('cinis_welcome_seen')
      if (!hasSeenWelcome && data.onboarding_complete) {
        setShowWelcome(true)
      } else if (data.tutorial_completed === false) {
        setShowTutorial(true)
      }
    } else {
      router.push('/onboarding')
    }
  }

  const handleWelcomeComplete = () => {
    setShowWelcome(false)
    // After welcome, show tutorial if not completed
    if (profile && profile.tutorial_completed === false) {
      setShowTutorial(true)
    }
  }

  const handleTutorialComplete = async () => {
    setShowTutorial(false)
    if (user) {
      await supabase.from('profiles').update({ tutorial_completed: true }).eq('id', user.id)
      setProfile(prev => prev ? { ...prev, tutorial_completed: true } : prev)
    }
  }

  const fetchTasks = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('tasks').select('*').eq('user_id', userId).eq('archived', false)
        .order('sort_order', { ascending: true, nullsLast: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      setTasks(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const hasSession = { current: false }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        hasSession.current = true
        setUser(session.user)
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          fetchProfile(session.user.id)
          fetchTasks(session.user.id)
        }
      } else if (event === 'SIGNED_OUT' && hasSession.current) {
        router.push('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Voice FAB ────────────────────────────────────────────────────────────
  const startVoiceFab = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { libShowToast('Voice input not supported in this browser.', { type: 'error' }); return }
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
    recognition.onerror = () => { setVoiceFabState('idle'); libShowToast('Could not hear you. Try again.', { type: 'error' }) }
    recognition.onend = () => setVoiceFabState(prev => prev === 'recording' ? 'idle' : prev)
    voiceFabRecognitionRef.current = recognition
    recognition.start()
  }
  const stopVoiceFab = () => voiceFabRecognitionRef.current?.stop()
  const handleVoiceFabClick = () => {
    if (voiceFabState === 'idle') startVoiceFab()
    else if (voiceFabState === 'recording') stopVoiceFab()
  }
  const handleVoiceInput = async (transcript) => {
    try {
      const res = await loggedFetch('/api/voice/parse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: transcript }) })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed')
      setVoiceFabState('idle')
      if (user) fetchTasks(user.id)
      libShowToast(`Created: ${data.message}`, { type: 'undo', duration: 5000, undoCallback: () => handleUndoVoiceTask(data.record.id, data.type) })
    } catch { setVoiceFabState('idle'); libShowToast('Could not create task. Try again.', { type: 'error' }) }
  }
  const handleUndoVoiceTask = async (id, type) => {
    try {
      if (type === 'bill') await loggedFetch(`/api/bills/${id}`, { method: 'DELETE' })
      else await loggedFetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived: true }) })
      if (user) fetchTasks(user.id)
      libShowToast('Undone.', { type: 'success', duration: 2000 })
    } catch { libShowToast('Could not undo. Try again.', { type: 'error' }) }
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/') }
  const handleRunRollover = async () => {
    try {
      const res = await loggedFetch('/api/rollover-tasks', { method: 'POST' })
      const data = await res.json()
      showToast(`Rolled ${data.rolled} task${data.rolled !== 1 ? 's' : ''}`)
      if (data.rolled > 0 && user) fetchTasks(user.id)
    } catch { showToast('Rollover failed') }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className={styles.loadingPage}>
      <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '1.3rem', letterSpacing: '0.16em', color: '#F5F0E3' }}>CINIS</span>
    </div>
  )

  const tabProps = { user, profile, setProfile, tasks, setTasks, showToast, loggedFetch, switchTab }

  return (
    <>
      <Head><title>Dashboard — Cinis</title></Head>
      <div className={styles.appShell}>

        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarLogo}>
            <CinisMark size={24} aria-hidden="true" style={{ flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.16em', color: '#F5F0E3' }}>CINIS</span>
              <span style={{ fontFamily: "'Figtree', sans-serif", fontSize: '0.62rem', color: 'rgba(245,240,227,0.3)', letterSpacing: '0.01em', lineHeight: 1 }}>Where start meets finished.</span>
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
            {profile?.session_count > 0 && (
              <span className={styles.sessionBadge}>Session #{profile.session_count}</span>
            )}
            <span className={styles.sidebarEmail}>{user?.email}</span>
            <button onClick={handleSignOut} className={styles.signOutBtn}>Sign out</button>
            <button onClick={handleRunRollover} className={styles.rolloverDevBtn}>Run rollover</button>
          </div>
        </aside>

        {/* MAIN */}
        <main className={styles.main}>
          {activeTab === 'home' && <TabErrorBoundary tabName="Home"><TabDashboard {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'tasks' && <TabErrorBoundary tabName="Tasks"><TabTasks {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'checkin' && <TabErrorBoundary tabName="Check-in"><TabCheckin {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'focus' && <TabErrorBoundary tabName="Focus"><TabFocus {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'calendar' && <TabErrorBoundary tabName="Calendar"><TabCalendar {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'habits' && <TabErrorBoundary tabName="Habits"><TabHabits {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'tagteam' && <TabErrorBoundary tabName="Tag Team"><TabTagTeam {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'finance' && <TabErrorBoundary tabName="Finance"><TabFinance {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'nutrition' && <TabErrorBoundary tabName="Nutrition"><TabNutrition {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'progress' && <TabErrorBoundary tabName="Progress"><TabProgress {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'guide' && <TabErrorBoundary tabName="Guide"><TabGuide {...tabProps} /></TabErrorBoundary>}
          {activeTab === 'settings' && <TabErrorBoundary tabName="Settings"><TabSettings {...tabProps} activeTheme={activeTheme} setActiveTheme={setActiveTheme} /></TabErrorBoundary>}
        </main>

        {/* VOICE FAB */}
        <VoiceFAB
          state={voiceFabState}
          onClick={handleVoiceFabClick}
          hide={activeTab === 'focus'}
        />

        {/* TOAST */}
        <ToastContainer />

        {/* BOTTOM NAV (mobile) */}
        <nav className={styles.bottomNav} aria-label="Mobile navigation">
          {/* Left: home, tasks */}
          {['home', 'tasks'].map(id => {
            const item = NAV_ITEMS.find(i => i.id === id)
            return (
              <button key={id} onClick={() => switchTab(id)}
                className={`${styles.bottomNavItem} ${activeTab === id ? styles.bottomNavItemActive : ''}`}>
                <span className={styles.bottomNavIcon}>{item.icon}</span>
                <span className={styles.bottomNavLabel}>{item.label}</span>
              </button>
            )
          })}

          {/* Center: voice FAB (mobile) */}
          <VoiceFAB
            state={voiceFabState}
            onClick={handleVoiceFabClick}
            hide={false}
          />

          {/* Right: focus */}
          <button onClick={() => switchTab('focus')}
            className={`${styles.bottomNavItem} ${activeTab === 'focus' ? styles.bottomNavItemActive : ''}`}>
            <span className={styles.bottomNavIcon}><Target size={22} /></span>
            <span className={styles.bottomNavLabel}>Focus</span>
          </button>

          {/* More (calendar + secondary items) */}
          <button
            onClick={() => setShowMoreDrawer(true)}
            className={`${styles.bottomNavItem} ${['checkin', 'calendar', ...NAV_MORE_IDS].includes(activeTab) ? styles.bottomNavItemActive : ''}`}>
            <span className={styles.bottomNavIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
              </svg>
            </span>
            <span className={styles.bottomNavLabel}>More</span>
          </button>
        </nav>

        {/* WELCOME TRANSITION */}
        {showWelcome && (
          <WelcomeTransition
            name={profile?.full_name?.split(' ')[0] || 'there'}
            onComplete={handleWelcomeComplete}
          />
        )}

        {/* TUTORIAL OVERLAY */}
        {showTutorial && (
          <TutorialOverlay
            userName={profile?.full_name?.split(' ')[0] || ''}
            onComplete={handleTutorialComplete}
          />
        )}

        {/* MORE DRAWER (mobile) — includes calendar */}
        {showMoreDrawer && (
          <div className={styles.moreDrawerOverlay} onClick={() => setShowMoreDrawer(false)}>
            <div className={styles.moreDrawer} onClick={e => e.stopPropagation()}>
              <div className={styles.moreDrawerHandle} />
              {NAV_ITEMS.filter(i => ['checkin', 'calendar', ...NAV_MORE_IDS].includes(i.id)).map(item => (
                <button key={item.id} onClick={() => switchTab(item.id)}
                  className={`${styles.moreDrawerItem} ${activeTab === item.id ? styles.moreDrawerItemActive : ''}`}>
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </>
  )
}
