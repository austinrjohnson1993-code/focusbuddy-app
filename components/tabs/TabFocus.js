import React, { useState, useEffect, useRef } from 'react'
import { formatTimer, localDateStr } from './shared'
import { supabase } from '../../lib/supabase'

const TIPS = [
  "If you feel the urge to check your phone, set it face-down. The impulse passes in 20 seconds.",
  "Don't try to do the whole thing. Just do the next 2 minutes.",
  "If you're stuck, change one thing \u2014 your position, your music, or your approach.",
  "Close every tab you're not using. Visual clutter is mental clutter.",
  "You don't need to feel motivated to start. Action creates motivation.",
]

export default function TabFocus({
  user, profile, tasks = [], setTasks, showToast, loggedFetch, switchTab,
  topTask, focusLabel, topTaskCountdown, completeTask, archiveTask,
  setShowAddModal, setDetailTask, openDetailEdit,
}) {
  // ── Focus state ────────────────────────────────────────────────────────────
  const [focusPhase, setFocusPhase] = useState('setup') // setup | active
  const [focusDuration, setFocusDuration] = useState(25)
  const [focusCustom, setFocusCustom] = useState('')
  const [focusTimeLeft, setFocusTimeLeft] = useState(0)
  const [focusRunning, setFocusRunning] = useState(false)
  const [focusAiResponse, setFocusAiResponse] = useState('')
  const [focusAiLoading, setFocusAiLoading] = useState(false)
  const focusIntervalRef = useRef(null)

  // Session modals
  const [showSessionEndModal, setShowSessionEndModal] = useState(false)
  const [sessionEndType, setSessionEndType] = useState('complete')
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false)
  const [showStuckModal, setShowStuckModal] = useState(false)
  const [stuckConfirmRemove, setStuckConfirmRemove] = useState(false)
  const [stuckTask, setStuckTask] = useState(null)

  // Focus shield + tip
  const [focusShieldOn, setFocusShieldOn] = useState(false)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])
  const [sessionStartTime, setSessionStartTime] = useState(null)

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => clearInterval(focusIntervalRef.current), [])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const startFocus = () => {
    const dur = focusCustom ? parseInt(focusCustom) : focusDuration
    if (!dur || dur < 1) return
    const secs = dur * 60
    setFocusTimeLeft(secs)
    setFocusPhase('active')
    setFocusRunning(true)
    setSessionStartTime(new Date())
    focusIntervalRef.current = setInterval(() => {
      setFocusTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(focusIntervalRef.current)
          setFocusRunning(false)
          setFocusPhase('setup')
          setSessionEndType('complete')
          setShowSessionEndModal(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const toggleFocusPause = () => {
    if (focusRunning) {
      clearInterval(focusIntervalRef.current)
      setFocusRunning(false)
    } else {
      focusIntervalRef.current = setInterval(() => {
        setFocusTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(focusIntervalRef.current)
            setFocusRunning(false)
            setFocusPhase('setup')
            setSessionEndType('complete')
            setShowSessionEndModal(true)
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
      if (topTask && completeTask) completeTask(topTask)
      setFocusPhase('setup')
      setFocusCustom('')
      if (showToast) showToast('Task complete \u2713')
    } else if (result === 'progress') {
      if (topTask) {
        await supabase.from('tasks').update({ notes: 'In progress' }).eq('id', topTask.id)
        if (setTasks) setTasks(prev => prev.map(t => t.id === topTask.id ? { ...t, notes: 'In progress' } : t))
      }
      setFocusPhase('setup')
      setFocusCustom('')
    } else if (result === 'stuck') {
      setFocusPhase('setup')
      if (switchTab) switchTab('checkin')
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
    }
  }

  const confirmAbandon = () => {
    setShowAbandonConfirm(false)
    clearInterval(focusIntervalRef.current)
    setFocusRunning(false)
    setFocusPhase('setup')
    setSessionEndType('abandoned')
    setShowSessionEndModal(true)
  }

  // ── Computed stats ─────────────────────────────────────────────────────────
  const todayDateStr = localDateStr(new Date())

  const todayFocusMinutes = tasks.reduce((sum, t) => {
    if (t.completed && t.completed_at && t.completed_at.slice(0, 10) === todayDateStr) {
      return sum + (t.estimated_minutes || 0)
    }
    return sum
  }, 0)

  const sessionsToday = tasks.filter(t =>
    t.completed && t.completed_at && t.completed_at.slice(0, 10) === todayDateStr
  ).length

  const focusStreak = (() => {
    const today = new Date()
    let streak = 0
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today.getTime() - i * 86400000)
      const checkStr = localDateStr(checkDate)
      const completed = tasks.filter(t =>
        t.completed && t.completed_at && t.completed_at.slice(0, 10) === checkStr
      ).length
      if (completed > 0) streak++
      else if (i > 0) break
    }
    return streak
  })()

  // Active state derived
  const totalSeconds = (focusCustom ? parseInt(focusCustom) : focusDuration) * 60
  const elapsed = totalSeconds - focusTimeLeft
  const progressPct = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0

  const fmtTime = (d) => d ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
  const sessionEndTime = sessionStartTime ? new Date(sessionStartTime.getTime() + totalSeconds * 1000) : null

  // ── Inline style helpers ───────────────────────────────────────────────────
  const ff = "'Figtree',sans-serif"
  const sf = "'Sora',sans-serif"

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ padding: '12px 14px', overflowY: 'auto', height: '100%', paddingBottom: 80 }}>

        {focusPhase === 'setup' && (
          <>
            {/* Header */}
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E3', fontFamily: ff, marginBottom: 10 }}>Focus</div>

            {/* Timer display */}
            <div style={{ textAlign: 'center', padding: '30px 0 20px' }}>
              <div style={{ fontFamily: sf, fontSize: 52, fontWeight: 300, color: '#F5F0E3', letterSpacing: '0.04em' }}>
                {focusDuration}:00
              </div>
              <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff, marginTop: 4 }}>Ready to start</div>
            </div>

            {/* Duration presets */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 20 }}>
              {[5, 15, 25, 45, 60].map(d => (
                <div key={d} onClick={() => { setFocusDuration(d); setFocusCustom('') }} style={{
                  width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: sf, fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  background: focusDuration === d && !focusCustom ? '#FF664425' : '#3E3228',
                  color: focusDuration === d && !focusCustom ? '#FF6644' : '#F5F0E350',
                  border: focusDuration === d && !focusCustom ? '1px solid #FF664450' : '1px solid #F5F0E312',
                }}>{d}</div>
              ))}
            </div>

            {/* Start button */}
            <div onClick={startFocus} style={{
              background: '#FF6644', borderRadius: 12, padding: '14px 0', textAlign: 'center',
              fontFamily: ff, fontSize: 14, fontWeight: 600, color: '#F5F0E3', cursor: 'pointer', marginBottom: 14
            }}>Start focus</div>

            {/* Partner Up card */}
            <div style={{
              background: '#3E3228', borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'center',
              border: '1px solid #A47BDB25', cursor: 'pointer'
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: '#A47BDB1F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                &#128101;
              </div>
              <div>
                <div style={{ fontFamily: ff, fontSize: 14, fontWeight: 500, color: '#F5F0E3' }}>Partner up</div>
                <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff, marginTop: 2 }}>Body double with a teammate</div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
              {[
                { value: todayFocusMinutes > 0 ? `${todayFocusMinutes}m` : '0m', label: 'Today', color: '#FF6644' },
                { value: focusStreak, label: 'Streak', color: '#4CAF50' },
                { value: sessionsToday, label: 'Sessions', color: '#3B8BD4' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: '#3E3228', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: sf, fontSize: 16, fontWeight: 600, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {focusPhase === 'active' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 20 }}>
            {/* Session label */}
            <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#E8321A', fontFamily: ff, fontWeight: 500, marginBottom: 4 }}>FOCUS SESSION</div>

            {/* Task name */}
            {topTask && <div style={{ fontSize: 14, color: '#F5F0E3AA', fontFamily: ff, textAlign: 'center', marginBottom: 16 }}>{topTask.title}</div>}

            {/* Timer digits */}
            <div style={{ fontFamily: sf, fontSize: 48, fontWeight: 300, color: '#F5F0E3', letterSpacing: '0.04em' }}>
              {formatTimer(focusTimeLeft)}
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', maxWidth: 280, marginTop: 16 }}>
              <div style={{ height: 5, background: '#F5F0E318', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #E8321A, #FF6644)', borderRadius: 3, transition: 'width 1s' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff }}>{fmtTime(sessionStartTime)}</span>
                <span style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff }}>{fmtTime(sessionEndTime)}</span>
              </div>
            </div>

            {/* Button row */}
            <div style={{ display: 'flex', gap: 10, margin: '16px 0' }}>
              <div onClick={toggleFocusPause} style={{
                border: '1px solid #F5F0E340', background: 'transparent', borderRadius: 20,
                padding: '7px 22px', fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer'
              }}>{focusRunning ? 'Pause' : 'Resume'}</div>
              <div onClick={() => setShowAbandonConfirm(true)} style={{
                border: '1px solid #E8321A58', background: '#E8321A25', borderRadius: 20,
                padding: '7px 22px', fontSize: 14, color: '#E8321A', fontFamily: ff, cursor: 'pointer'
              }}>Got stuck</div>
            </div>

            {/* Divider */}
            <div style={{ width: '100%', maxWidth: 300, height: 0.5, background: '#F5F0E318', margin: '4px 0 12px' }} />

            {/* Focus shield */}
            <div style={{ background: '#3E3228', borderRadius: 10, padding: 12, maxWidth: 300, width: '100%', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 16, color: '#E8321A' }}>&#128737;</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: ff, fontSize: 14, fontWeight: 500, color: '#F5F0E3' }}>Focus shield</div>
                <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff }}>Notifications + apps blocked</div>
              </div>
              <div style={{ minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div onClick={() => setFocusShieldOn(v => !v)} style={{
                  width: 36, height: 20, borderRadius: 10, cursor: 'pointer', position: 'relative',
                  background: focusShieldOn ? '#E8321A' : '#F5F0E333',
                  transition: 'background .2s'
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2,
                    left: focusShieldOn ? 18 : 2, transition: 'left .2s'
                  }} />
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 6, maxWidth: 300, width: '100%', marginBottom: 10 }}>
              {[
                { value: todayFocusMinutes > 0 ? `${todayFocusMinutes}m` : '0m', label: 'Today', color: '#FF6644' },
                { value: focusStreak, label: 'Streak', color: '#4CAF50' },
                { value: sessionsToday, label: 'Sessions', color: '#3B8BD4' },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: '#3E3228', borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: sf, fontSize: 16, fontWeight: 600, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 14, color: '#F5F0E350', fontFamily: ff, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Tip card */}
            <div style={{ background: '#3E3228', borderRadius: 10, padding: 12, maxWidth: 300, width: '100%' }}>
              <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FF6644', fontFamily: ff, fontWeight: 500, marginBottom: 6 }}>STAY IN THE ZONE</div>
              <div style={{ fontSize: 14, color: '#F5F0E3AA', fontFamily: ff, lineHeight: 1.6 }}>{tip}</div>
            </div>
          </div>
        )}

      </div>

      {/* Abandon confirm */}
      {showAbandonConfirm && (
        <div onClick={e => e.target === e.currentTarget && setShowAbandonConfirm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#211A14', border: '1px solid #F5F0E318', borderRadius: 14, padding: 20, maxWidth: 320, width: '90%' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E3', fontFamily: ff, marginBottom: 8 }}>Abandon session?</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <div onClick={confirmAbandon} style={{ flex: 1, padding: '10px 0', textAlign: 'center', background: '#E8321A', borderRadius: 8, fontSize: 14, fontWeight: 500, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer' }}>Yes, stop</div>
              <div onClick={() => setShowAbandonConfirm(false)} style={{ flex: 1, padding: '10px 0', textAlign: 'center', background: '#3E3228', border: '1px solid #F5F0E318', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer' }}>Keep going</div>
            </div>
          </div>
        </div>
      )}

      {/* Session end modal */}
      {showSessionEndModal && (
        <div onClick={e => e.target === e.currentTarget && setShowSessionEndModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#211A14', border: '1px solid #F5F0E318', borderRadius: 14, padding: 20, maxWidth: 340, width: '90%' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E3', fontFamily: ff, marginBottom: 4 }}>
              {sessionEndType === 'complete' ? 'Session complete' : 'Session ended'}
            </div>
            {topTask && <div style={{ fontSize: 14, color: '#F5F0E370', fontFamily: ff, marginBottom: 12 }}>{topTask.title}</div>}
            <div style={{ fontSize: 14, color: '#F5F0E3', fontFamily: ff, marginBottom: 14 }}>How&apos;d it go?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div onClick={() => handleFocusResult('complete')} style={{ padding: '10px 14px', background: '#4CAF50', borderRadius: 8, fontSize: 14, fontWeight: 500, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer', textAlign: 'center' }}>&#10003; Nailed it</div>
              <div onClick={() => handleFocusResult('progress')} style={{ padding: '10px 14px', background: '#3E3228', border: '1px solid #F5F0E318', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer', textAlign: 'center' }}>&#9654; Made progress</div>
              <div onClick={() => { setShowSessionEndModal(false); setStuckTask(topTask); setStuckConfirmRemove(false); setShowStuckModal(true) }} style={{ padding: '10px 14px', background: '#3E3228', border: '1px solid #F5F0E318', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer', textAlign: 'center' }}>&#129521; Got stuck</div>
            </div>
          </div>
        </div>
      )}

      {/* Stuck resolution modal */}
      {showStuckModal && (
        <div onClick={e => e.target === e.currentTarget && (setShowStuckModal(false), setStuckConfirmRemove(false))} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#211A14', border: '1px solid #F5F0E318', borderRadius: 14, padding: 20, maxWidth: 340, width: '90%' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#F5F0E3', fontFamily: ff, marginBottom: 4 }}>What do you want to do with this?</div>
            {stuckTask && <div style={{ fontSize: 14, color: '#F5F0E370', fontFamily: ff, marginBottom: 8 }}>{stuckTask.title}</div>}
            <div style={{ fontSize: 14, color: '#F5F0E390', fontFamily: ff, marginBottom: 16, lineHeight: 1.5 }}>No judgment \u2014 let&apos;s figure out the next step.</div>
            {stuckConfirmRemove ? (
              <div>
                <div style={{ fontSize: 14, color: '#F5F0E390', fontFamily: ff, marginBottom: 14, lineHeight: 1.5 }}>
                  Are you sure? This will remove <strong style={{ color: '#F5F0E3' }}>{stuckTask?.title}</strong> from your list.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={async () => { if (stuckTask && archiveTask) await archiveTask(stuckTask); setShowStuckModal(false); setStuckConfirmRemove(false) }} style={{ flex: 1, padding: '10px 0', textAlign: 'center', background: '#E8321A', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer' }}>Yes, remove it</div>
                  <div onClick={() => setStuckConfirmRemove(false)} style={{ flex: 1, padding: '10px 0', textAlign: 'center', background: '#3E3228', border: '1px solid #F5F0E318', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer' }}>Cancel</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div onClick={() => { if (stuckTask && setDetailTask) { setDetailTask(stuckTask); if (openDetailEdit) openDetailEdit() } setShowStuckModal(false) }} style={{ padding: '10px 14px', background: '#3E3228', border: '1px solid #F5F0E318', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer', textAlign: 'center' }}>&#128197; Reschedule it</div>
                <div onClick={() => setStuckConfirmRemove(true)} style={{ padding: '10px 14px', background: '#3E3228', border: '1px solid #F5F0E318', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer', textAlign: 'center' }}>&#128465; Remove it</div>
                <div onClick={() => { setShowStuckModal(false); setStuckConfirmRemove(false) }} style={{ padding: '10px 14px', background: '#3E3228', border: '1px solid #F5F0E318', borderRadius: 8, fontSize: 14, color: '#F5F0E3', fontFamily: ff, cursor: 'pointer', textAlign: 'center' }}>&#10003; Keep it on my list</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
