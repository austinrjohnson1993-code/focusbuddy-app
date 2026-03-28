import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { THEMES, applyTheme, PERSONAS_LIST } from './shared'
import styles from '../../styles/TabSettings.module.css'

/* ── VAPID helper ──────────────────────────────────────────────────────────── */
function urlBase64ToUint8Array(base64String) {
  const clean = (base64String || '').trim()
  const padding = '='.repeat((4 - clean.length % 4) % 4)
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

/* ── Persona display map ───────────────────────────────────────────────────── */
const PERSONA_DISPLAY = {
  strategist: 'Strategist',
  empath: 'Empath',
  drill_sergeant: 'Drill Sergeant',
  hype_person: 'Hype Person',
  thinking_partner: 'Thinking Partner',
  coach: 'Coach',
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function TabSettings({ user, profile, setProfile, showToast, loggedFetch, activeTheme, setActiveTheme }) {
  const router = useRouter()

  // State
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Check-in schedule
  const [checkinMorning, setCheckinMorning] = useState(true)
  const [checkinMidday, setCheckinMidday] = useState(true)
  const [checkinEvening, setCheckinEvening] = useState(true)

  // Notifications
  const [notifCheckin, setNotifCheckin] = useState(true)
  const [notifBills, setNotifBills] = useState(true)
  const [notifStreak, setNotifStreak] = useState(true)

  // Sync from profile
  useEffect(() => {
    if (!profile) return
    if (Array.isArray(profile.checkin_times)) {
      setCheckinMorning(profile.checkin_times.includes('morning'))
      setCheckinMidday(profile.checkin_times.includes('midday'))
      setCheckinEvening(profile.checkin_times.includes('evening'))
    }
    if (profile.notif_checkin !== undefined) setNotifCheckin(profile.notif_checkin !== false)
    if (profile.notif_bills !== undefined) setNotifBills(profile.notif_bills !== false)
    if (profile.notif_streak !== undefined) setNotifStreak(profile.notif_streak !== false)
  }, [profile])

  // ── Patch helper ──────────────────────────────────────────────────────────
  const patchSettings = async (updates) => {
    if (!user) return false
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return false
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: user.id, updates }),
      })
      return res.ok
    } catch { return false }
  }

  // ── Coaching blend ────────────────────────────────────────────────────────
  const blend = profile?.persona_blend || []
  const handleBlendTap = async (key) => {
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
    if (!ok) setProfile(prev => ({ ...prev, persona_blend: current }))
  }

  // ── Check-in schedule toggle ──────────────────────────────────────────────
  const handleCheckinToggle = async (slot) => {
    const map = { morning: [checkinMorning, setCheckinMorning], midday: [checkinMidday, setCheckinMidday], evening: [checkinEvening, setCheckinEvening] }
    const [val, setter] = map[slot]
    const newVal = !val
    setter(newVal)
    const newMorning = slot === 'morning' ? newVal : checkinMorning
    const newMidday = slot === 'midday' ? newVal : checkinMidday
    const newEvening = slot === 'evening' ? newVal : checkinEvening
    const checkin_times = ['morning', 'midday', 'evening'].filter((_, i) => [newMorning, newMidday, newEvening][i])
    await patchSettings({ checkin_times })
  }

  // ── Notification toggles ──────────────────────────────────────────────────
  const handleNotifToggle = async (key) => {
    const map = { notif_checkin: [notifCheckin, setNotifCheckin], notif_bills: [notifBills, setNotifBills], notif_streak: [notifStreak, setNotifStreak] }
    const [val, setter] = map[key]
    const newVal = !val
    setter(newVal)

    // Request push permission if enabling
    if (newVal && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    await patchSettings({ [key]: newVal })
  }

  // ── Theme save ────────────────────────────────────────────────────────────
  const saveTheme = async (theme) => {
    setActiveTheme(theme)
    setProfile(prev => ({ ...prev, accent_color: theme.id }))
    if (typeof localStorage !== 'undefined') localStorage.setItem('cinis_accent_color', theme.id)
    applyTheme(theme)
    if (user) await patchSettings({ accent_color: theme.id })
  }

  // ── Accent save ───────────────────────────────────────────────────────────
  const [activeAccent, setActiveAccent] = useState('#FF6644')
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('cinis_accent') || '#FF6644'
      setActiveAccent(saved)
    }
  }, [])

  const saveAccent = (color) => {
    setActiveAccent(color)
    if (typeof localStorage !== 'undefined') localStorage.setItem('cinis_accent', color)
    document.documentElement.style.setProperty('--accent', color)
  }

  // ── Delete account ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeletingAccount(true)
    try {
      const res = await loggedFetch('/api/delete-account', { method: 'DELETE' })
      if (res.ok) { await supabase.auth.signOut(); router.push('/login') }
    } catch {}
    setDeletingAccount(false)
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const firstName = profile?.full_name?.split(' ')[0] || ''
  const initial = firstName?.charAt(0)?.toUpperCase() || '?'
  const isPro = profile?.plan === 'pro'

  // ── Theme options per brief ───────────────────────────────────────────────
  const THEME_OPTIONS = [
    { id: 'orange-bronze', label: 'Ember', swatch: '#FF6644' },
    { id: 'warm', label: 'Ash', swatch: '#F0EAD6' },
    { id: 'midnight', label: 'Dim', swatch: '#5A4F45' },
    { id: 'indigo-night', label: 'Midnight', swatch: '#0D0A07', border: '1px solid rgba(240,234,214,0.15)' },
  ]

  const ACCENT_COLORS = ['#FF6644', '#3B8BD4', '#4CAF50', '#A47BDB', '#FFB800']

  // Chevron SVG
  const Chevron = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(240,234,214,0.22)" strokeWidth="2.5" strokeLinecap="round" className={styles.chevron}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  )

  return (
    <div className={styles.wrap}>
      {/* Header */}
      <div className={styles.header}>Settings</div>

      {/* Profile card */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.profileInfo}>
          <div className={styles.profileName}>{profile?.full_name || 'User'}</div>
          <div className={styles.profileEmail}>{user?.email}</div>
        </div>
        <span className={isPro ? styles.planPro : styles.planFree}>{isPro ? 'PRO' : 'FREE'}</span>
      </div>

      {/* Upgrade banner (free only) */}
      {!isPro && (
        <div className={styles.upgradeBanner} onClick={() => router.push('/pricing')}>
          <div className={styles.upgradeLeft}>
            <div className={styles.upgradeTitle}>Upgrade to Pro</div>
            <div className={styles.upgradeSub}>Memory &middot; SMS &middot; 15 AI/day &middot; $14/mo</div>
          </div>
          <div className={styles.upgradeArrow}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </div>
        </div>
      )}

      {/* Coaching blend */}
      <div className={styles.secLabel}>COACHING BLEND</div>
      <div className={styles.cardPad}>
        <div className={styles.blendDesc}>Pick up to 3 voices. Your coach blends them in every response.</div>
        <div className={styles.chips}>
          {PERSONAS_LIST.map(({ key, label }) => (
            <button
              key={key}
              className={blend.includes(key) ? styles.chipActive : styles.chip}
              onClick={() => handleBlendTap(key)}
            >
              {label.replace('The ', '')}
            </button>
          ))}
        </div>
        {blend.length > 0 && (
          <div className={styles.blendDisplay}>
            Active blend:{' '}
            {blend.map((k, i) => (
              <span key={k}>
                {i > 0 && ' \u00B7 '}
                <span className={styles.blendName}>{PERSONA_DISPLAY[k] || k}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Check-in schedule */}
      <div className={styles.secLabel}>CHECK-IN SCHEDULE</div>
      <div className={styles.card}>
        {[
          { key: 'morning', label: 'Morning', time: '8:00 AM', val: checkinMorning },
          { key: 'midday', label: 'Midday', time: '12:30 PM', val: checkinMidday },
          { key: 'evening', label: 'Evening', time: '8:00 PM', val: checkinEvening, last: true },
        ].map(({ key, label, time, val, last }) => (
          <div key={key} className={last ? styles.toggleRowLast : styles.toggleRow}>
            <div className={styles.toggleLeft}>
              <div className={styles.toggleLabel}>{label}</div>
              <div className={styles.toggleSub}>{time}</div>
            </div>
            <button className={val ? styles.toggleOn : styles.toggle} onClick={() => handleCheckinToggle(key)}>
              <span className={val ? styles.toggleThumbOn : styles.toggleThumb} />
            </button>
          </div>
        ))}
      </div>

      {/* Notifications */}
      <div className={styles.secLabel}>NOTIFICATIONS</div>
      <div className={styles.card}>
        {[
          { key: 'notif_checkin', label: 'Check-in reminders', sub: 'Push notifications per schedule', val: notifCheckin },
          { key: 'notif_bills', label: 'Bill due alerts', sub: '2 days before due date', val: notifBills },
          { key: 'notif_streak', label: 'Streak at risk', sub: 'If no activity by 9pm', val: notifStreak, last: true },
        ].map(({ key, label, sub, val, last }) => (
          <div key={key} className={last ? styles.toggleRowLast : styles.toggleRow}>
            <div className={styles.toggleLeft}>
              <div className={styles.toggleLabel}>{label}</div>
              <div className={styles.toggleSub}>{sub}</div>
            </div>
            <button className={val ? styles.toggleOn : styles.toggle} onClick={() => handleNotifToggle(key)}>
              <span className={val ? styles.toggleThumbOn : styles.toggleThumb} />
            </button>
          </div>
        ))}
      </div>

      {/* Appearance */}
      <div className={styles.secLabel}>APPEARANCE</div>
      <div className={styles.cardPadLR}>
        <div className={styles.themeSublabel}>Theme</div>
        <div className={styles.themePicker}>
          {THEME_OPTIONS.map(opt => {
            const isActive = activeTheme?.id === opt.id
            return (
              <div
                key={opt.id}
                className={isActive ? styles.themeOptActive : styles.themeOpt}
                onClick={() => {
                  const theme = THEMES.find(t => t.id === opt.id)
                  if (theme) saveTheme(theme)
                }}
              >
                <span
                  className={styles.themeSwatch}
                  style={{ backgroundColor: opt.swatch, border: opt.border || 'none' }}
                />
                <div className={isActive ? styles.themeOptLabelActive : styles.themeOptLabel}>{opt.label}</div>
              </div>
            )
          })}
        </div>

        <div className={styles.accentSublabel}>Accent color</div>
        <div className={styles.accentPicker}>
          {ACCENT_COLORS.map(color => (
            <button
              key={color}
              className={activeAccent === color ? styles.accentSwatchActive : styles.accentSwatch}
              style={{ backgroundColor: color, color }}
              onClick={() => saveAccent(color)}
            />
          ))}
        </div>
      </div>

      {/* Account rows */}
      <div className={styles.secLabel}>ACCOUNT</div>
      <div className={styles.card}>
        {[
          { label: 'Subscription & billing' },
          { label: 'Data & privacy' },
          { label: 'Export my data' },
          { label: 'About & feedback', last: true },
        ].map(({ label, last }) => (
          <div
            key={label}
            className={last ? styles.accountRowLast : styles.accountRow}
            onClick={() => console.log(`[settings] ${label}`)}
          >
            <span className={styles.accountRowLabel}>{label}</span>
            <Chevron />
          </div>
        ))}
      </div>

      {/* Log out */}
      <button className={styles.logoutBtn} onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}>
        Log out
      </button>

      {/* Version */}
      <div className={styles.version}>Cinis v0.9.1 &middot; Built in Georgetown, TX</div>

      {/* Delete overlay */}
      {deleteConfirm && (
        <div className={styles.deleteOverlay} onClick={() => !deletingAccount && setDeleteConfirm(false)}>
          <div className={styles.deleteCard} onClick={e => e.stopPropagation()}>
            <div className={styles.deleteTitle}>Delete Account</div>
            <div className={styles.deleteMsg}>This will permanently delete all your data. This cannot be undone.</div>
            <button className={styles.deleteConfirmBtn} disabled={deletingAccount} onClick={handleDelete}>
              {deletingAccount ? 'Deleting\u2026' : 'Yes, delete everything'}
            </button>
            <button className={styles.deleteCancelBtn} disabled={deletingAccount} onClick={() => setDeleteConfirm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
