import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Onboarding.module.css'

const steps = [
  {
    id: 'name',
    question: "First things first — what should we call you?",
    sub: "Just your first name is fine.",
    type: 'text',
    placeholder: 'Your first name',
    field: 'full_name'
  },
  {
    id: 'diagnosis',
    question: "How would you describe yourself?",
    sub: "This helps us personalize your experience. No wrong answers.",
    type: 'choice',
    field: 'diagnosis',
    options: [
      { value: 'diagnosed_adhd', label: 'Diagnosed with ADHD' },
      { value: 'suspected_adhd', label: 'Suspect I have ADHD' },
      { value: 'no_adhd', label: 'No ADHD — just need help focusing' },
      { value: 'other', label: 'Something else entirely' }
    ]
  },
  {
    id: 'struggle',
    question: "What's your biggest daily struggle?",
    sub: "Pick the one that hits closest to home.",
    type: 'choice',
    field: 'main_struggle',
    options: [
      { value: 'starting', label: "Starting tasks — the wall is real" },
      { value: 'time', label: "Time disappears and I don't know where it went" },
      { value: 'overwhelm', label: "Everything feels equally urgent" },
      { value: 'shame', label: "The shame spiral when I fall behind" }
    ]
  },
  {
    id: 'checkin',
    question: "When do you want FocusBuddy to check in?",
    sub: "We'll reach out at these times. You can change this anytime.",
    type: 'checkin',
    field: 'checkin_times'
  }
]

export default function Onboarding() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [textValue, setTextValue] = useState('')
  const [checkins, setCheckins] = useState({ morning: true, midday: false, evening: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else setUser(session.user)
    })
  }, [])

  const current = steps[step]

  const handleChoice = (value) => {
    const newAnswers = { ...answers, [current.field]: value }
    setAnswers(newAnswers)
    if (step < steps.length - 1) {
      setTimeout(() => setStep(step + 1), 300)
    }
  }

  const handleText = () => {
    if (!textValue.trim()) return
    const newAnswers = { ...answers, [current.field]: textValue.trim() }
    setAnswers(newAnswers)
    setTextValue('')
    setStep(step + 1)
  }

  const handleFinish = async () => {
    setSaving(true)
    const checkinArray = Object.entries(checkins).filter(([,v]) => v).map(([k]) => k)
    const profile = {
      id: user.id,
      email: user.email,
      full_name: answers.full_name,
      diagnosis: answers.diagnosis,
      main_struggle: answers.main_struggle,
      checkin_times: checkinArray,
      onboarded: true,
      created_at: new Date().toISOString()
    }
    await supabase.from('profiles').upsert(profile)
    router.push('/dashboard')
  }

  if (!user) return null

  const progress = ((step) / steps.length) * 100

  return (
    <>
      <Head><title>Getting Started — FocusBuddy</title></Head>
      <div className={styles.page}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>

        <div className={styles.container}>
          <div className={styles.stepCount}>{step + 1} of {steps.length}</div>

          <h1 className={styles.question}>{current.question}</h1>
          <p className={styles.sub}>{current.sub}</p>

          {current.type === 'text' && (
            <div className={styles.textInput}>
              <input
                type="text"
                placeholder={current.placeholder}
                value={textValue}
                onChange={e => setTextValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleText()}
                autoFocus
                className={styles.input}
              />
              <button onClick={handleText} disabled={!textValue.trim()} className={styles.nextBtn}>
                Continue →
              </button>
            </div>
          )}

          {current.type === 'choice' && (
            <div className={styles.choices}>
              {current.options.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleChoice(opt.value)}
                  className={`${styles.choice} ${answers[current.field] === opt.value ? styles.selected : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {current.type === 'checkin' && (
            <div className={styles.checkinSection}>
              <div className={styles.checkinOptions}>
                {[
                  { key: 'morning', label: 'Morning check-in', time: '8:00 AM', desc: "Plan your day before it plans you" },
                  { key: 'midday', label: 'Midday nudge', time: '12:30 PM', desc: "A gentle pulse check" },
                  { key: 'evening', label: 'Evening wrap-up', time: '7:00 PM', desc: "Celebrate what you did" }
                ].map(item => (
                  <div
                    key={item.key}
                    onClick={() => setCheckins({ ...checkins, [item.key]: !checkins[item.key] })}
                    className={`${styles.checkinCard} ${checkins[item.key] ? styles.checkinActive : ''}`}
                  >
                    <div className={styles.checkinCheck}>{checkins[item.key] ? '✓' : ''}</div>
                    <div className={styles.checkinInfo}>
                      <span className={styles.checkinLabel}>{item.label}</span>
                      <span className={styles.checkinTime}>{item.time} — {item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={handleFinish} disabled={saving} className={styles.finishBtn}>
                {saving ? 'Setting up your space...' : "I'm ready — let's go"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
