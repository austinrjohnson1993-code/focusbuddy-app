import React, { useState } from 'react'
import styles from '../../styles/Dashboard.module.css'
import { GUIDE_TAG_COLORS, GUIDE_STRATEGIES, CINIS_MARK_SVG } from './shared'

export default function TabGuide({ user, profile, showToast, switchTab, setCheckinInput }) {
  // ── State ──────────────────────────────────────────────────────────────────
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

  // ── Derived data ───────────────────────────────────────────────────────────
  const triedCount = guideTried.length
  const savedCount = guideBookmarks.length

  const forYouCards = [
    { id: 'fy1', icon: '🎯', title: 'The one-task rule', preview: 'LLC filing has been pushed 3 times.', cta: 'Open Tasks', action: 'tasks' },
    { id: 'fy2', icon: '🔬', title: 'Shrink the first step', preview: '"File LLC" is vague. "Open Texas SoS website" is a 10-second action.', cta: 'Break it down', action: 'tasks' },
    { id: 'fy3', icon: '🔥', title: 'Protect the streak', preview: `${profile?.current_streak || 0} days running. Don't let today be day 0.`, cta: 'Open Habits', action: 'habits' },
  ]

  const filteredStrategies = GUIDE_STRATEGIES.filter(s => {
    if (guideSelectedFilter === 'All') return true
    if (guideSelectedFilter === 'Saved') return guideBookmarks.includes(s.id)
    return s.tag === guideSelectedFilter
  })

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleBookmarkToggle = (e, strategyId) => {
    e.stopPropagation()
    const isBookmarked = guideBookmarks.includes(strategyId)
    const next = isBookmarked ? guideBookmarks.filter(id => id !== strategyId) : [...guideBookmarks, strategyId]
    setGuideBookmarks(next)
    localStorage.setItem('cinis_guide_bookmarks', JSON.stringify(next))
  }

  const handleTriedToggle = (strategyId) => {
    const isTried = guideTried.includes(strategyId)
    const next = isTried ? guideTried.filter(id => id !== strategyId) : [...guideTried, strategyId]
    setGuideTried(next)
    localStorage.setItem('cinis_guide_tried', JSON.stringify(next))
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingBottom: 80 }}>

        {/* 1 — Header */}
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontFamily: "'Figtree', sans-serif", fontSize: 14, fontWeight: 600, color: '#F5F0E3' }}>Guide</h2>
            <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.3)', fontFamily: "'Figtree', sans-serif" }}>{triedCount} tried · {savedCount} saved</span>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 14, color: 'rgba(245,240,227,0.32)', fontFamily: "'Figtree', sans-serif", lineHeight: 1.5 }}>How to get the most out of Cinis — plus strategies that work.</p>
        </div>

        {/* 2 — For you right now */}
        <div style={{ padding: '0 14px', marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#FF6644', fontFamily: "'Figtree', sans-serif" }}>⚡ For you right now</span>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'scroll', padding: '0 14px 4px', WebkitOverflowScrolling: 'touch' }}>
          {forYouCards.map(card => (
            <div key={card.id} style={{ width: 190, minWidth: 190, flexShrink: 0, background: '#3E3228', borderRadius: 10, padding: '11px 12px', borderTop: '2px solid #FF6644' }}>
              <span style={{ fontSize: 15 }}>{card.icon}</span>
              <p style={{ fontFamily: "'Figtree', sans-serif", fontWeight: 600, fontSize: 14, color: '#F5F0E3', margin: '4px 0 4px' }}>{card.title}</p>
              <p style={{ fontFamily: "'Figtree', sans-serif", fontSize: 14, color: 'rgba(245,240,227,0.32)', margin: '0 0 8px', lineHeight: 1.5 }}>{card.preview}</p>
              <button onClick={() => switchTab(card.action)} style={{ background: '#FF6644', border: 'none', color: '#F5F0E3', fontFamily: "'Figtree', sans-serif", fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center', padding: '10px 0', borderRadius: 6, width: '100%' }}>{card.cta}</button>
            </div>
          ))}
        </div>

        {/* 3 — Filter chips */}
        <div style={{ padding: '0 14px', display: 'flex', gap: 4, overflowX: 'auto', marginTop: 12, marginBottom: 10 }}>
          {['All', 'CINIS', 'QUICK WINS', 'SYSTEMS', 'FOCUS', 'FINANCE', 'NUTRITION', 'Saved'].map(filter => {
            const isActive = guideSelectedFilter === filter
            const label = filter === 'Saved' ? (savedCount > 0 ? `Saved ${savedCount}` : 'Saved') : filter
            return (
              <button key={filter} onClick={() => setGuideSelectedFilter(filter)}
                style={{
                  flex: '0 0 auto', padding: '5px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                  border: isActive ? '1px solid rgba(255,102,68,0.25)' : '1px solid transparent',
                  background: isActive ? 'rgba(255,102,68,0.15)' : 'rgba(245,240,227,0.06)',
                  color: isActive ? '#FF6644' : 'rgba(245,240,227,0.32)',
                  fontFamily: "'Figtree', sans-serif", fontSize: 14, fontWeight: isActive ? 500 : 400,
                  textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer'
                }}>
                {label}
              </button>
            )
          })}
        </div>

        {/* 4 — Strategy cards */}
        <div style={{ padding: '0 14px' }}>
          {filteredStrategies.map(strategy => {
            const tagColor = GUIDE_TAG_COLORS[strategy.tag] || '#FF6644'
            const isExpanded = guideExpandedCard === strategy.id
            const isBookmarked = guideBookmarks.includes(strategy.id)
            const isTried = guideTried.includes(strategy.id)
            return (
              <div key={strategy.id} style={{ marginBottom: 6, background: '#3E3228', borderRadius: 10, overflow: 'hidden' }}>
                {/* Collapsed row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => setGuideExpandedCard(isExpanded ? null : strategy.id)}>
                  <span style={{ fontSize: 18, flexShrink: 0, marginRight: 8, marginTop: 1 }}>{strategy.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontFamily: "'Figtree', sans-serif", fontWeight: 500, fontSize: 14, color: '#F5F0E3' }}>{strategy.title}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, background: `${tagColor}26`, color: tagColor, padding: '4px 8px', borderRadius: 3, fontFamily: "'Figtree', sans-serif", textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0 }}>{strategy.tag}</span>
                    </div>
                    {!isExpanded && <p style={{ fontFamily: "'Figtree', sans-serif", fontSize: 14, color: 'rgba(245,240,227,0.32)', margin: 0, lineHeight: 1.4 }}>{strategy.preview}</p>}
                  </div>
                  <button onClick={(e) => handleBookmarkToggle(e, strategy.id)} style={{ background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', padding: '0 0 0 6px', flexShrink: 0, color: isBookmarked ? '#FFB800' : 'rgba(245,240,227,0.25)', lineHeight: 1 }}>
                    {isBookmarked ? '★' : '☆'}
                  </button>
                  <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.25)', marginLeft: 4, flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
                </div>
                {/* Expanded body */}
                {isExpanded && (
                  <div style={{ padding: '0 12px 10px', borderTop: '1px solid rgba(245,240,227,0.06)' }}>
                    <p style={{ fontFamily: "'Figtree', sans-serif", fontSize: 14, color: 'rgba(245,240,227,0.56)', lineHeight: 1.65, margin: '10px 0 12px' }}>{strategy.body}</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => switchTab(strategy.tag === 'FINANCE' ? 'finance' : strategy.tag === 'NUTRITION' ? 'nutrition' : 'tasks')}
                        style={{ background: '#FF6644', color: '#F5F0E3', border: 'none', padding: '10px 14px', borderRadius: 6, fontFamily: "'Figtree', sans-serif", fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                        Try it
                      </button>
                      <button onClick={() => handleTriedToggle(strategy.id)}
                        style={{ background: isTried ? '#4CAF50' : 'rgba(245,240,227,0.06)', color: '#F5F0E3', border: 'none', padding: '10px 14px', borderRadius: 6, fontFamily: "'Figtree', sans-serif", fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                        {isTried ? 'This worked ✓' : 'This worked'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 5 — Coach CTA */}
        <div style={{ margin: '8px 14px 20px' }}>
          <div onClick={() => { if (setCheckinInput) setCheckinInput('I want to talk through a strategy'); switchTab('checkin') }}
            style={{ background: '#3E3228', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,102,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 64 64" fill="none">
                <path d="M 14.9,16.1 L 29.8,7.8 Q 32,6.6 34.2,7.8 L 49.1,16.1 Q 51.4,17.4 51.4,20 L 51.4,38 Q 51.4,40.6 49.1,41.9 L 34.2,50.2 Q 32,51.4 29.8,50.2 L 14.9,41.9 Q 12.6,40.6 12.6,38 L 12.6,20 Q 12.6,17.4 14.9,16.1 Z" fill="#FF6644"/>
                <polygon points="32,26 38,29 38,40 32,43 26,40 26,29" fill="#E8321A"/>
                <polygon points="32,29 45,40 40,43 32,47 24,43 19,40" fill="#FF6644" opacity="0.92"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "'Figtree', sans-serif", fontWeight: 500, fontSize: 14, color: '#F5F0E3', margin: 0 }}>Need help with something specific?</p>
              <p style={{ fontFamily: "'Figtree', sans-serif", fontSize: 14, color: 'rgba(245,240,227,0.32)', margin: '1px 0 0' }}>Ask your coach in Check-in</p>
            </div>
            <span style={{ fontSize: 14, color: 'rgba(245,240,227,0.25)' }}>›</span>
          </div>
        </div>

      </div>
    </div>
  )
}
