import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import styles from '../../styles/Dashboard.module.css'
import { supabase } from '../../lib/supabase'
import { THEMES, applyTheme, PERSONAS_LIST, TabErrorBoundary } from './shared'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export default function TabSettings({ user, profile, setProfile, showToast, loggedFetch, activeTheme, setActiveTheme }) {
  const router = useRouter()

  // ── State ──────────────────────────────────────────────────────────────────
  const [settingsName, setSettingsName] = useState('')
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState(null)
  const [notifMorning, setNotifMorning] = useState(true)
  const [notifMidday, setNotifMidday] = useState(false)
  const [notifEvening, setNotifEvening] = useState(true)
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )
  const [checkinMorningTime, setCheckinMorningTime] = useState('08:00')
  const [checkinMiddayTime, setCheckinMiddayTime] = useState('12:00')
  const [checkinEveningTime, setCheckinEveningTime] = useState('21:00')
  const [pushLoading, setPushLoading] = useState(false)
  const [testNotifLoading, setTestNotifLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  // ── Sync state from profile ────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return
    if (profile.full_name) setSettingsName(profile.full_name)
    if (profile.morning_time) setCheckinMorningTime(profile.morning_time)
    if (profile.midday_time) setCheckinMiddayTime(profile.midday_time)
    if (profile.evening_time) setCheckinEveningTime(profile.evening_time)
    if (Array.isArray(profile.checkin_times)) {
      setNotifMorning(profile.checkin_times.includes('morning'))
      setNotifMidday(profile.checkin_times.includes('midday'))
      setNotifEvening(profile.checkin_times.includes('evening'))
    }
  }, [profile])

  // ── Handlers ───────────────────────────────────────────────────────────────

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
    applyTheme(theme)
    if (user) {
      const themeId = theme.name?.toLowerCase() || theme.id
      await patchSettings({ accent_color: theme.id, theme_id: themeId })
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

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return { error: 'Push notifications not supported in this browser.' }
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { error: 'Notification permission denied.' }
    }
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
    })
    return { subscription: subscription.toJSON() }
  }

  const handleTogglePush = async () => {
    if (pushLoading) return
    setPushLoading(true)
    const isCurrentlyEnabled = profile?.push_notifications_enabled

    try {
      if (isCurrentlyEnabled) {
        // Turning OFF
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready
          const existingSub = await reg.pushManager.getSubscription()
          if (existingSub) await existingSub.unsubscribe()
        }
        const res = await loggedFetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, enabled: false }),
        })
        if (!res.ok) throw new Error('Failed to disable notifications')
        setProfile(prev => ({ ...prev, push_notifications_enabled: false }))
        try { localStorage.removeItem('fb_push_enabled') } catch {}
        showToast('Push notifications disabled')
      } else {
        // Turning ON
        const result = await subscribeToPush()
        if (result.error) {
          if (result.error.includes('denied')) setNotifPermission('denied')
          showToast(result.error)
          setPushLoading(false)
          return
        }
        const res = await loggedFetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, subscription: result.subscription, enabled: true }),
        })
        if (!res.ok) throw new Error('Failed to save subscription')
        setProfile(prev => ({ ...prev, push_notifications_enabled: true }))
        setNotifPermission('granted')
        try { localStorage.setItem('fb_push_enabled', 'true') } catch {}
        showToast('Push notifications enabled')
      }
    } catch (err) {
      console.error('[push] toggle error:', err)
      showToast('Could not update notifications')
    }
    setPushLoading(false)
  }

  const handleSendTestNotification = async () => {
    if (testNotifLoading) return
    setTestNotifLoading(true)
    try {
      const res = await loggedFetch('/api/notifications/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send test notification')
      }
      showToast('Notification sent — check your device')
    } catch (err) {
      showToast(err.message || 'Could not send test notification')
    }
    setTestNotifLoading(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
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
              ) : (
                <button
                  className={`${styles.stgToggle} ${profile?.push_notifications_enabled ? styles.stgToggleOn : ''}`}
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  style={pushLoading ? { opacity: 0.5, cursor: 'wait' } : undefined}
                />
              )}
            </div>
            {notifPermission === 'denied' && (
              <p className={styles.stgNotifDeniedMsg}>Enable notifications in your browser settings</p>
            )}
            {profile?.push_notifications_enabled && notifPermission !== 'denied' && (
              <div className={styles.stgRow} style={{ borderTop: '0.5px solid rgba(245,240,227,0.08)', paddingTop: 8 }}>
                <span className={styles.stgRowLabel} style={{ fontSize: 14 }}>Test notification</span>
                <button
                  className={styles.stgGhostBtn}
                  onClick={handleSendTestNotification}
                  disabled={testNotifLoading}
                  style={{ opacity: testNotifLoading ? 0.6 : 1 }}
                >
                  {testNotifLoading ? 'Sending…' : 'Send test'}
                </button>
              </div>
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
                {deletingAccount ? 'Deleting\u2026' : 'Yes, delete everything'}
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
    </TabErrorBoundary>
  )
}
