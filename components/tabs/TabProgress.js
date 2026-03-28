import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { localDateStr, SkeletonCard, ErrorState } from './shared'
import styles from '../../styles/TabProgress.module.css'

/* ── Constants ───────────────────────────────────────────────────────────────── */
const C = {
  hot: '#FF6644', ember: '#E8321A', green: '#4CAF50',
  blue: '#3B8BD4', gold: '#FFB800',
}
const CIRC = 2 * Math.PI * 30 // ≈ 188.5

/* ── Helpers ──────────────────────────────────────────────────────────────────── */
const isToday = (d) => {
  if (!d) return false
  const t = new Date(); t.setHours(0,0,0,0)
  const c = new Date(d); c.setHours(0,0,0,0)
  return t.getTime() === c.getTime()
}

const getMonday = (d) => {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0,0,0,0)
  return date
}

const fmtShortDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const getWeekLabel = () => {
  const mon = getMonday(new Date())
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return `Week of ${fmtShortDate(mon)} – ${fmtShortDate(sun)}`
}

const getMonthLabel = () => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

/* ── Spark SVG ────────────────────────────────────────────────────────────────── */
const SparkSvg = ({ color, size = 9 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill={color}>
    <path d="M8 0l2 5h5l-4 3 2 5-5-3-5 3 2-5L1 5h5z" />
  </svg>
)

/* ── Flame SVG ────────────────────────────────────────────────────────────────── */
const FlameSvg = () => (
  <svg className={styles.xpFlame} viewBox="0 0 16 16" fill={C.hot}>
    <path d="M8 0C5.6 2.4 4 5.2 4 7.5 4 10.5 5.8 13 8 14c2.2-1 4-3.5 4-6.5C12 5.2 10.4 2.4 8 0z" />
  </svg>
)

/* ── Fallback insights ────────────────────────────────────────────────────────── */
const INSIGHT_FALLBACK = [
  { type: 'pattern', body: 'You complete 2× more tasks on days you journal in the morning.' },
  { type: 'headsup', body: 'LLC filing rescheduled 3 times — longest-stalled item on your list.' },
  { type: 'win', body: '12-day streak. Focus minutes up 30% week-over-week.' },
]
const INSIGHT_META = {
  pattern: { label: 'Pattern', color: C.hot },
  headsup: { label: 'Heads up', color: C.ember },
  win:     { label: 'Win', color: C.green },
}

/* ── Component ────────────────────────────────────────────────────────────────── */
export default function TabProgress({ user, profile, tasks = [], showToast, loggedFetch }) {
  const [band, setBand] = useState('week')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [journalEntries, setJournalEntries] = useState([])
  const [insights, setInsights] = useState(null)
  const [mounted, setMounted] = useState(false)

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const init = async () => {
      try {
        const { data } = await supabase
          .from('journal_entries').select('*').eq('user_id', user.id)
          .order('created_at', { ascending: false }).limit(90)
        setJournalEntries(data || [])
      } catch { setError(true) }
      setLoading(false)
      setTimeout(() => setMounted(true), 50)
    }
    init()
  }, [user])

  // ── Fetch insights (cached per week) ────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    const weekKey = localDateStr(getMonday(new Date()))
    const cacheKey = `cinis_insights_${weekKey}`
    try {
      const cached = typeof localStorage !== 'undefined' && localStorage.getItem(cacheKey)
      if (cached) { setInsights(JSON.parse(cached)); return }
    } catch {}
    const fetchInsights = async () => {
      try {
        const res = await loggedFetch(`/api/progress/insights?userId=${user.id}&type=weekly`)
        if (res.ok) {
          const data = await res.json()
          const list = data.insights || data.data || []
          if (list.length > 0) {
            setInsights(list)
            try { localStorage.setItem(cacheKey, JSON.stringify(list)) } catch {}
          }
        }
      } catch {}
    }
    fetchInsights()
  }, [user])

  // ── Derived: today data ─────────────────────────────────────────────────────
  const todayStr = localDateStr(new Date())
  const doneTasks = tasks.filter(t => t.done && t.completed_at && localDateStr(new Date(t.completed_at)) === todayStr)
  const totalTasks = tasks.filter(t => !t.archived && t.scheduled_for && t.scheduled_for.slice(0,10) === todayStr)
  const focusMins = profile?.focus_minutes_today ?? 0
  const journalToday = journalEntries.filter(j => j.created_at && isToday(j.created_at)).length
  const xp = profile?.total_xp ?? 0
  const streak = profile?.current_streak ?? 0

  // ── Rings data ──────────────────────────────────────────────────────────────
  const rings = [
    { label: 'Tasks', color: C.hot, value: doneTasks.length, sub: `of ${totalTasks.length}`, ratio: totalTasks.length > 0 ? doneTasks.length / totalTasks.length : 0, delay: 0.1 },
    { label: 'Focus', color: C.blue, value: `${focusMins}m`, sub: 'min', ratio: Math.min(focusMins / 60, 1), delay: 0.25 },
    { label: 'Journal', color: C.green, value: journalToday, sub: journalToday === 1 ? 'entry' : 'entries', ratio: Math.min(journalToday, 1), delay: 0.4 },
  ]

  // ── XP bar ──────────────────────────────────────────────────────────────────
  const xpInLevel = xp % 2000
  const xpBarPct = (xpInLevel / 2000) * 100
  const xpToNext = 2000 - xpInLevel

  // ── Streak 7-day dots ───────────────────────────────────────────────────────
  const streakDots = useMemo(() => {
    const dots = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i); d.setHours(0,0,0,0)
      const dStr = localDateStr(d)
      const count = tasks.filter(t => t.done && t.completed_at && localDateStr(new Date(t.completed_at)) === dStr).length
      let opacity = 0.08
      if (count >= 7) opacity = 1.0
      else if (count >= 5) opacity = 0.8
      else if (count >= 3) opacity = 0.6
      else if (count >= 2) opacity = 0.4
      else if (count >= 1) opacity = 0.25
      dots.push(opacity)
    }
    return dots
  }, [tasks])

  // ── Chart data ──────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const today = new Date()
    const todayIdx = (today.getDay() + 6) % 7 // 0=Mon

    if (band === 'week') {
      const mon = getMonday(today)
      const lastMon = new Date(mon); lastMon.setDate(mon.getDate() - 7)
      const thisWeek = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(mon); d.setDate(mon.getDate() + i)
        const dStr = localDateStr(d)
        return tasks.filter(t => t.done && t.completed_at && localDateStr(new Date(t.completed_at)) === dStr).length
      })
      const lastWeek = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lastMon); d.setDate(lastMon.getDate() + i)
        const dStr = localDateStr(d)
        return tasks.filter(t => t.done && t.completed_at && localDateStr(new Date(t.completed_at)) === dStr).length
      })
      return { thisWeek, lastWeek, todayIndex: todayIdx, labels: ['M','T','W','T','F','S','S'], total: thisWeek.reduce((s,v) => s+v, 0), lastTotal: lastWeek.reduce((s,v) => s+v, 0) }
    } else {
      // Month mode: group by day of month
      const now = new Date()
      const thisStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      const daysInThis = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const daysInLast = lastEnd.getDate()
      const thisMonth = Array.from({ length: daysInThis }, (_, i) => {
        const d = new Date(thisStart); d.setDate(i + 1)
        const dStr = localDateStr(d)
        return tasks.filter(t => t.done && t.completed_at && localDateStr(new Date(t.completed_at)) === dStr).length
      })
      const lastMonth = Array.from({ length: daysInLast }, (_, i) => {
        const d = new Date(lastStart); d.setDate(i + 1)
        const dStr = localDateStr(d)
        return tasks.filter(t => t.done && t.completed_at && localDateStr(new Date(t.completed_at)) === dStr).length
      })
      const labels = ['W1','W2','W3','W4']
      const todayDayIdx = now.getDate() - 1
      return { thisWeek: thisMonth, lastWeek: lastMonth, todayIndex: todayDayIdx, labels, total: thisMonth.reduce((s,v) => s+v, 0), lastTotal: lastMonth.reduce((s,v) => s+v, 0) }
    }
  }, [tasks, band])

  // ── SVG chart path builder ──────────────────────────────────────────────────
  const buildChartPaths = useMemo(() => {
    const { thisWeek, lastWeek, todayIndex } = chartData
    const count = thisWeek.length
    const maxVal = Math.max(...thisWeek, ...lastWeek, 1)
    const W = 320, H = 72
    const toX = (i) => count > 1 ? (i / (count - 1)) * W : W / 2
    const toY = (v) => H - 4 - (v / maxVal) * 64

    // Smooth path helper (simple cardinal spline)
    const smoothPath = (points) => {
      if (points.length < 2) return ''
      let d = `M${points[0][0]},${points[0][1]}`
      for (let i = 1; i < points.length; i++) {
        const [x0, y0] = points[i - 1]
        const [x1, y1] = points[i]
        const cpx = (x0 + x1) / 2
        d += ` C${cpx},${y0} ${cpx},${y1} ${x1},${y1}`
      }
      return d
    }

    // Last week line (all 7/30 points)
    const lastPoints = lastWeek.map((v, i) => [toX(i), toY(v)])
    const lastPath = smoothPath(lastPoints)

    // This week: only up to todayIndex
    const completedDays = Math.min(todayIndex + 1, count)
    const thisPoints = thisWeek.slice(0, completedDays).map((v, i) => [toX(i), toY(v)])
    const thisPath = smoothPath(thisPoints)

    // Area fill: path + close down to baseline
    let areaPath = ''
    if (thisPoints.length >= 2) {
      areaPath = thisPath + ` L${thisPoints[thisPoints.length-1][0]},${H} L${thisPoints[0][0]},${H} Z`
    }

    // Today dot position
    const todayX = todayIndex < count ? toX(todayIndex) : 0
    const todayY = todayIndex < count ? toY(thisWeek[todayIndex]) : 0

    // Future day positions
    const futureDots = []
    for (let i = todayIndex + 1; i < count; i++) {
      futureDots.push({ x: toX(i), y: H / 2 })
    }

    return { lastPath, thisPath, areaPath, todayX, todayY, futureDots }
  }, [chartData])

  // ── Delta percentage ────────────────────────────────────────────────────────
  const deltaPct = chartData.lastTotal > 0 ? Math.round(((chartData.total - chartData.lastTotal) / chartData.lastTotal) * 100) : (chartData.total > 0 ? 100 : 0)
  const deltaUp = deltaPct >= 0

  // ── Heatmap data ────────────────────────────────────────────────────────────
  const heatmapData = useMemo(() => {
    const weeks = band === 'month' ? 16 : 8
    const today = new Date(); today.setHours(0,0,0,0)
    const totalDays = weeks * 7
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - (totalDays - 1))
    // Adjust to Monday
    const startDay = startDate.getDay()
    const adjustToMon = startDay === 0 ? -6 : 1 - startDay
    startDate.setDate(startDate.getDate() + adjustToMon)

    const grid = []
    const todayStr = localDateStr(today)
    let todayCoord = null

    for (let w = 0; w < weeks; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(startDate)
        date.setDate(startDate.getDate() + w * 7 + d)
        const dStr = localDateStr(date)
        const isFuture = date > today
        const count = isFuture ? -1 : tasks.filter(t => t.done && t.completed_at && localDateStr(new Date(t.completed_at)) === dStr).length
        const isTodayCell = dStr === todayStr
        if (isTodayCell) todayCoord = { w, d }
        col.push({ count, isFuture, isToday: isTodayCell })
      }
      grid.push(col)
    }
    return { grid, todayCoord, weeks }
  }, [tasks, band])

  const heatColor = (count) => {
    if (count < 0) return 'rgba(240,234,214,0.03)'
    if (count === 0) return 'rgba(255,102,68,0.08)'
    if (count <= 2) return 'rgba(255,102,68,0.22)'
    if (count <= 4) return 'rgba(255,102,68,0.38)'
    if (count <= 6) return 'rgba(255,102,68,0.58)'
    return 'rgba(255,102,68,0.78)'
  }

  // ── Insights to render ──────────────────────────────────────────────────────
  const insightCards = useMemo(() => {
    if (insights && insights.length > 0) {
      return insights.slice(0, 3).map(ins => {
        const type = ins.type === 'alert' ? 'headsup' : ins.type === 'win' ? 'win' : 'pattern'
        return { type, body: ins.body || ins.title || '' }
      })
    }
    return INSIGHT_FALLBACK
  }, [insights])

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className={styles.outer}>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={3} />
    </div>
  )

  if (error) return (
    <div className={styles.outer} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60%' }}>
      <ErrorState message="Couldn't load your data." onRetry={() => { setError(false); setLoading(true) }} />
    </div>
  )

  return (
    <div className={styles.outer}>

      {/* 1 — Header + toggle */}
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>Progress</div>
          <div className={styles.headerSub}>{band === 'week' ? getWeekLabel() : getMonthLabel()}</div>
        </div>
        <div className={styles.toggleRow}>
          <button className={band === 'week' ? styles.togglePillActive : styles.togglePill} onClick={() => setBand('week')}>Week</button>
          <button className={band === 'month' ? styles.togglePillActive : styles.togglePill} onClick={() => setBand('month')}>Month</button>
        </div>
      </div>

      {/* 2 — Today rings */}
      <div className={styles.ringsRow}>
        {rings.map((r) => {
          const offset = CIRC * (1 - r.ratio)
          return (
            <div key={r.label} className={styles.ringWrap}>
              <div className={styles.ringSvgOuter}>
                <svg className={styles.ringSvg} width="72" height="72" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="30" fill="none" stroke="rgba(240,234,214,0.07)" strokeWidth="5" />
                  {r.ratio > 0 && (
                    <circle
                      cx="36" cy="36" r="30" fill="none"
                      stroke={r.color} strokeWidth="5" strokeLinecap="round"
                      strokeDasharray={CIRC}
                      strokeDashoffset={mounted ? offset : CIRC}
                      className={styles.ringFill}
                      style={{ animationDelay: `${r.delay}s`, transition: mounted ? 'stroke-dashoffset 1s ease' : 'none' }}
                    />
                  )}
                </svg>
                <div className={styles.ringCenter}>
                  <span className={styles.ringValue} style={{ color: r.color }}>{r.value}</span>
                  <span className={styles.ringSub}>{r.sub}</span>
                </div>
              </div>
              <div className={styles.ringLabel}>{r.label}</div>
            </div>
          )
        })}
      </div>

      {/* 3 — XP + Streak */}
      <div className={styles.xpStreakRow}>
        {/* XP card */}
        <div className={styles.xpCard}>
          <div className={styles.xpHeader}>
            <div className={styles.xpLeft}>
              <FlameSvg />
              <span className={styles.xpNumber}>{xp.toLocaleString()}</span>
              <span className={styles.xpUnit}>XP</span>
            </div>
            <span className={styles.xpToNext}>{xpToNext.toLocaleString()} to next</span>
          </div>
          <div className={styles.xpBar}>
            <div className={styles.xpBarFill} style={{ width: `${xpBarPct}%` }} />
          </div>
        </div>

        {/* Streak card */}
        <div className={styles.streakCard}>
          <div className={styles.streakLeft}>
            <div className={styles.streakNumber}>{streak}</div>
            <div className={styles.streakLabel}>day streak</div>
          </div>
          <div className={styles.streakDivider} />
          <div className={styles.streakRight}>
            <div className={styles.streakDots}>
              {streakDots.map((op, i) => (
                <div key={i} className={styles.streakDot} style={{ background: `rgba(255,102,68,${op})` }} />
              ))}
            </div>
            <div className={styles.streakDotsLabel}>last 7 days</div>
          </div>
        </div>
      </div>

      {/* 4 — Insights */}
      <div className={styles.insightsLabel}>INSIGHTS</div>
      <div className={styles.insightsStack}>
        {insightCards.map((ins, i) => {
          const meta = INSIGHT_META[ins.type] || INSIGHT_META.pattern
          return (
            <div key={i} className={styles.insightCard} style={{ borderLeftColor: meta.color }}>
              <div className={styles.insightHeader}>
                <SparkSvg color={meta.color} />
                <span className={styles.insightTypeLabel} style={{ color: meta.color }}>{meta.label}</span>
              </div>
              <p className={styles.insightBody}>{ins.body}</p>
            </div>
          )
        })}
      </div>

      {/* 5 — Area/line chart */}
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.chartHeaderLeft}>
            <div className={styles.chartTitle}>{band === 'week' ? 'This week' : 'This month'}</div>
            <div className={styles.chartSubtitle}>{band === 'week' ? 'vs last week' : 'vs last month'}</div>
          </div>
          <div className={styles.chartHeaderRight}>
            <div className={styles.chartTotal}>{chartData.total}</div>
            <div className={styles.chartTotalLabel}>tasks done</div>
            <div className={deltaUp ? styles.chartDeltaUp : styles.chartDeltaDown}>
              {deltaUp ? '↑' : '↓'} {Math.abs(deltaPct)}% vs last
            </div>
          </div>
        </div>

        {/* SVG chart */}
        <svg className={styles.chartSvg} viewBox="0 0 320 72" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 25, 50].map(y => (
            <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(240,234,214,0.05)" strokeWidth="1" />
          ))}

          {/* Area gradient */}
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.hot} stopOpacity="0.22" />
              <stop offset="100%" stopColor={C.hot} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Last week dashed line */}
          {buildChartPaths.lastPath && (
            <path d={buildChartPaths.lastPath} fill="none" stroke="rgba(240,234,214,0.16)" strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
          )}

          {/* This week area fill */}
          {buildChartPaths.areaPath && (
            <path d={buildChartPaths.areaPath} fill="url(#areaGrad)" />
          )}

          {/* This week solid line */}
          {buildChartPaths.thisPath && (
            <path d={buildChartPaths.thisPath} fill="none" stroke={C.hot} strokeWidth="2" strokeLinecap="round" className={styles.chartLineAnim} />
          )}

          {/* Today dot */}
          {chartData.todayIndex < chartData.thisWeek.length && (
            <g className={styles.todayDot}>
              <circle cx={buildChartPaths.todayX} cy={buildChartPaths.todayY} r="8" fill="none" stroke="rgba(255,102,68,0.25)" strokeWidth="1" />
              <circle cx={buildChartPaths.todayX} cy={buildChartPaths.todayY} r="4" fill={C.hot} />
            </g>
          )}

          {/* Future day markers */}
          {buildChartPaths.futureDots.map((dot, i) => (
            <circle key={i} cx={dot.x} cy={dot.y} r="2.5" fill="none" stroke="rgba(255,102,68,0.20)" strokeWidth="1" strokeDasharray="2 2" />
          ))}
        </svg>

        {/* Day labels */}
        {band === 'week' && (
          <div className={styles.dayLabels}>
            {['M','T','W','T','F','S','S'].map((lbl, i) => (
              <span key={i} className={
                i === chartData.todayIndex ? styles.dayLabelToday
                : i > chartData.todayIndex ? styles.dayLabelFuture
                : styles.dayLabel
              }>{lbl}</span>
            ))}
          </div>
        )}
        {band === 'month' && (
          <div className={styles.dayLabels}>
            {chartData.labels.map((lbl, i) => (
              <span key={i} className={styles.dayLabel}>{lbl}</span>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className={styles.chartLegend}>
          <div className={styles.legendItem}>
            <svg width="16" height="5"><line x1="0" y1="2.5" x2="16" y2="2.5" stroke="rgba(240,234,214,0.20)" strokeWidth="1.5" strokeDasharray="4 3" /></svg>
            <span className={styles.legendLabel}>{band === 'week' ? 'Last week' : 'Last month'}</span>
          </div>
          <div className={styles.legendItem}>
            <svg width="16" height="5"><line x1="0" y1="2.5" x2="16" y2="2.5" stroke={C.hot} strokeWidth="2" /></svg>
            <span className={styles.legendLabel}>{band === 'week' ? 'This week' : 'This month'}</span>
          </div>
          <div className={styles.legendItem}>
            <svg width="8" height="8"><circle cx="4" cy="4" r="2.5" fill="none" stroke="rgba(255,102,68,0.20)" strokeWidth="1" strokeDasharray="2 2" /></svg>
            <span className={styles.legendLabel}>Remaining</span>
          </div>
        </div>
      </div>

      {/* 6 — Heatmap */}
      <div className={styles.heatmapCard}>
        <div className={styles.heatmapHeader}>
          <div>
            <div className={styles.heatmapTitle}>Consistency</div>
            <div className={styles.heatmapSub}>Last {heatmapData.weeks} weeks</div>
          </div>
          <div className={styles.heatmapLegend}>
            <span className={styles.heatmapLegendLabel}>Less</span>
            {['rgba(255,102,68,0.08)', 'rgba(255,102,68,0.22)', 'rgba(255,102,68,0.48)', 'rgba(255,102,68,0.75)', '#FF6644'].map((bg, i) => (
              <div key={i} className={styles.heatmapSwatch} style={{ background: bg }} />
            ))}
            <span className={styles.heatmapLegendLabel}>More</span>
          </div>
        </div>

        <div className={styles.heatmapGrid}>
          {/* Day labels */}
          <div className={styles.heatmapDayLabels}>
            {['M','T','W','T','F','S','S'].map((l, i) => (
              <div key={i} className={styles.heatmapDayLabel}>{l}</div>
            ))}
          </div>

          {/* Week columns */}
          {heatmapData.grid.map((col, w) => (
            <div key={w} className={styles.heatmapCol}>
              {col.map((cell, d) => (
                <div
                  key={d}
                  className={cell.isToday ? styles.heatmapCellToday : styles.heatmapCell}
                  style={{ background: heatColor(cell.count) }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
