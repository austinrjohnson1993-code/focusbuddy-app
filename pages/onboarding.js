import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Onboarding.module.css'

// ── Questions ────────────────────────────────────────────────────────────────

const QUESTIONS = [
  {
    text: "When you have a big task you've been avoiding, what usually happens?",
    options: [
      { id: 'a', text: "I keep moving it to tomorrow until the deadline forces me" },
      { id: 'b', text: "I start it but lose momentum halfway through" },
      { id: 'c', text: "I overthink it until it feels impossible to start" },
      { id: 'd', text: "I do everything else on my list first" },
    ]
  },
  {
    text: "A friend asks for help moving on the same day you had planned to catch up on work. You:",
    options: [
      { id: 'a', text: "Cancel your plans — commitments to others come first" },
      { id: 'b', text: "Try to do both and end up stressed" },
      { id: 'c', text: "Say no but feel guilty about it all day" },
      { id: 'd', text: "Negotiate a shorter window that works for both" },
    ]
  },
  {
    text: "When you get a reminder notification, you usually:",
    options: [
      { id: 'a', text: "Do the thing immediately" },
      { id: 'b', text: "Snooze it and forget about it" },
      { id: 'c', text: "Acknowledge it mentally but get to it later" },
      { id: 'd', text: "Feel annoyed and dismiss it" },
    ]
  },
  {
    text: "What does a productive day feel like for you?",
    options: [
      { id: 'a', text: "I completed everything on my list" },
      { id: 'b', text: "I made real progress on the one thing that mattered most" },
      { id: 'c', text: "I stayed focused without feeling overwhelmed" },
      { id: 'd', text: "I kept my promises to others and myself" },
    ]
  },
  {
    text: "When someone gives you direct, blunt feedback, you:",
    options: [
      { id: 'a', text: "Appreciate it — just tell me straight" },
      { id: 'b', text: "Need a moment but ultimately value it" },
      { id: 'c', text: "Prefer it softened with some context" },
      { id: 'd', text: "Shut down if it feels harsh" },
    ]
  },
  {
    text: "Your ideal coach would:",
    options: [
      { id: 'a', text: "Push you hard and not accept excuses" },
      { id: 'b', text: "Help you think through problems yourself" },
      { id: 'c', text: "Celebrate every win and keep energy high" },
      { id: 'd', text: "Give you a clear logical plan and get out of the way" },
      { id: 'e', text: "Check in on how you're feeling before anything else" },
    ]
  },
  {
    text: "When you miss a goal or deadline, your first instinct is:",
    options: [
      { id: 'a', text: "Figure out what went wrong and fix the system" },
      { id: 'b', text: "Beat yourself up about it" },
      { id: 'c', text: "Remind yourself it's not the end of the world" },
      { id: 'd', text: "Move on quickly and focus on what's next" },
    ]
  },
  {
    text: "How do you prefer to start your day?",
    options: [
      { id: 'a', text: "With a clear prioritized list ready to go" },
      { id: 'b', text: "With a quick check-in to assess how I'm feeling" },
      { id: 'c', text: "Just jumping into the most urgent thing" },
      { id: 'd', text: "Slowly — I need time to ease in" },
    ]
  },
  {
    text: "When a task keeps getting pushed back, it's usually because:",
    options: [
      { id: 'a', text: "I don't know where to start" },
      { id: 'b', text: "Other things feel more urgent" },
      { id: 'c', text: "I'm not sure it actually matters" },
      { id: 'd', text: "It feels too big to tackle in one go" },
    ]
  },
  {
    text: "How do you respond to accountability?",
    options: [
      { id: 'a', text: "I need someone checking in or I'll drift" },
      { id: 'b', text: "I work better when I set my own deadlines" },
      { id: 'c', text: "Public commitment helps me follow through" },
      { id: 'd', text: "I do best when I understand the why behind the goal" },
    ]
  },
  {
    text: "What's your relationship with your phone notifications?",
    options: [
      { id: 'a', text: "I check everything immediately" },
      { id: 'b', text: "I batch them and check periodically" },
      { id: 'c', text: "I'm often overwhelmed by them" },
      { id: 'd', text: "I mostly ignore them" },
    ]
  },
  {
    text: "When you complete something you've been putting off, you feel:",
    options: [
      { id: 'a', text: "Relieved more than proud" },
      { id: 'b', text: "Genuinely proud — wins matter to me" },
      { id: 'c', text: "Ready to immediately move to the next thing" },
      { id: 'd', text: "Like I should have done it sooner" },
    ]
  },
]

// ── Persona scoring ───────────────────────────────────────────────────────────

const SCORING = [
  { a: { drill_sergeant: 2 }, b: { coach: 2 }, c: { thinking_partner: 2 }, d: { strategist: 2 } },
  { a: { drill_sergeant: 1 }, b: { hype_person: 1 }, c: { thinking_partner: 2 }, d: { strategist: 2 } },
  { a: { drill_sergeant: 2 }, b: { hype_person: 2 }, c: { coach: 1 }, d: { strategist: 1 } },
  { a: { drill_sergeant: 1, strategist: 1 }, b: { strategist: 2 }, c: { thinking_partner: 2 }, d: { coach: 2 } },
  { a: { drill_sergeant: 3 }, b: { coach: 2 }, c: { thinking_partner: 2 }, d: { empath: 3 } },
  { a: { drill_sergeant: 3 }, b: { thinking_partner: 3 }, c: { hype_person: 3 }, d: { strategist: 3 }, e: { empath: 3 } },
  { a: { strategist: 3 }, b: { thinking_partner: 2 }, c: { coach: 2 }, d: { drill_sergeant: 2 } },
  { a: { strategist: 2, drill_sergeant: 1 }, b: { thinking_partner: 2 }, c: { drill_sergeant: 2 }, d: { coach: 1 } },
  { a: { thinking_partner: 2 }, b: { strategist: 2 }, c: { thinking_partner: 1, coach: 1 }, d: { coach: 2 } },
  { a: { drill_sergeant: 2, hype_person: 1 }, b: { strategist: 2 }, c: { hype_person: 2 }, d: { thinking_partner: 2 } },
  { a: { drill_sergeant: 1 }, b: { strategist: 2 }, c: { thinking_partner: 1, coach: 1 }, d: { coach: 2 } },
  { a: { thinking_partner: 1 }, b: { hype_person: 3 }, c: { strategist: 2 }, d: { drill_sergeant: 1 } },
]

const PERSONA_DEFS = {
  drill_sergeant:   { label: 'The Drill Sergeant',   desc: 'Blunt, direct, zero fluff. Gets you moving.' },
  coach:            { label: 'The Coach',             desc: 'Warm, strategic, keeps you moving forward.' },
  thinking_partner: { label: 'The Thinking Partner', desc: 'Collaborative, helps you think it through.' },
  hype_person:      { label: 'The Hype Person',       desc: 'Energetic, celebratory, makes wins feel huge.' },
  strategist:       { label: 'The Strategist',        desc: 'Logical, pragmatic, systems-focused.' },
  empath:           { label: 'The Empath',            desc: 'Emotionally attuned, meets you where you are.' },
}

function computePersonas(answers) {
  const scores = { drill_sergeant: 0, coach: 0, thinking_partner: 0, hype_person: 0, strategist: 0, empath: 0 }
  answers.forEach((optionId, qIdx) => {
    if (!optionId) return
    const weights = SCORING[qIdx]?.[optionId] || {}
    Object.entries(weights).forEach(([persona, pts]) => {
      if (persona in scores) scores[persona] += pts
    })
  })
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 2)
    .slice(0, 3)
    .map(([key]) => key)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [phase, setPhase] = useState('intro') // intro | questions | analyzing | reveal | saving
  const [name, setName] = useState('')
  const [checkinTimes, setCheckinTimes] = useState(['morning', 'evening'])
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState(Array(QUESTIONS.length).fill(null))
  const [animKey, setAnimKey] = useState(0)
  const [personaBlend, setPersonaBlend] = useState([])
  const [personaVoice, setPersonaVoice] = useState('female')

  useEffect(() => {
    const isReset = window.location.search.includes('reset=1')
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setUser(session.user)
      if (!isReset) {
        const { data: profile } = await supabase
          .from('profiles').select('onboarded, persona_set').eq('id', session.user.id).single()
        if (profile?.onboarded && profile?.persona_set) router.push('/dashboard')
      }
    })
  }, [])

  const toggleCheckinTime = (t) => {
    setCheckinTimes(prev =>
      prev.includes(t)
        ? prev.length > 1 ? prev.filter(x => x !== t) : prev
        : [...prev, t]
    )
  }

  const handleAnswer = (optionId) => {
    const newAnswers = answers.map((a, i) => i === currentQ ? optionId : a)
    setAnswers(newAnswers)

    if (currentQ < QUESTIONS.length - 1) {
      setAnimKey(k => k + 1)
      setCurrentQ(q => q + 1)
    } else {
      const keys = computePersonas(newAnswers)
      const blend = (keys.length ? keys : ['coach']).map(k => PERSONA_DEFS[k].label)
      setPersonaBlend(blend)
      setPhase('analyzing')
      setTimeout(() => setPhase('reveal'), 1500)
    }
  }

  const handleConfirm = async () => {
    setPhase('saving')
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: name.trim() || user.email.split('@')[0],
      onboarded: true,
      persona_blend: personaBlend,
      persona_voice: personaVoice,
      persona_set: true,
      checkin_times: checkinTimes,
      onboarding_complete: true,
      created_at: new Date().toISOString(),
    })
    router.push('/dashboard')
  }

  if (!user) return null

  // ── Intro ─────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <>
        <Head><title>Getting Started — FocusBuddy</title></Head>
        <div className={styles.page}>
          <div className={styles.introContainer}>
            <div className={styles.introLogo}>
              <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
            </div>
            <h1 className={styles.introTitle}>Let's set you up.</h1>
            <p className={styles.introSub}>12 quick questions. No wrong answers. Takes about 2 minutes.</p>

            <div className={styles.introForm}>
              <div className={styles.introField}>
                <label className={styles.introLabel}>What should we call you?</label>
                <input
                  type="text"
                  placeholder="Your first name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setPhase('questions') }}
                  className={styles.introInput}
                  autoFocus
                />
              </div>

              <div className={styles.introField}>
                <label className={styles.introLabel}>When do you want to check in?</label>
                <div className={styles.checkinRow}>
                  {['morning', 'midday', 'evening'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleCheckinTime(t)}
                      className={`${styles.checkinToggle} ${checkinTimes.includes(t) ? styles.checkinToggleOn : ''}`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={() => setPhase('questions')} className={styles.startBtn}>
                Next →
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Questions ─────────────────────────────────────────────────────────────
  if (phase === 'questions') {
    const q = QUESTIONS[currentQ]
    const progress = ((currentQ + 1) / QUESTIONS.length) * 100

    return (
      <>
        <Head><title>Getting Started — FocusBuddy</title></Head>
        <div className={styles.page}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>

          <div className={styles.questionContainer}>
            <span className={styles.questionCount}>{currentQ + 1} of {QUESTIONS.length}</span>

            <div key={animKey} className={styles.questionWrap}>
              <h2 className={styles.questionText}>{q.text}</h2>
              <div className={styles.optionsGrid}>
                {q.options.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => handleAnswer(opt.id)}
                    className={styles.optionCard}
                  >
                    <span className={styles.optionLetter}>{opt.id.toUpperCase()}</span>
                    <span className={styles.optionText}>{opt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Analyzing ─────────────────────────────────────────────────────────────
  if (phase === 'analyzing') {
    return (
      <>
        <Head><title>Getting Started — FocusBuddy</title></Head>
        <div className={styles.page}>
          <div className={styles.analyzeScreen}>
            <p className={styles.analyzeText}>
              Analyzing your style
              <span className={styles.analyzeDots}>
                <span /><span /><span />
              </span>
            </p>
          </div>
        </div>
      </>
    )
  }

  // ── Reveal ────────────────────────────────────────────────────────────────
  if (phase === 'reveal') {
    const primaryLabel = personaBlend[0]
    const secondaryLabel = personaBlend[1] || null
    const primaryDef = Object.values(PERSONA_DEFS).find(d => d.label === primaryLabel)

    return (
      <>
        <Head><title>Getting Started — FocusBuddy</title></Head>
        <div className={styles.page}>
          <div className={styles.revealContainer}>
            <div className={styles.revealCard}>
              <p className={styles.revealLabel}>Your coaching style</p>
              <h1 className={styles.revealPersona}>{primaryLabel}</h1>
              <p className={styles.revealDesc}>{primaryDef?.desc}</p>
              {secondaryLabel && (
                <p className={styles.revealSecondary}>
                  with <strong>{secondaryLabel}</strong> energy
                </p>
              )}
            </div>

            <div className={styles.voicePrefBlock}>
              <p className={styles.voicePrefLabel}>Voice preference</p>
              <div className={styles.voicePrefRow}>
                <button
                  type="button"
                  onClick={() => setPersonaVoice('female')}
                  className={`${styles.voicePrefBtn} ${personaVoice === 'female' ? styles.voicePrefBtnActive : ''}`}
                >
                  Female
                </button>
                <button
                  type="button"
                  onClick={() => setPersonaVoice('male')}
                  className={`${styles.voicePrefBtn} ${personaVoice === 'male' ? styles.voicePrefBtnActive : ''}`}
                >
                  Male
                </button>
              </div>
            </div>

            <button onClick={handleConfirm} className={styles.startBtn}>
              Let's go →
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── Saving ────────────────────────────────────────────────────────────────
  return (
    <>
      <Head><title>Getting Started — FocusBuddy</title></Head>
      <div className={styles.page}>
        <div className={styles.savingContainer}>
          <div className={styles.savingLogo}>
            <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
          </div>
          <p className={styles.savingText}>Setting up your space...</p>
        </div>
      </div>
    </>
  )
}
