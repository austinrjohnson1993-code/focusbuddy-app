import React, { useState, useEffect, useRef } from 'react'
import styles from '../styles/WelcomeTransition.module.css'

/* ── Ash particle config ────────────────────────────────────────────────── */
const ASH_PARTICLES = [
  { w: 3, h: 6, color: '#F0EAD6', dx: '-28px', dy: '-150px', op: 0.5, dur: '3.8s', delay: '0.2s' },
  { w: 2, h: 4, color: '#FF9977', dx: '45px',  dy: '-160px', op: 0.4, dur: '4.2s', delay: '0.6s' },
  { w: 4, h: 7, color: '#E8D4B8', dx: '-60px', dy: '-140px', op: 0.35, dur: '3.5s', delay: '0s' },
  { w: 2, h: 5, color: '#FFB899', dx: '25px',  dy: '-170px', op: 0.45, dur: '4.6s', delay: '1.0s' },
  { w: 5, h: 9, color: '#FF6644', dx: '-20px', dy: '-130px', op: 0.3, dur: '4.0s', delay: '1.4s' },
  { w: 3, h: 5, color: '#F0EAD6', dx: '65px',  dy: '-155px', op: 0.4, dur: '3.6s', delay: '0.4s' },
]

/* ── Phase 1: "You're all set" ──────────────────────────────────────────── */
function Phase1({ onDone }) {
  const [barDone, setBarDone] = useState(false)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setBarDone(true), 80)
    const t2 = setTimeout(() => setFadeOut(true), 2600)
    const t3 = setTimeout(() => onDone(), 3300)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div className={`${styles.phase1} ${fadeOut ? styles.phase1FadeOut : ''}`}>
      <div className={styles.checkCircle}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M6 12l4 4 8-8" stroke="#4CAF50" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className={styles.headline}>You&rsquo;re all set.</div>
      <div className={styles.subhead}>Cinis has everything it needs to start working for you.</div>
      <div className={styles.barWrap}>
        <div className={styles.barTrack}>
          <div className={`${styles.barFill} ${barDone ? styles.barFillDone : ''}`} />
        </div>
        <div className={styles.barLabel}>Building your profile&hellip;</div>
      </div>
    </div>
  )
}

/* ── Phase 2: Mark reveal + welcome ─────────────────────────────────────── */
function Phase2({ name, onEnter }) {
  const [markPhase, setMarkPhase] = useState(-1)
  const [tracing, setTracing] = useState(false)
  const [floating, setFloating] = useState(false)
  const [showTagline, setShowTagline] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [showEnter, setShowEnter] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const timers = [
      setTimeout(() => setTracing(true), 500),
      setTimeout(() => setMarkPhase(0), 2100),
      setTimeout(() => setMarkPhase(1), 2700),
      setTimeout(() => setMarkPhase(2), 3050),
      setTimeout(() => setMarkPhase(3), 3350),
      setTimeout(() => setMarkPhase(4), 3600),
      setTimeout(() => setMarkPhase(5), 3820),
      setTimeout(() => setMarkPhase(6), 4020),
      setTimeout(() => setMarkPhase(7), 4200),
      setTimeout(() => {
        setFloating(true)
        setTimeout(() => setShowTagline(true), 300)
        setTimeout(() => setShowWelcome(true), 1000)
        setTimeout(() => setShowEnter(true), 1700)
      }, 5000),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const v = (n) => ({
    opacity: markPhase >= n ? 1 : 0,
    transform: markPhase >= n ? 'scale(1)' : 'scale(0.78)',
    transformOrigin: '32px 32px',
    transition: 'opacity 0.5s ease, transform 0.6s cubic-bezier(0.34,1.56,0.64,1)',
  })

  const handleEnter = () => {
    setExiting(true)
    setTimeout(() => onEnter(), 700)
  }

  return (
    <div className={`${styles.phase2} ${exiting ? styles.fadeOut : ''}`}>
      <div className={`${styles.markContainer} ${floating ? styles.markFloat : ''}`}>
        <svg
          width="160" height="160" viewBox="0 0 64 64" fill="none"
          className={floating ? styles.markGlow : ''}
        >
          {/* Outer stroke ring — traces in */}
          <path
            d="M32,2 Q44,8.5 56,15 L56,43 Q44,49.5 32,56 Q20,49.5 8,43 L8,15 Q20,8.5 32,2 Z"
            fill="none" stroke="#FF6644" strokeWidth="1.4"
            opacity={tracing ? 0.48 : 0}
            strokeDasharray="220"
            strokeDashoffset={tracing ? 0 : 220}
            style={{ transition: 'stroke-dashoffset 2.2s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s' }}
          />
          {/* Outer fill */}
          <path d="M32,4 Q43.5,10 54,16 L54,42 Q43.5,48 32,54 Q20.5,48 10,42 L10,16 Q20.5,10 32,4 Z" fill="#FF6644" style={v(0)} />
          {/* Inner dark shell */}
          <path d="M14.9,16.1 L29.8,7.8 Q32,6.6 34.2,7.8 L49.1,16.1 Q51.4,17.4 51.4,20 L51.4,38 Q51.4,40.6 49.1,41.9 L34.2,50.2 Q32,51.4 29.8,50.2 L14.9,41.9 Q12.6,40.6 12.6,38 L12.6,20 Q12.6,17.4 14.9,16.1 Z" fill="#120704" style={v(1)} />
          <polygon points="32,14 46,22 46,40 32,48 18,40 18,22" fill="#5A1005" style={v(2)} />
          <polygon points="32,20 42,26 42,40 32,45 22,40 22,26" fill="#A82010" style={v(3)} />
          <polygon points="32,26 38,29 38,40 32,43 26,40 26,29" fill="#E8321A" style={v(4)} />
          <polygon points="32,29 45,40 40,43 32,47 24,43 19,40" fill="#FF6644" opacity="0.92" style={v(5)} />
          <polygon points="32,33 41,40 38,42 32,45 26,42 23,40" fill="#FFD0C0" opacity="0.76" style={v(6)} />
          <polygon points="32,36 37,40 36,41 32,43 28,41 27,40" fill="#FFF0EB" opacity="0.60" style={v(7)} />
        </svg>

        {/* Pulse rings */}
        {floating && (
          <>
            <div className={`${styles.pulseRing} ${styles.pulseRing1}`} />
            <div className={`${styles.pulseRing} ${styles.pulseRing2}`} />
          </>
        )}

        {/* Ash particles */}
        {floating && ASH_PARTICLES.map((p, i) => (
          <div
            key={i}
            className={`${styles.ashParticle} ${styles.ashActive}`}
            style={{
              width: p.w,
              height: p.h,
              background: p.color,
              '--dx': p.dx,
              '--dy': p.dy,
              '--op': p.op,
              '--dur': p.dur,
              '--delay': p.delay,
              animationDuration: p.dur,
              animationDelay: p.delay,
            }}
          />
        ))}
      </div>

      {/* Copy sequence */}
      <div className={styles.copyWrap}>
        <div className={`${styles.tagline} ${showTagline ? styles.taglineShow : ''}`}>
          Where start meets finished.
        </div>
        <div className={`${styles.welcomeText} ${showWelcome ? styles.welcomeTextShow : ''}`}>
          Welcome, {name}.
        </div>
        {showEnter && (
          <button className={`${styles.enterBtn} ${styles.enterBtnShow}`} onClick={handleEnter}>
            Enter
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function WelcomeTransition({ name = 'there', onComplete }) {
  const [phase, setPhase] = useState('loading') // 'loading' | 'reveal'

  const handlePhase1Done = () => setPhase('reveal')

  const handleEnter = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cinis_welcome_seen', 'true')
    }
    onComplete()
  }

  return (
    <div className={styles.wrap}>
      {phase === 'loading' && <Phase1 onDone={handlePhase1Done} />}
      {phase === 'reveal' && <Phase2 name={name} onEnter={handleEnter} />}
    </div>
  )
}
