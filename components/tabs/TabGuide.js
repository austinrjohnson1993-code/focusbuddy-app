import React, { useState, useEffect } from 'react'
import styles from '../../styles/TabGuide.module.css'
import { localDateStr } from './shared'

/* ── Tag colors ───────────────────────────────────────────────────────────── */
const TAG_COLORS = {
  Cinis: '#FF6644',
  Focus: '#3B8BD4',
  Habits: '#4CAF50',
  Momentum: '#FFB800',
}

/* ── Default strategy cards ───────────────────────────────────────────────── */
const STRATEGIES = [
  { id: 's1', icon: '\uD83C\uDF99\uFE0F', title: 'Use your voice', tag: 'Cinis', body: 'Tap the mic. Say the task. Cinis parses it and drops it in the right place.' },
  { id: 's2', icon: '\uD83E\uDDE0', title: 'Coaching blend matters', tag: 'Cinis', body: 'Your 3 personas shape every AI response. Adjust anytime in Settings.' },
  { id: 's3', icon: '\uD83D\uDC65', title: 'Body doubles work', tag: 'Focus', body: 'Sometimes you just need another person in the room. Partner up in Focus.' },
  { id: 's4', icon: '\uD83D\uDCD3', title: 'Journal before you check in', tag: 'Habits', body: 'Two minutes of writing sharpens what you tell your coach.' },
  { id: 's5', icon: '\uD83D\uDD25', title: 'Protect the streak', tag: 'Momentum', body: 'The hardest day is the one after you skip. One task counts.' },
  { id: 's6', icon: '\u23F1\uFE0F', title: '5 minutes is enough to start', tag: 'Focus', body: 'Set a 5-minute timer. Starting is the hardest part. You\u2019ll almost always keep going.' },
  { id: 's7', icon: '\uD83D\uDEAB', title: 'Break habits beat build habits', tag: 'Habits', body: 'Removing friction often works faster than adding new behavior.' },
]

/* ── Default "For you" fallback cards ─────────────────────────────────────── */
const DEFAULT_FOR_YOU = [
  { icon: '\uD83C\uDFAF', title: 'Focus on one thing', body: 'Star your top task and open Focus. One session changes the day.', cta_label: 'Open Focus', cta_action: 'focus', primary: true },
  { icon: '\uD83D\uDD25', title: 'Protect the streak', body: 'Complete one task or check in. Don\u2019t let today be day 0.', cta_label: 'Open Tasks', cta_action: 'tasks', primary: false },
  { icon: '\uD83D\uDCAC', title: 'Talk to your coach', body: 'A 2-minute check-in resets your direction for the rest of the day.', cta_label: 'Check in', cta_action: 'checkin', primary: false },
]

/* ── Filter tags ──────────────────────────────────────────────────────────── */
const FILTER_TAGS = ['All', 'Cinis', 'Focus', 'Habits', 'Momentum']

/* ── Component ────────────────────────────────────────────────────────────── */
export default function TabGuide({ user, profile, tasks = [], switchTab }) {
  const [filter, setFilter] = useState('All')
  const [forYouCards, setForYouCards] = useState(DEFAULT_FOR_YOU)

  // Load cached "For you" cards or use defaults
  useEffect(() => {
    const todayKey = `cinis_foryou_${localDateStr(new Date())}`
    try {
      const cached = typeof localStorage !== 'undefined' && localStorage.getItem(todayKey)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setForYouCards(parsed)
          return
        }
      }
    } catch {}
    // Could call /api/guide/for-you here in the future
    setForYouCards(DEFAULT_FOR_YOU)
  }, [])

  // Filter strategies
  const filtered = filter === 'All'
    ? STRATEGIES
    : STRATEGIES.filter(s => s.tag === filter)

  return (
    <div className={styles.outer}>
      {/* Header */}
      <div className={styles.headerWrap}>
        <div className={styles.title}>Guide</div>
        <div className={styles.subtitle}>Get the most out of Cinis.</div>
      </div>

      <div className={styles.body}>
        {/* For you strip */}
        <div className={styles.forYouWrap}>
          <div className={styles.forYouLabel}>
            <svg width="9" height="9" viewBox="0 0 16 16" fill="#FF6644"><path d="M8 0l2 5h5l-4 3 2 5-5-3-5 3 2-5L1 5h5z" /></svg>
            <span className={styles.forYouLabelText}>For you right now</span>
          </div>
          <div className={styles.forYouScroll}>
            {forYouCards.map((card, i) => (
              <div key={i} className={card.primary !== false ? styles.fyCardPrimary : styles.fyCardSecondary}>
                <div className={styles.fyIcon}>{card.icon}</div>
                <div className={styles.fyTitle}>{card.title}</div>
                <div className={styles.fyBody}>{card.body}</div>
                <button
                  className={card.primary !== false ? styles.fyCtaPrimary : styles.fyCtaSecondary}
                  onClick={() => switchTab?.(card.cta_action)}
                >
                  {card.cta_label}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Filter chips */}
        <div className={styles.filterRow}>
          {FILTER_TAGS.map(tag => (
            <button
              key={tag}
              className={filter === tag ? styles.filterChipActive : styles.filterChip}
              onClick={() => setFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Strategy cards */}
        <div className={styles.cardsWrap}>
          {filtered.map(s => {
            const color = TAG_COLORS[s.tag] || '#FF6644'
            return (
              <div key={s.id} className={`${styles.stratCard} ${styles.animateIn}`}>
                <span className={styles.stratIcon}>{s.icon}</span>
                <div className={styles.stratRight}>
                  <div className={styles.stratTitleRow}>
                    <span className={styles.stratTitle}>{s.title}</span>
                    <span
                      className={styles.stratTag}
                      style={{ background: `${color}1F`, color }}
                    >
                      {s.tag}
                    </span>
                  </div>
                  <div className={styles.stratBody}>{s.body}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
