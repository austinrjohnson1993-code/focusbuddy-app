import React, { useState, useEffect } from 'react'
import styles from '../../styles/Dashboard.module.css'
import { supabase } from '../../lib/supabase'
import { sanitizeInsight, SkeletonCard, EmptyState, localDateStr, ErrorState, TabErrorBoundary } from './shared'

export default function TabProgress({ user, profile, tasks, showToast, loggedFetch }) {
  // ── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true)
  const [tasksError, setTasksError] = useState(false)
  const [progressError, setProgressError] = useState(false)

  const [weeklySummary, setWeeklySummary] = useState('')
  const [weeklySummaryLoading, setWeeklySummaryLoading] = useState(false)
  const [weeklySummaryInitialized, setWeeklySummaryInitialized] = useState(false)

  const [monthlySummary, setMonthlySummary] = useState('')
  const [monthlySummaryLoading, setMonthlySummaryLoading] = useState(false)
  const [monthlySummaryInitialized, setMonthlySummaryInitialized] = useState(false)

  const [progressSnapshots, setProgressSnapshots] = useState([])
  const [progressBand, setProgressBand] = useState('week')

  const [progressInsights, setProgressInsights] = useState([])
  const [progressInsightsLoading, setProgressInsightsLoading] = useState(false)
  const [progressInsightsLoaded, setProgressInsightsLoaded] = useState(false)

  const [journalEntries, setJournalEntries] = useState([])

  // ── Fetch functions ──────────────────────────────────────────────────────

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

  const fetchJournalEntries = async (userId) => {
    const { data } = await supabase
      .from('journal_entries').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(5)
    setJournalEntries(data || [])
  }

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return
    const init = async () => {
      await Promise.all([
        fetchProgressSnapshots(user.id),
        fetchJournalEntries(user.id),
      ])
      setLoading(false)
    }
    init()
  }, [user])

  useEffect(() => {
    if (user && !progressInsightsLoaded) {
      fetchProgressInsights()
    }
  }, [user])

  useEffect(() => {
    if (user && !weeklySummaryInitialized) {
      fetchWeeklySummary()
      fetchJournalEntries(user.id)
    }
  }, [user])

  useEffect(() => {
    if (progressBand === 'month' && user && !monthlySummaryInitialized) {
      fetchMonthlySummary()
    }
  }, [progressBand, user])

  // ── Computed values ──────────────────────────────────────────────────────

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const pgTodayStr = localDateStr(today)
  const todayLocalStr = localDateStr(new Date())

  const todayTasksForRings = tasks.filter(t => !t.archived && t.scheduled_for && t.scheduled_for.slice(0, 10) === pgTodayStr)
  const completedTodayCount = todayTasksForRings.filter(t => t.completed).length
  const totalTodayCount = todayTasksForRings.length
  const taskRingPct = totalTodayCount > 0 ? completedTodayCount / totalTodayCount : 0

  const todayIso = new Date().toISOString().split('T')[0]
  const todayJournaled = (Array.isArray(journalEntries) ? journalEntries : []).some(j => j.created_at?.startsWith(todayIso))
  const journalRingPct = todayJournaled ? 1 : 0

  const todaySnapshot = progressSnapshots.find(s => s.snapshot_date?.slice(0, 10) === pgTodayStr)
  const todayFocusMinutes = todaySnapshot?.focus_minutes || 0
  const focusRingPct = Math.min(todayFocusMinutes / 60, 1)

  const totalXp = profile?.total_xp || 0
  const XP_MILESTONES = [
    { xp: 1000, label: 'Sticker pack' },
    { xp: 5000, label: 'Journal book' },
    { xp: 25000, label: 'Lifetime Pro' },
  ]
  const nextMilestone = XP_MILESTONES.find(m => m.xp > totalXp)
  const prevMilestone = [...XP_MILESTONES].reverse().find(m => m.xp <= totalXp)
  const xpBarPct = nextMilestone ? Math.min((totalXp / nextMilestone.xp) * 100, 100) : 100
  const xpToNext = nextMilestone ? (nextMilestone.xp - totalXp).toLocaleString() : null

  const barDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0, 0, 0, 0)
    return d
  })
  const prevBarDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i)); d.setHours(0, 0, 0, 0)
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
  const thisWeekTotal = barCounts.reduce((s, v) => s + v, 0)

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' })
  const completedThisMonthList = tasks.filter(t => t.completed && t.completed_at && new Date(t.completed_at) >= monthStart)
  const monthFocusMinutes = progressSnapshots
    .filter(s => s.snapshot_date && new Date(s.snapshot_date) >= monthStart)
    .reduce((sum, s) => sum + (s.focus_minutes || 0), 0)
  const monthJournalCount = (Array.isArray(journalEntries) ? journalEntries : [])
    .filter(j => j.created_at && new Date(j.created_at) >= monthStart).length

  // ── Helpers ──────────────────────────────────────────────────────────────

  const renderRing = (pct, color, valueText, subText) => {
    const r = 29
    const circ = 2 * Math.PI * r
    const dashOff = circ * (1 - Math.min(pct, 1))
    return (
      <div className={styles.pgRingSvgWrap}>
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(245,240,227,0.08)" strokeWidth="5" />
          {pct > 0 && (
            <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5"
              strokeDasharray={circ} strokeDashoffset={dashOff} strokeLinecap="round"
              style={{ transform: 'rotate(-90deg)', transformOrigin: '34px 34px' }} />
          )}
        </svg>
        <div className={styles.pgRingCenter}>
          <span className={styles.pgRingValue}>{valueText}</span>
          {subText && <span className={styles.pgRingSubValue}>{subText}</span>}
        </div>
      </div>
    )
  }

  const INSIGHT_STATIC = [
    { icon: '\u26A1', label: 'PATTERN', body: 'You complete 2x more tasks on days you journal in the morning.', color: '#FF6644' },
    { icon: '!', label: 'HEADS UP', body: '4 tasks pushed more than twice this week. LLC filing rescheduled 3 times.', color: '#E8321A' },
    { icon: '\u2713', label: 'WIN', body: '12-day streak. Longest since you started. Focus minutes up 30% week-over-week.', color: '#4CAF50' },
  ]
  const insightSource = progressInsights.length > 0
    ? progressInsights.map(ins => ({
        icon: ins.type === 'alert' ? '!' : ins.type === 'win' ? '\u2713' : '\u26a1',
        label: ins.type === 'alert' ? 'HEADS UP' : ins.type === 'win' ? 'WIN' : 'PATTERN',
        body: ins.body || ins.title || '',
        color: ins.type === 'alert' ? '#E8321A' : ins.type === 'win' ? '#4CAF50' : '#FF6644',
      }))
    : INSIGHT_STATIC

  const fmtFocusMonth = monthFocusMinutes >= 60
    ? (monthFocusMinutes / 60).toFixed(1).replace(/\.0$/, '') + 'h'
    : monthFocusMinutes + 'm'

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: '12px 14px', paddingBottom: 80, overflowY: 'auto', height: '100%' }}>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </div>
  )

  if (tasksError || progressError) return (
    <div style={{ padding: '12px 14px', paddingBottom: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
      <ErrorState message="Couldn't load your data." onRetry={() => { setTasksError(false); setProgressError(false); setLoading(true); fetchProgressSnapshots(user.id) }} />
    </div>
  )

  return (
    <div style={{ padding: '12px 14px', paddingBottom: 80, overflowY: 'auto', height: '100%' }}>

      {/* 1 — Header */}
      <h2 style={{ margin: '0 0 12px', fontFamily: "'Figtree', sans-serif", fontSize: 14, fontWeight: 600, color: '#F5F0E3' }}>Progress</h2>

      {/* 2 — Three rings */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginBottom: 16 }}>
        <div className={styles.pgRingWrap}>
          {renderRing(taskRingPct, '#FF6644', String(completedTodayCount), totalTodayCount > 0 ? 'of ' + String(totalTodayCount) : '0')}
          <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.45)', fontFamily: "'Figtree', sans-serif", marginTop: 5 }}>Tasks</span>
        </div>
        <div className={styles.pgRingWrap}>
          {renderRing(focusRingPct, '#3B8BD4', todayFocusMinutes + 'm', '')}
          <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.45)', fontFamily: "'Figtree', sans-serif", marginTop: 5 }}>Focus</span>
        </div>
        <div className={styles.pgRingWrap}>
          {renderRing(journalRingPct, '#4CAF50', todayJournaled ? '1' : '0', 'entry')}
          <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.45)', fontFamily: "'Figtree', sans-serif", marginTop: 5 }}>Journal</span>
        </div>
      </div>

      {/* 3 — XP card */}
      <div style={{ background: '#3E3228', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
        <div className={styles.pgXpRow}>
          <div className={styles.pgXpLeft}>
            <span className={styles.pgXpEmoji}>{'\uD83D\uDD25'}</span>
            <span className={styles.pgXpNumber}>{totalXp.toLocaleString()}</span>
            <span className={styles.pgXpUnit}>XP</span>
          </div>
          {nextMilestone && (
            <div className={styles.pgXpRight}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#FFB800', fontFamily: "'Figtree', sans-serif" }}>{xpToNext} to go</span>
              <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.38)', fontFamily: "'Figtree', sans-serif" }}>{nextMilestone.label} at {nextMilestone.xp >= 1000 ? (nextMilestone.xp / 1000) + 'K' : nextMilestone.xp}</span>
            </div>
          )}
        </div>
        <div style={{ height: 6, background: 'rgba(245,240,227,0.07)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
          <div style={{ height: '100%', width: xpBarPct + '%', background: 'linear-gradient(90deg, #FFB800, #FF6644)', borderRadius: 3, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.3)', fontFamily: "'Figtree', sans-serif" }}>
            {prevMilestone ? `${prevMilestone.xp >= 1000 ? (prevMilestone.xp / 1000) + 'K' : prevMilestone.xp}` : '0'}
          </span>
          <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.3)', fontFamily: "'Figtree', sans-serif" }}>
            {nextMilestone ? `${nextMilestone.xp >= 1000 ? (nextMilestone.xp / 1000) + 'K' : nextMilestone.xp}` : '25K'}
          </span>
          {XP_MILESTONES.length > 2 && (
            <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.3)', fontFamily: "'Figtree', sans-serif" }}>
              {XP_MILESTONES[2].xp >= 1000 ? (XP_MILESTONES[2].xp / 1000) + 'K' : XP_MILESTONES[2].xp}
            </span>
          )}
        </div>
      </div>

      {/* 4 — AI insight cards */}
      {progressInsightsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ height: 52, background: 'rgba(245,240,227,0.06)', borderRadius: 8, animation: 'pgSkeletonPulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
      ) : (
        <div className={styles.pgInsightsStack}>
          {insightSource.map((ins, i) => (
            <div key={i} style={{ background: '#3E3228', borderRadius: 8, padding: '9px 10px', marginBottom: 5, borderLeft: `3px solid ${ins.color}` }}>
              <div className={styles.pgInsightHeader}>
                <span className={styles.pgInsightIcon} style={{ color: ins.color }}>{ins.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: ins.color, fontFamily: "'Figtree', sans-serif", letterSpacing: '0.08em', textTransform: 'uppercase' }}>{ins.label}</span>
              </div>
              <p style={{ fontSize: 14, color: 'rgba(245,240,227,0.56)', fontFamily: "'Figtree', sans-serif", lineHeight: 1.55, margin: 0 }}>{ins.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* 5 — Weekly bar chart */}
      <div style={{ background: '#3E3228', borderRadius: 10, padding: 12, marginTop: 10, marginBottom: 12 }}>
        <div className={styles.pgWeekHeader}>
          <span style={{ fontFamily: "'Figtree', sans-serif", fontSize: 14, fontWeight: 700, color: 'rgba(245,240,227,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>This week vs last</span>
          <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 14, fontWeight: 600, color: '#F5F0E3' }}>{thisWeekTotal} tasks</span>
        </div>
        <div className={styles.pgBarChart}>
          {barDays.map((d, i) => {
            const isToday = localDateStr(d) === todayLocalStr
            const thisH = barMax > 0 ? Math.round((barCounts[i] / barMax) * 68) : 0
            const prevH = barMax > 0 ? Math.round((prevBarCounts[i] / barMax) * 68) : 0
            return (
              <div key={i} className={styles.pgBarCol}>
                <div className={styles.pgBarPairWrap}>
                  <div style={{ width: 8, borderRadius: 2, background: 'rgba(245,240,227,0.10)', height: prevBarCounts[i] > 0 ? Math.max(prevH, 4) : 0 }} />
                  <div style={{ width: 8, borderRadius: 2, background: isToday ? '#FF6644' : 'rgba(255,102,68,0.5)', height: Math.max(thisH, 3) }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: isToday ? '#FF6644' : 'rgba(245,240,227,0.3)', fontFamily: "'Figtree', sans-serif" }}>
                  {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                </span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FF6644' }} />
            <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.4)', fontFamily: "'Figtree', sans-serif" }}>This week</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(245,240,227,0.10)' }} />
            <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.4)', fontFamily: "'Figtree', sans-serif" }}>Last week</span>
          </div>
        </div>
      </div>

      {/* 6 — Monthly stats */}
      <div style={{ background: '#3E3228', borderRadius: 10, padding: 12 }}>
        <p style={{ fontFamily: "'Figtree', sans-serif", fontSize: 14, fontWeight: 500, color: '#F5F0E3', marginBottom: 8, margin: '0 0 8px' }}>{monthName}</p>
        <div className={styles.pgMonthStats}>
          <div className={styles.pgMonthStat}>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 600, color: '#FF6644', lineHeight: 1 }}>{completedThisMonthList.length}</span>
            <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.38)', fontFamily: "'Figtree', sans-serif", marginTop: 2 }}>tasks</span>
          </div>
          <div className={styles.pgMonthDivider} />
          <div className={styles.pgMonthStat}>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 600, color: '#3B8BD4', lineHeight: 1 }}>{fmtFocusMonth}</span>
            <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.38)', fontFamily: "'Figtree', sans-serif", marginTop: 2 }}>focus</span>
          </div>
          <div className={styles.pgMonthDivider} />
          <div className={styles.pgMonthStat}>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 600, color: '#4CAF50', lineHeight: 1 }}>{monthJournalCount}</span>
            <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.38)', fontFamily: "'Figtree', sans-serif", marginTop: 2 }}>entries</span>
          </div>
          <div className={styles.pgMonthDivider} />
          <div className={styles.pgMonthStat}>
            <span style={{ fontFamily: "'Sora', sans-serif", fontSize: 16, fontWeight: 600, color: '#FFB800', lineHeight: 1 }}>{(profile?.current_streak || 0) + 'd'}</span>
            <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.38)', fontFamily: "'Figtree', sans-serif", marginTop: 2 }}>streak</span>
          </div>
        </div>
      </div>

    </div>
  )
}
