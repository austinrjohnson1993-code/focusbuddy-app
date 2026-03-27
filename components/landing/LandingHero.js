import { useEffect, useState } from 'react'
import styles from '../../styles/Landing.module.css'
import WaitlistForm from './WaitlistForm'

// ── Animated Mark — standalone, not CinisMark ──────────────────────────────
function HeroMark({ size = 100 }) {
  const [tracing, setTracing] = useState(false)
  const [outerFill, setOuterFill] = useState(false)
  const [layers, setLayers] = useState([false, false, false, false, false, false, false])
  const [floatActive, setFloatActive] = useState(false)
  const [glowActive, setGlowActive] = useState(false)
  const [ringsActive, setRingsActive] = useState(false)

  useEffect(() => {
    const timers = [
      setTimeout(() => setTracing(true), 600),
      setTimeout(() => setOuterFill(true), 2400),
      setTimeout(() => setLayers(p => { const n=[...p]; n[0]=true; return n }), 3000),
      setTimeout(() => setLayers(p => { const n=[...p]; n[1]=true; return n }), 3350),
      setTimeout(() => setLayers(p => { const n=[...p]; n[2]=true; return n }), 3650),
      setTimeout(() => setLayers(p => { const n=[...p]; n[3]=true; return n }), 3900),
      setTimeout(() => setLayers(p => { const n=[...p]; n[4]=true; return n }), 4120),
      setTimeout(() => setLayers(p => { const n=[...p]; n[5]=true; return n }), 4320),
      setTimeout(() => setLayers(p => { const n=[...p]; n[6]=true; return n }), 4500),
      setTimeout(() => { setFloatActive(true); setGlowActive(true); setRingsActive(true) }, 5200),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const layerStyle = (visible) => ({
    opacity: visible ? undefined : 0,
    animation: visible ? 'layerPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
  })

  return (
    <div
      className={[
        styles.markWrap,
        floatActive ? styles.markFloating : '',
        glowActive ? styles.markGlowing : '',
      ].join(' ')}
    >
      {ringsActive && (
        <div className={styles.pulseRings} aria-hidden="true">
          <div className={styles.pulseRing} />
          <div className={`${styles.pulseRing} ${styles.pulseRing2}`} />
        </div>
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        className={styles.markSvg}
        aria-hidden="true"
      >
        {/* Outer stroke ring — traces in */}
        <path
          d="M32,2 Q44,8.5 56,15 L56,43 Q44,49.5 32,56 Q20,49.5 8,43 L8,15 Q20,8.5 32,2 Z"
          fill="none"
          stroke="#FF6644"
          strokeWidth="1.4"
          opacity="0.45"
          strokeDasharray="220"
          strokeDashoffset={tracing ? 0 : 220}
          style={{ transition: 'stroke-dashoffset 2s cubic-bezier(0.25,0.46,0.45,0.94)' }}
        />
        {/* Outer fill */}
        <path
          d="M32,4 Q43.5,10 54,16 L54,42 Q43.5,48 32,54 Q20.5,48 10,42 L10,16 Q20.5,10 32,4 Z"
          fill="#FF6644"
          style={layerStyle(outerFill)}
        />
        {/* Inner layers */}
        <polygon points="32,7 51,18 51,40 32,52 13,40 13,18" fill="#120704" style={layerStyle(layers[0])} />
        <polygon points="32,14 46,22 46,40 32,48 18,40 18,22" fill="#5A1005" style={layerStyle(layers[1])} />
        <polygon points="32,20 42,26 42,40 32,45 22,40 22,26" fill="#A82010" style={layerStyle(layers[2])} />
        <polygon points="32,26 38,29 38,40 32,43 26,40 26,29" fill="#E8321A" style={layerStyle(layers[3])} />
        <polygon points="32,29 45,40 40,43 32,47 24,43 19,40" fill="#FF6644" opacity="0.92" style={layerStyle(layers[4])} />
        <polygon points="32,33 41,40 38,42 32,45 26,42 23,40" fill="#FFD0C0" opacity="0.76" style={layerStyle(layers[5])} />
        <polygon points="32,36 37,40 36,41 32,43 28,41 27,40" fill="#FFF0EB" opacity="0.60" style={layerStyle(layers[6])} />
      </svg>
    </div>
  )
}

// ── Hero ───────────────────────────────────────────────────────────────────
export default function LandingHero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroContent}>
        {/* Left: copy + form */}
        <div className={styles.heroCopy}>
          <p className={styles.headlineLeadin}>
            Everyone has a gap between<br />what they intend to do and
          </p>
          <h1 className={styles.headlineImpact}>WHAT GETS DONE.</h1>
          <p className={styles.headlineSep}>Other apps help you organize that gap.</p>
          <p className={styles.headlineBracketed}>
            <span className={styles.headlineBracket}>[</span>
            Cinis closes it.
            <span className={styles.headlineBracket}>]</span>
          </p>
          <WaitlistForm />
        </div>

        {/* Right: mark (desktop only via CSS) */}
        <div className={styles.heroMarkWrap}>
          <HeroMark />
        </div>
      </div>
    </section>
  )
}
