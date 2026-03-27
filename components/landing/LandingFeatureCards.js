import { useState, useEffect, useRef, useCallback } from 'react'
import styles from '../../styles/Landing.module.css'
import CinisMark from '../../lib/CinisMark'

// ── Conversation data (slow timing ~3s between messages) ────────────────────
const CONVERSATIONS = {
  '01': [
    { f: 'coach', t: 'Good morning. You have 5 things on the list today.', d: 0 },
    { f: 'coach', t: "That proposal has been rescheduled three times. What\u2019s the real blocker?", d: 3000 },
    { f: 'user', t: 'I keep starting it in my head but never actually opening it', d: 6500 },
    { f: 'coach', t: "Open it right now. Nothing else \u2014 just open it.", d: 9500 },
    { f: 'user', t: 'ok. it\u2019s open.', d: 12500 },
    { f: 'coach', t: "That\u2019s the hardest part done. I\u2019ll check back in 25 minutes.", d: 15000 },
  ],
  '02': [
    { f: 'voice', t: '\u201CCall Marcus \u2014 the contract needs to be settled before Friday\u201D', d: 0 },
    { f: 'coach', t: 'Caught. Task: Call Marcus re contract \u00B7 Due Friday.', d: 2500 },
    { f: 'voice', t: '\u201CRemind me to pick up the prescription tonight on the way home\u201D', d: 5500 },
    { f: 'coach', t: 'Done. Reminder set for 5:30pm.', d: 7500 },
    { f: 'coach', t: '2 things in 20 seconds. Your hands were full. Nothing got dropped.', d: 10500 },
  ],
  '03': [
    { f: 'coach', t: 'Jordan just started a 45-minute session \u2014 working on a pitch deck.', d: 0 },
    { f: 'coach', t: 'Want to join? Same timer. No messages until it ends.', d: 3000 },
    { f: 'user', t: 'yeah. in.', d: 6000 },
    { f: 'coach', t: "Session started. 45:00. You both showed up.", d: 8000 },
    { f: 'sys', t: '\u2014 45 minutes later \u2014', d: 11000 },
    { f: 'coach', t: "Done. Jordan finished. So did you. That\u2019s what showing up feels like.", d: 13500 },
  ],
  '04': [
    { f: 'coach', t: 'I looked at your last 90 days. Found something.', d: 0 },
    { f: 'coach', t: 'Your three best weeks all started with a check-in before 8:30am. Every single day.', d: 3000 },
    { f: 'user', t: 'I had no idea that was the pattern', d: 6500 },
    { f: 'coach', t: "Most people don\u2019t. Tomorrow \u2014 open the app before you open anything else.", d: 9000 },
  ],
  '05': [
    { f: 'coach', t: 'Your electric bill is due Thursday. $124. Sitting in the Finance tab untouched.', d: 0 },
    { f: 'coach', t: "You\u2019re also 4 days into your journaling streak. Tonight matters.", d: 3000 },
    { f: 'user', t: 'I completely forgot about that bill', d: 6000 },
    { f: 'coach', t: "That\u2019s why it lives here. Pay it now \u2014 two minutes.", d: 8500 },
    { f: 'user', t: 'done. paid.', d: 11500 },
    { f: 'coach', t: "One less thing following you around. That\u2019s the whole point.", d: 14000 },
  ],
}

// ── Card data ───────────────────────────────────────────────────────────────
const CARDS = [
  {
    num: '01',
    label: 'AI Check-In',
    scene: "The day is a series of negotiations. You wake up with a vision. You end the day with an excuse. Somewhere in between, the perfect time to start vanished.",
    feature: "Cinis meets you where you are, finds what\u2019s actually in the way, and gets you to the first move.",
    benefit: "YOU STOP NEGOTIATING.\nYOU START FINISHING.",
  },
  {
    num: '02',
    label: 'Voice Capture',
    scene: "Ideas have a half-life. Your best thoughts happen in motion, when your hands are busy and your mind isn\u2019t. If you don\u2019t catch them instantly, they\u2019re gone.",
    feature: "Say it out loud. Cinis catches it, files it, and surfaces it when it matters.",
    benefit: "CAPTURE THE SPARK.\nNOTHING GETS LEFT BEHIND.",
  },
  {
    num: '03',
    label: 'Focus Sessions',
    scene: "You\u2019ve cleared your desk. You\u2019ve silenced your phone. But you\u2019re still staring at a blinking cursor. The hardest part of work isn\u2019t the work \u2014 it\u2019s the transition into it.",
    feature: "Work alongside someone on the same timer. No talking. Just the quiet pull of not being alone in it.",
    benefit: "ENTER THE FLOW.\nYOU STOP WAITING. YOU JUST START.",
  },
  {
    num: '04',
    label: 'Progress & Insights',
    scene: "You\u2019ve had weeks where everything worked. You can\u2019t recreate them because you never understood what made them different.",
    feature: "Cinis tracks the patterns of your peak performance so your best weeks stop being accidents.",
    benefit: "DECODE YOUR MOMENTUM.\nGOLD WEEKS BECOME THE BASELINE.",
  },
  {
    num: '05',
    label: 'One Place',
    scene: "Your brain is for having ideas, not storing them. Tasks in your head, habits in an app, notes in a drawer. When your system is fragmented, your focus is too.",
    feature: "Tasks, habits, finances, and focus in one place. One system. Nothing waiting to surprise you.",
    benefit: "CLOSE THE TABS.\nCLEAR THE NOISE.",
    fullWidth: true,
  },
]

// ── App UI Panels ──────────────────────────────────────────────────────────

function AppUICheckin() {
  return (
    <div className={styles.appUIWrap}>
      <div className={styles.appUISectionHeader}>Morning Check-In</div>
      <div className={styles.appUICard}>
        <div className={styles.appUICardHeading}>What&apos;s actually in the way?</div>
        <div className={styles.appUICardBody}>
          That proposal has been rescheduled three times. Not judging — just noticed.
        </div>
        <div className={styles.appUIBtnRow}>
          <span className={`${styles.appUIBtn} ${styles.appUIBtnActive}`}>Just open it</span>
          <span className={styles.appUIBtn}>I&apos;m blocked</span>
          <span className={styles.appUIBtn}>Not today</span>
        </div>
      </div>
      <div className={styles.appUIRow} style={{ animationDelay: '60ms' }}>
        <div className={styles.appUICheck} />
        <span className={styles.appUILabel}>Finish proposal draft</span>
        <span className={`${styles.appUIBadge} ${styles.appUIBadgeHot}`}>TODAY</span>
      </div>
      <div className={styles.appUIRow} style={{ animationDelay: '120ms' }}>
        <div className={styles.appUICheck} />
        <span className={styles.appUILabel}>Reply to Marcus</span>
      </div>
      <div className={styles.appUIRow} style={{ animationDelay: '180ms' }}>
        <div className={styles.appUICheck} />
        <span className={styles.appUILabel}>Review contract terms</span>
      </div>
    </div>
  )
}

function AppUIVoice() {
  const bars = Array.from({ length: 15 }, (_, i) => ({
    height: [14, 22, 10, 28, 18, 32, 12, 36, 20, 26, 16, 30, 8, 24, 14][i],
    opacity: [0.4, 0.7, 0.3, 0.9, 0.5, 1, 0.4, 0.8, 0.6, 0.7, 0.5, 0.9, 0.3, 0.6, 0.4][i],
    delay: `${i * 0.08}s`,
  }))

  return (
    <div className={styles.appUIWrap}>
      <div className={styles.appUISectionHeader}>Voice Capture</div>
      <div className={styles.waveformWrap}>
        {bars.map((b, i) => (
          <div
            key={i}
            className={styles.waveformBar}
            style={{ height: b.height, opacity: b.opacity, animationDelay: b.delay }}
          />
        ))}
      </div>
      <div className={styles.micButton}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
      </div>
      <div className={styles.micLabel}>Listening...</div>
      <div className={styles.appUIRow} style={{ animationDelay: '60ms' }}>
        <div className={`${styles.appUICheck} ${styles.appUICheckDone}`} />
        <span className={styles.appUILabel}>Call Marcus · contract · Fri</span>
      </div>
      <div className={styles.appUIRow} style={{ animationDelay: '120ms' }}>
        <div className={`${styles.appUICheck} ${styles.appUICheckDone}`} />
        <span className={styles.appUILabel}>Prescription pickup · 5:30pm</span>
      </div>
      <div className={styles.appUIRow} style={{ animationDelay: '180ms' }}>
        <div className={`${styles.appUICheck} ${styles.appUICheckDone}`} />
        <span className={styles.appUILabel}>Pay Marcus $40 · Friday</span>
      </div>
    </div>
  )
}

function AppUIFocus() {
  return (
    <div className={styles.appUIWrap}>
      <div className={styles.appUISectionHeader}>Focus · Paired Session</div>
      <div className={styles.appUICard} style={{ textAlign: 'center' }}>
        <div className={styles.timerDisplay}>38:14</div>
        <div className={styles.timerLabel}>remaining</div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: '15%' }} />
        </div>
        <div className={styles.appUIBtnRow} style={{ justifyContent: 'center' }}>
          <span className={`${styles.appUIBtn} ${styles.appUIBtnActive}`}>Pause</span>
          <span className={styles.appUIBtn}>Got Stuck</span>
        </div>
      </div>
      <div className={styles.participantsRow}>
        <div className={styles.participantCard}>
          <div className={styles.participantDot} />
          <div>
            <div className={styles.participantName}>You</div>
            <div className={styles.participantTask}>Proposal</div>
          </div>
        </div>
        <div className={styles.participantCard}>
          <div className={styles.participantDot} />
          <div>
            <div className={styles.participantName}>Jordan</div>
            <div className={styles.participantTask}>Pitch deck</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AppUIProgress() {
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const values = [5, 8, 4, 9, 7, 10, 6]
  const maxVal = Math.max(...values)

  return (
    <div className={styles.appUIWrap}>
      <div className={styles.appUISectionHeader}>Your Week</div>
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#FF6644' }}>12</div>
          <div className={styles.statLabel}>day streak</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue} style={{ color: '#FFB800' }}>2,840</div>
          <div className={styles.statLabel}>XP total</div>
        </div>
      </div>
      <div className={styles.barChart}>
        {days.map((day, i) => (
          <div key={i} className={styles.barCol}>
            <div
              className={styles.bar}
              style={{
                '--bar-h': `${(values[i] / maxVal) * 100}%`,
                height: `${(values[i] / maxVal) * 100}%`,
                opacity: i === 5 ? 1 : 0.22,
                animationDelay: `${i * 0.08}s`,
              }}
            />
            <div className={styles.barLabel}>{day}</div>
          </div>
        ))}
      </div>
      <div className={styles.patternCallout}>
        <div className={styles.patternLabel}>PATTERN FOUND</div>
        <div className={styles.patternText}>
          Your best weeks all started before 8:30am. This week: 0 for 4 on morning check-ins.
        </div>
      </div>
    </div>
  )
}

function AppUIOnePlace() {
  return (
    <div className={styles.appUIWrap}>
      <div className={styles.appUISectionHeader}>Everything · One Place</div>
      <div className={styles.gridTwoByTwo}>
        <div className={styles.gridCell}>
          <div className={styles.gridCellLabel} style={{ color: '#FF6644' }}>Tasks</div>
          <div className={styles.gridCellValue}>5 due today</div>
        </div>
        <div className={styles.gridCell}>
          <div className={styles.gridCellLabel} style={{ color: '#E8321A' }}>Finance</div>
          <div className={styles.gridCellValue}>Bill due Thu · $124</div>
        </div>
        <div className={styles.gridCell}>
          <div className={styles.gridCellLabel} style={{ color: '#4CAF50' }}>Habits</div>
          <div className={styles.gridCellValue}>4-day streak</div>
        </div>
        <div className={styles.gridCell}>
          <div className={styles.gridCellLabel} style={{ color: '#3B8BD4' }}>Nutrition</div>
          <div className={styles.gridCellValue}>Protein on track</div>
        </div>
      </div>
      <div className={styles.summaryCallout}>
        <div className={styles.summaryLabel}>NOTHING MISSED TODAY</div>
        <div className={styles.summaryText}>3 tasks done · Bill paid · Streak alive · Protein hit</div>
      </div>
    </div>
  )
}

const APP_UI_MAP = {
  '01': AppUICheckin,
  '02': AppUIVoice,
  '03': AppUIFocus,
  '04': AppUIProgress,
  '05': AppUIOnePlace,
}

// ── Chat bubble ────────────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  if (msg.f === 'sys') {
    return (
      <div className={`${styles.chatBubble} ${styles.chatSystem}`}>
        <span className={`${styles.chatBubbleText} ${styles.chatSystemText}`}>{msg.t}</span>
      </div>
    )
  }

  if (msg.f === 'user') {
    return (
      <div className={`${styles.chatBubble} ${styles.chatUser}`}>
        <span className={`${styles.chatBubbleText} ${styles.chatUserText}`}>{msg.t}</span>
      </div>
    )
  }

  if (msg.f === 'voice') {
    return (
      <div className={`${styles.chatBubble} ${styles.chatVoice}`}>
        <span className={`${styles.chatBubbleText} ${styles.chatVoiceText}`}>
          <span className={styles.chatVoiceLabel}>VOICE</span>
          {msg.t}
        </span>
      </div>
    )
  }

  // coach
  return (
    <div className={`${styles.chatBubble} ${styles.chatCoach}`}>
      <div className={styles.chatAvatar} aria-hidden="true">
        <CinisMark size={12} />
      </div>
      <span className={`${styles.chatBubbleText} ${styles.chatCoachText}`}>{msg.t}</span>
    </div>
  )
}

// ── Demo overlay (full-screen) ─────────────────────────────────────────────
function DemoOverlay({ card, onClose }) {
  const [activeTab, setActiveTab] = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)
  const [appTabPulse, setAppTabPulse] = useState(false)
  const contentRef = useRef(null)
  const timersRef = useRef([])

  const convo = CONVERSATIONS[card.num] || []
  const AppUI = APP_UI_MAP[card.num]

  // Animate bubbles in one by one
  useEffect(() => {
    if (activeTab !== 0 || convo.length === 0) return
    setVisibleCount(0)
    const timers = convo.map((msg, i) =>
      setTimeout(() => {
        setVisibleCount(prev => prev + 1)
        // Scroll to bottom
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight
        }
      }, msg.d)
    )
    // Pulse "In the app" tab after last message
    const lastDelay = convo[convo.length - 1].d + 2000
    timers.push(setTimeout(() => setAppTabPulse(true), lastDelay))
    timersRef.current = timers
    return () => timers.forEach(clearTimeout)
  }, [activeTab, card.num, convo])

  // Prevent body scroll when overlay is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = useCallback((e) => {
    e.stopPropagation()
    timersRef.current.forEach(clearTimeout)
    onClose()
  }, [onClose])

  return (
    <div className={styles.overlayBackdrop} onClick={handleClose}>
      <div className={styles.overlayPanel} onClick={e => e.stopPropagation()}>
        <div className={styles.overlayHeader}>
          <span className={styles.overlayCardLabel}>{card.num} — {card.label}</span>
          <button className={styles.overlayClose} onClick={handleClose} aria-label="Close">&#10005;</button>
        </div>
        <div className={styles.overlayTabs}>
          {convo.length > 0 && (
            <button
              className={`${styles.overlayTab} ${activeTab === 0 ? styles.overlayTabActive : ''}`}
              onClick={() => setActiveTab(0)}
            >
              Conversation
            </button>
          )}
          <button
            className={`${styles.overlayTab} ${activeTab === 1 ? styles.overlayTabActive : ''} ${appTabPulse && activeTab !== 1 ? styles.overlayTabPulse : ''}`}
            onClick={() => { setActiveTab(1); setAppTabPulse(false) }}
          >
            In the app
          </button>
        </div>
        <div className={styles.overlayContent} ref={contentRef}>
          {activeTab === 0 && convo.slice(0, visibleCount).map((msg, i) => (
            <ChatBubble key={i} msg={msg} />
          ))}
          {activeTab === 1 && AppUI && <AppUI />}
        </div>
        {activeTab === 0 && (
          <div className={styles.overlayInputBar}>
            <div className={styles.overlayInputBarInner}>Your reply...</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Card 05 — full-width with inline app UI ────────────────────────────────
function Card05({ card }) {
  return (
    <div className={`${styles.featureCard} ${styles.featureCardFull}`} style={{ cursor: 'default' }}>
      <div className={styles.featureCardFullInner}>
        <div className={styles.featureCardFullCopy}>
          <div className={styles.featureNum}>{card.num} —</div>
          <div className={styles.featureLabel}>{card.label}</div>
          <div className={styles.featureScene}>{card.scene}</div>
          <div className={styles.featureFeature}>{card.feature}</div>
          <div className={styles.featureBenefit}>{card.benefit}</div>
        </div>
        <div className={styles.featureCardFullUI}>
          <AppUIOnePlace />
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function LandingFeatureCards() {
  const [openCard, setOpenCard] = useState(null)
  const gridRef = useRef(null)

  // Scroll-triggered card reveal on desktop
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || !gridRef.current) return
    const cards = gridRef.current.querySelectorAll('[data-card]')
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.featureCardVisible)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    cards.forEach(c => observer.observe(c))
    return () => observer.disconnect()
  }, [])

  const regularCards = CARDS.filter(c => !c.fullWidth)
  const fullCard = CARDS.find(c => c.fullWidth)

  return (
    <section className={styles.featuresSection} id="features">
      <div className={styles.featuresSectionEyebrow}>You already know this feeling.</div>
      <h2 className={styles.featuresSectionHeadline}>
        Here&apos;s what{' '}
        <span className={styles.featuresSectionHeadlineAccent}>changes.</span>
      </h2>
      <div className={styles.featuresSectionSub}>Tap any card — both tabs work immediately.</div>
      <div className={styles.featuresGrid} ref={gridRef}>
        {regularCards.map((card, i) => (
          <div
            key={card.num}
            className={`${styles.featureCard} ${styles.featureCardHidden}`}
            data-card={i}
            onClick={() => setOpenCard(card.num)}
          >
            <div className={styles.featureCardTop}>
              <div className={styles.featureNum}>{card.num} —</div>
              <div className={styles.featureLabel}>{card.label}</div>
              <div className={styles.featureScene}>{card.scene}</div>
            </div>
            <div className={styles.featureCardDivider} />
            <div className={styles.featureCardBottom}>
              <div className={styles.featureFeature}>{card.feature}</div>
              <div className={styles.featureBenefit}>{card.benefit}</div>
              <div className={styles.featureCta}>Tap to see it live →</div>
            </div>
          </div>
        ))}
        {fullCard && <Card05 card={fullCard} />}
      </div>
      {openCard && (
        <DemoOverlay
          card={CARDS.find(c => c.num === openCard)}
          onClose={() => setOpenCard(null)}
        />
      )}
    </section>
  )
}
