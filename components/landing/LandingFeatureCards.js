import { useState, useEffect, useRef } from 'react'
import styles from '../../styles/Landing.module.css'
import CinisMark from '../../lib/CinisMark'

// ── Card data ──────────────────────────────────────────────────────────────
const CARDS = [
  {
    num: '01',
    label: 'Close the Gap',
    scene: 'You have 14 things on your list. You opened another app.',
    feature: "Tasks that carry context — priority, timing, and a coach that knows when you're circling.",
    benefit: 'THINGS GET DONE',
    convo: [
      { type: 'coach', text: "What's the one thing that would make today feel like a win?" },
      { type: 'user', text: "Finish the project proposal. Been avoiding it for three days." },
      { type: 'coach', text: "Got it. What's the first step you can do in the next 10 minutes?" },
      { type: 'user', text: "Open the doc and write one sentence." },
      { type: 'system', text: 'Task created · Project proposal — Due today' },
      { type: 'coach', text: "That's it. Go. I'll check back at noon." },
    ],
    appUI: () => (
      <div className={styles.appUI}>
        {[
          { done: false, label: 'Project proposal', meta: '10am–12pm', alert: true },
          { done: true,  label: 'Reply to emails', meta: null, alert: false },
          { done: false, label: 'Team check-in', meta: '2pm', alert: false },
          { done: false, label: 'Follow up with Jordan', meta: 'Tomorrow', alert: false },
        ].map((task, i) => (
          <div key={i} className={styles.appUIRow} style={{ animationDelay: `${i * 60}ms` }}>
            <div
              className={styles.appUICheck}
              style={{
                border: task.done ? 'none' : '1.5px solid rgba(255,102,68,0.4)',
                background: task.done ? '#FF6644' : 'transparent',
              }}
            />
            <span className={styles.appUILabel} style={{ textDecoration: task.done ? 'line-through' : 'none', opacity: task.done ? 0.4 : 1 }}>
              {task.label}
            </span>
            {task.alert && <span className={`${styles.appUIBadge} ${styles.appUIBadgeAlert}`}>Today</span>}
            {task.meta && !task.alert && <span className={styles.appUIMeta}>{task.meta}</span>}
          </div>
        ))}
      </div>
    ),
  },
  {
    num: '02',
    label: 'Morning Reach-Out',
    scene: "It's 9am. You're already behind.",
    feature: "Cinis checks in before you've had a chance to forget. Daily conversations that fit around how you work.",
    benefit: 'YOU HEAR FROM IT',
    convo: [
      { type: 'coach', text: "Morning. You said yesterday felt scattered. What's one thing you want to protect today?" },
      { type: 'user', text: "Focus time. No interruptions before noon." },
      { type: 'coach', text: "Noted. I won't ping you until 12:30. How's your energy right now?" },
      { type: 'voice', text: "Honestly low, slept pretty bad.", label: 'VOICE' },
      { type: 'coach', text: "Low energy day — let's keep the list short. Three things max. What are they?" },
    ],
    appUI: () => (
      <div className={styles.appUI}>
        <div className={styles.appUIRow}>
          <span className={styles.appUILabel} style={{ fontSize: 11, color: '#FF6644', fontWeight: 600, letterSpacing: '0.1em' }}>
            MORNING CHECK-IN
          </span>
        </div>
        {['Clear and ready', 'A bit scattered', 'Low energy', 'Overwhelmed'].map((opt, i) => (
          <div key={i} className={styles.appUIRow} style={{ animationDelay: `${i * 70}ms`, cursor: 'pointer' }}>
            <span className={styles.appUILabel}>{opt}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: '03',
    label: 'Bill Watch',
    scene: 'You paid that late. Again.',
    feature: 'Every bill tracked. Due dates flagged. Autopay labeled. No more surprise charges.',
    benefit: 'NOTHING SLIPS',
    convo: [
      { type: 'system', text: 'Bill alert · Electric — due in 2 days · $142' },
      { type: 'coach', text: "Your electric bill hits Thursday. Autopay is off — want me to remind you tomorrow morning?" },
      { type: 'user', text: "Yes, and add it to my task list." },
      { type: 'coach', text: "Done. Added 'Pay electric' to tasks for Wednesday at 9am." },
      { type: 'system', text: "Task created · Pay electric — Wed 9am" },
    ],
    appUI: () => (
      <div className={styles.appUI}>
        {[
          { name: 'Electric', amount: '$142', dueIn: 2, autopay: false, urgent: true },
          { name: 'Netflix', amount: '$17', dueIn: 8, autopay: true, urgent: false },
          { name: 'Rent', amount: '$1,250', dueIn: 12, autopay: false, urgent: false },
        ].map((bill, i) => (
          <div key={i} className={styles.appUIRow} style={{ animationDelay: `${i * 70}ms` }}>
            <span className={styles.appUILabel}>{bill.name}</span>
            {bill.urgent && <span className={`${styles.appUIBadge} ${styles.appUIBadgeAlert}`}>Due soon</span>}
            {!bill.urgent && bill.autopay && <span className={`${styles.appUIBadge} ${styles.appUIBadgeGreen}`}>Autopay</span>}
            <span className={styles.appUIMeta}>{bill.amount}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: '04',
    label: 'It Remembers',
    scene: 'You explained your ADHD three times this week.',
    feature: 'Cinis builds a picture of how you work — once — and uses it every single time.',
    benefit: 'NO RE-EXPLAINING',
    convo: [
      { type: 'coach', text: "You mentioned last week that mornings are hard. I moved your big tasks to 11am." },
      { type: 'user', text: "How did you remember that?" },
      { type: 'coach', text: "It's in your profile. You also said external pressure helps — so I gave you a 2pm checkpoint." },
      { type: 'user', text: "That's actually really helpful." },
      { type: 'coach', text: "That's the point." },
    ],
    appUI: () => (
      <div className={styles.appUI}>
        <div className={styles.appUIRow}>
          <span className={styles.appUILabel} style={{ fontSize: 11, color: 'rgba(245,240,227,0.4)', fontWeight: 600, letterSpacing: '0.1em' }}>
            YOUR COACHING PROFILE
          </span>
        </div>
        {[
          { key: 'Energy peak', value: 'Late morning' },
          { key: 'Stall pattern', value: 'Overwhelm → avoidance' },
          { key: 'Coach voice', value: 'Firm but warm' },
          { key: 'Best motivator', value: 'Checkpoints' },
        ].map((item, i) => (
          <div key={i} className={styles.appUIRow} style={{ animationDelay: `${i * 65}ms` }}>
            <span className={styles.appUIMeta}>{item.key}</span>
            <span className={styles.appUILabel} style={{ textAlign: 'right' }}>{item.value}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: '05',
    label: 'One Place',
    scene: 'Your life runs on 12 apps.',
    feature: 'Tasks, bills, coach, goals — one signal, one view, one home. Everything you need to keep moving.',
    benefit: 'ONE HOME',
    convo: [],
    fullWidth: true,
    appUI: () => (
      <div className={styles.appUI}>
        <div className={styles.appUIRow}>
          <span className={styles.appUILabel} style={{ fontSize: 11, color: '#FF6644', fontWeight: 600, letterSpacing: '0.1em' }}>TODAY</span>
          <span className={styles.appUIMeta}>3 tasks · 1 bill</span>
        </div>
        {[
          { icon: '✓', label: 'Send invoice', meta: 'Tasks', done: false },
          { icon: '⚡', label: 'Pay electric', meta: 'Bills · Due today', done: false },
          { icon: '💬', label: "Morning check-in", meta: 'Coach', done: true },
        ].map((item, i) => (
          <div key={i} className={styles.appUIRow} style={{ animationDelay: `${i * 65}ms` }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>{item.icon}</span>
            <span className={styles.appUILabel} style={{ opacity: item.done ? 0.4 : 1, textDecoration: item.done ? 'line-through' : 'none' }}>
              {item.label}
            </span>
            <span className={styles.appUIMeta}>{item.meta}</span>
          </div>
        ))}
      </div>
    ),
  },
]

// ── Chat bubble component ──────────────────────────────────────────────────
function ChatBubble({ msg, delay }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(t)
  }, [delay])

  if (!visible) return null

  if (msg.type === 'system') {
    return (
      <div className={`${styles.chatBubble} ${styles.chatSystem}`}>
        <span className={`${styles.chatBubbleText} ${styles.chatSystemText}`}>{msg.text}</span>
      </div>
    )
  }

  if (msg.type === 'user') {
    return (
      <div className={`${styles.chatBubble} ${styles.chatUser}`}>
        <span className={`${styles.chatBubbleText} ${styles.chatUserText}`}>{msg.text}</span>
      </div>
    )
  }

  if (msg.type === 'voice') {
    return (
      <div className={`${styles.chatBubble} ${styles.chatVoice}`}>
        <span className={`${styles.chatBubbleText} ${styles.chatVoiceText}`}>
          <span className={styles.chatVoiceLabel}>{msg.label || 'VOICE'}</span>
          {msg.text}
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
      <span className={`${styles.chatBubbleText} ${styles.chatCoachText}`}>{msg.text}</span>
    </div>
  )
}

// ── Demo overlay ───────────────────────────────────────────────────────────
function DemoOverlay({ card, onClose }) {
  const [activeTab, setActiveTab] = useState(0)
  const [appTabPing, setAppTabPing] = useState(false)
  const timersRef = useRef([])

  // After conversation completes, ping the "In the app" tab
  useEffect(() => {
    if (card.convo.length === 0) return
    const lastDelay = card.convo.length * 600 + 400
    const t = setTimeout(() => setAppTabPing(true), lastDelay)
    timersRef.current.push(t)
    return () => timersRef.current.forEach(clearTimeout)
  }, [card])

  const handleClose = (e) => {
    e.stopPropagation()
    timersRef.current.forEach(clearTimeout)
    onClose()
  }

  const convoBubbles = card.convo.map((msg, i) => ({
    ...msg,
    delay: i * 600,
  }))

  return (
    <div className={styles.demoOverlay} onClick={e => e.stopPropagation()}>
      <div className={styles.demoHeader}>
        <div className={styles.demoTabs}>
          {card.convo.length > 0 && (
            <button
              className={`${styles.demoTab} ${activeTab === 0 ? styles.demoTabActive : ''}`}
              onClick={() => setActiveTab(0)}
            >
              Conversation
            </button>
          )}
          <button
            className={`${styles.demoTab} ${activeTab === 1 ? styles.demoTabActive : ''} ${appTabPing && activeTab !== 1 ? styles.demoTabPing : ''}`}
            onClick={() => { setActiveTab(1); setAppTabPing(false) }}
          >
            In the app
          </button>
        </div>
        <button className={styles.demoClose} onClick={handleClose} aria-label="Close demo">×</button>
      </div>
      <div className={styles.demoContent}>
        {activeTab === 0 && card.convo.length > 0 && convoBubbles.map((msg, i) => (
          <ChatBubble key={i} msg={msg} delay={msg.delay} />
        ))}
        {activeTab === 1 && card.appUI()}
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
          <div className={styles.featureNum}>{card.num}</div>
          <div className={styles.featureLabel}>{card.label}</div>
          <div className={styles.featureScene}>{card.scene}</div>
          <div className={styles.featureFeature}>{card.feature}</div>
          <div className={styles.featureBenefit}>{card.benefit}</div>
        </div>
        <div className={styles.featureCardFullUI}>
          {card.appUI()}
        </div>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function LandingFeatureCards() {
  const [openCard, setOpenCard] = useState(null)

  const regularCards = CARDS.filter(c => !c.fullWidth)
  const fullCard = CARDS.find(c => c.fullWidth)

  return (
    <section className={styles.featuresSection} id="features">
      <div className={styles.featuresSectionLabel}>HOW IT WORKS</div>
      <h2 className={styles.featuresSectionHeadline}>Five things Cinis does that no other app does</h2>
      <div className={styles.featuresGrid}>
        {regularCards.map((card, i) => (
          <div
            key={card.num}
            className={styles.featureCard}
            onClick={() => setOpenCard(openCard === i ? null : i)}
          >
            <div className={styles.featureNum}>{card.num}</div>
            <div className={styles.featureLabel}>{card.label}</div>
            <div className={styles.featureScene}>{card.scene}</div>
            <div className={styles.featureFeature}>{card.feature}</div>
            <div className={styles.featureBenefit}>{card.benefit}</div>
            <div className={styles.featureTapHint}>Tap to see it</div>
            {openCard === i && (
              <DemoOverlay
                card={card}
                onClose={() => setOpenCard(null)}
              />
            )}
          </div>
        ))}
        {fullCard && <Card05 card={fullCard} />}
      </div>
    </section>
  )
}
