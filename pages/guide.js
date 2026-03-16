import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Guide.module.css'

const SECTIONS = [
  {
    title: '🧠 Start with your persona',
    body: "Your persona blend is the most important setting in the app. It controls how FocusBuddy talks to you — from blunt and direct (Drill Sergeant) to warm and strategic (Coach). If the tone feels off, go to Settings → Coaching style and adjust it. Most people land on a blend of 2-3 personas.",
    tip: "Not sure what you want? Try The Coach + The Thinking Partner for a few days. You can always change it.",
  },
  {
    title: '✅ The task deck',
    body: "Your task deck is not a to-do list — it's a priority stack. The top task is your focus. Drag to reorder. Star any task (☆) to make it your priority focus — no star required, the deck orders tasks by due time automatically. The app tracks how many times a task gets pushed to tomorrow (rollover count) and surfaces that in your check-in. Add tasks by typing, voice, or bulk import — paste a whole brain dump and the AI parses it.",
    tip: "Use the notes field to add context — location, who to call, what to bring. The AI coach reads your notes.",
  },
  {
    title: '💬 Daily check-ins',
    body: "Check-in is the core loop. FocusBuddy opens a brief conversation 1-3 times a day depending on your settings. It knows your task list, notices patterns, and can reschedule, complete, or create tasks directly from the conversation. The AI can create, reschedule, and complete tasks directly from the conversation — you don't have to do anything separately. Just reply.",
    tip: "Tell it anything mid-conversation. 'I need to pick up Sarah's gift at 6pm' — it will add the task.",
  },
  {
    title: '🎯 Focus sessions',
    body: "Go to Focus when you're ready to work. Pick your top task, set a timer (5, 15, 25, 45, or 60 min), and start. The Fuel, Move, and Supplements tabs give you science-backed prep tips. Use them before a session — they actually make a difference. When your timer ends, tell FocusBuddy how it went: Nailed it marks it complete, Made progress resets the timer, Got stuck routes you to a coaching response.",
    tip: "25 minutes is the sweet spot for most people. Long enough to get into flow, short enough to not dread starting.",
  },
  {
    title: '📅 Calendar',
    body: "The calendar shows your tasks and bills together. Orange dots are tasks, teal dots are bills. Click any day to see the full list. Recurring tasks show up on every matching day automatically. Drag any task — scheduled or unscheduled — to a time slot to schedule or reschedule it.",
    tip: "Use the calendar to spot collisions — two external commitments on the same day, a bill due the same week as a big purchase.",
  },
  {
    title: '📓 Journal',
    body: "The journal is a private thinking space. Write anything — FocusBuddy reads it, reflects back what it hears, and can pull out tasks you mention. Entries are saved automatically with date and time.",
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
    title: '⚙️ Settings',
    body: "Change your display name, switch themes, update your coaching persona, enable push notifications, and connect external services. The theme color applies everywhere in the app including the logo and background gradient. Set up your chore cadence under Settings to automatically populate recurring household tasks into your task deck and calendar.",
    tip: "Enable push notifications for check-in reminders to actually land on your phone or desktop.",
  },
]

export default function Guide() {
  const router = useRouter()
  const [openIndex, setOpenIndex] = useState(0)

  const toggle = (i) => setOpenIndex(prev => prev === i ? null : i)

  return (
    <>
      <Head><title>Guide — FocusBuddy</title></Head>
      <div className={styles.guidePage}>
        <button className={styles.backBtn} onClick={() => router.back()}>← Back</button>

        <h1 className={styles.guideHeading}>How to get the most out of FocusBuddy</h1>
        <p className={styles.guideSub}>A quick guide to every feature and how to use it well.</p>

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
                  <p>{section.body}</p>
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
