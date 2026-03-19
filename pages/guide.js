import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Guide.module.css'
import { applyAccentColor } from '../lib/accentColor'

const THEME_ACCENT_MAP = {
  'orange-bronze':   '#E8321A',
  'teal-ocean':      '#2dd4bf',
  'purple-cosmos':   '#8b5cf6',
  'blue-arctic':     '#3b82f6',
  'green-forest':    '#22c55e',
  'rose-sunset':     '#f43f5e',
  'amber-desert':    '#f59e0b',
  'cyan-electric':   '#06b6d4',
  'indigo-night':    '#6366f1',
  'drill-sergeant':  '#ef4444',
  'midnight':        '#ffffff',
  'paper':           '#000000',
}

const CinisMark = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <polygon points="32,3 55,16 55,42 32,55 9,42 9,16"
      fill="none" stroke="#FF6644" strokeWidth="1.5" opacity="0.4"/>
    <polygon points="32,5 53,17 53,41 32,53 11,41 11,17"
      fill="#FF6644" opacity="0.55"/>
    <polygon points="32,7 51,18 51,40 32,52 13,40 13,18" fill="#1A0A05"/>
    <polygon points="32,13 46,21 46,40 32,47 18,40 18,21" fill="#6B1506"/>
    <polygon points="32,18 42,24 42,40 32,45 22,40 22,24" fill="#B82510"/>
    <polygon points="32,23 38,27 38,40 32,43 26,40 26,27" fill="#E8321A"/>
    <path d="M20,40 Q20,32 32,30 Q44,32 44,40 L39,43 L32,46 L25,43 Z"
      fill="#FF6644" opacity="0.9"/>
    <path d="M24,40 Q24,35 32,33 Q40,35 40,40 L38,42 L32,44 L26,42 Z"
      fill="#FFD0C0" opacity="0.75"/>
    <path d="M27,40 Q27,37 32,36 Q37,37 37,40 L36,41 L32,42 L28,41 Z"
      fill="#FFF0EB" opacity="0.6"/>
  </svg>
)

const SECTIONS = [
  {
    title: '✦ Getting started',
    body: "Cinis is a personal productivity coach that works like a smart friend — not a task manager. It knows your tasks, tracks your patterns, and checks in with you three times a day to keep things moving. The more you engage, the sharper it gets. Start by adding a few tasks, set your coaching persona in Settings, and let Cinis run the first check-in.",
    tip: "Don't overthink the setup. Add three tasks you need to do today and hit Check-in. That's the whole loop.",
  },
  {
    title: '🧠 Start with your persona',
    body: "Your persona blend is the most important setting in the app. It controls how Cinis talks to you — from blunt and direct (Drill Sergeant) to warm and strategic (Coach). If the tone feels off, go to Settings → Coaching style and adjust it. Most people land on a blend of 2-3 personas.",
    tip: "Not sure what you want? Try The Coach + The Thinking Partner for a few days. You can always change it.",
  },
  {
    title: '👤 Your coaching profile',
    body: "During onboarding, Cinis built a baseline profile from your answers — your goals, work style, and what accountability looks like for you. This profile shapes every check-in, every insight, and every task suggestion. It updates automatically as you use the app. If the coaching feels generic, update your persona blend in Settings — it recalibrates everything.",
    tip: "The profile isn't visible, but it's always active. The more you interact with check-ins honestly, the better it gets.",
  },
  {
    title: '✅ The task deck',
    body: "Your task deck is not a to-do list — it's a priority stack. The top task is your focus. Drag to reorder. Star any task (☆) to make it your priority focus — no star required, the deck orders tasks by due time automatically. The app tracks how many times a task gets pushed to tomorrow (rollover count) and surfaces that in your check-in. Add tasks by typing, voice, or bulk import — paste a whole brain dump and the AI parses it.",
    tip: "Use the notes field to add context — location, who to call, what to bring. The AI coach reads your notes.",
  },
  {
    title: '💬 Daily check-ins',
    body: "Check-in is the core loop. Cinis opens a brief conversation 1-3 times a day depending on your settings — morning to set your priority, midday to check progress, evening to wrap up. It knows your task list, notices patterns, and can reschedule, complete, or create tasks directly from the conversation. You don't have to do anything separately — just reply.",
    tip: "Tell it anything mid-conversation. 'I need to pick up Sarah's gift at 6pm' — it will add the task.",
  },
  {
    title: '🎯 Focus sessions',
    body: "Go to Focus when you're ready to work. Pick your top task, set a timer (5, 15, 25, 45, or 60 min), and start. The Fuel, Move, and Supplements tabs give you science-backed prep tips. Use them before a session — they actually make a difference. When your timer ends, tell Cinis how it went: Nailed it marks it complete, Made progress resets the timer, Got stuck routes you to a coaching response.",
    tip: "25 minutes is the sweet spot for most people. Long enough to get into flow, short enough to not dread starting.",
  },
  {
    title: '📅 Calendar',
    body: "The calendar shows your tasks and bills together. Orange dots are tasks, teal dots are bills. Click any day to see the full list. Recurring tasks show up on every matching day automatically. Drag any task — scheduled or unscheduled — to a time slot to schedule or reschedule it.",
    tip: "Use the calendar to spot collisions — two external commitments on the same day, a bill due the same week as a big purchase.",
  },
  {
    title: '📓 Journal',
    body: "The journal is a private thinking space. Write anything — Cinis reads it, reflects back what it hears, and can pull out tasks you mention. Entries are saved automatically with date and time. It's not therapy, but it's close. Use it when you're overwhelmed, stuck, or just need to think out loud.",
    tip: "Use it when you're overwhelmed. Just dump everything on screen. The AI will help you organize it.",
  },
  {
    title: '💰 Finance',
    body: "Add your recurring bills under Finance → Bills. Go to Budget and enter your income to see your 50/30/20 breakdown. Add interest rates and bill types (Bill, Loan, Credit Card) to your bills to unlock debt payoff calculations in the Learn tab. The Insights tab will give AI-powered recommendations once your data is filled in.",
    tip: "Even rough estimates are useful. Put in your approximate income and watch the surplus/deficit number — it's a fast reality check.",
  },
  {
    title: '📊 Progress',
    body: "Progress tracks your momentum over time — daily, weekly, monthly, and streaks. The AI gives a persona-voiced summary of how your week went. The streak counter rewards consistency, not perfection.",
    tip: "One completed task counts as a streak day. The bar is low on purpose.",
  },
  {
    title: '🎭 Your coach personas',
    body: "Cinis has 6 coaching styles you can blend:\n\n• The Drill Sergeant — Blunt, no-nonsense, zero tolerance for excuses. Best for people who need a kick.\n• The Coach — Warm, strategic, sees the big picture. Best for people who want to think things through.\n• The Thinking Partner — Asks questions instead of giving answers. Best for deep thinkers who hate being told what to do.\n• The Hype Person — Celebrates everything. Best for people who need energy and momentum.\n• The Strategist — Systems-focused, logic-driven, optimizes everything. Best for analytical types.\n• The Empath — Emotionally attuned, meets you where you are. Best for days when motivation isn't the issue — processing is.",
    tip: "Your first persona is your dominant voice. The second and third add nuance. Experiment — you'll know when it clicks.",
  },
  {
    title: '⚙️ Settings',
    body: "Change your display name, switch themes, update your coaching persona, enable push notifications, and connect external services. The theme color applies everywhere in the app including the logo and background gradient. Set up your chore cadence under Settings to automatically populate recurring household tasks into your task deck and calendar.",
    tip: "Enable push notifications for check-in reminders to actually land on your phone or desktop.",
  },
]

export default function Guide() {
  const router = useRouter()
  const [openIndex, setOpenIndex] = useState(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fb_accent_color')
      if (saved) {
        const accent = THEME_ACCENT_MAP[saved] || (saved.startsWith('#') ? saved : null)
        if (accent) applyAccentColor(accent)
      }
    } catch {}
  }, [])

  const toggle = (i) => setOpenIndex(prev => prev === i ? null : i)

  return (
    <>
      <Head><title>Guide — Cinis</title></Head>
      <div className={styles.guidePage}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>

        <div className={styles.guideHero}>
          <CinisMark size={48} />
          <h1 className={styles.guideHeading}>How to get the most out of Cinis</h1>
          <p className={styles.guideSub}>A quick guide to every feature and how to use it well.</p>
        </div>

        {SECTIONS.map((section, i) => {
          const isOpen = openIndex === i
          return (
            <div key={i} className={styles.guideCard}>
              <div className={styles.guideCardHeader} onClick={() => toggle(i)}>
                <span className={styles.guideCardTitle}>{section.title}</span>
                <span className={`${styles.guideCardChevron} ${isOpen ? styles.guideCardChevronOpen : ''}`}>▼</span>
              </div>
              {isOpen && (
                <div className={styles.guideCardBody}>
                  <p style={{ whiteSpace: 'pre-line' }}>{section.body}</p>
                  {section.tip && (
                    <div className={styles.guideCardTip}>💡 {section.tip}</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
