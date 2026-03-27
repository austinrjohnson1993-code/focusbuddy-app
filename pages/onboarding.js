import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Onboarding.module.css'
import CinisMark from '../lib/CinisMark'

// ── Questions ────────────────────────────────────────────────────────────────

const SLIDE_THEMES = ['How you work', 'How you want to be coached', 'What gets in your way']

const QUESTIONS = [
  // ── Slide 1: How you work ──────────────────────────────────
  {
    text: "When you have a big task you've been avoiding, what usually happens?",
    options: [
      { id: 'a', text: "I keep moving it to tomorrow until a deadline forces me" },
      { id: 'b', text: "I start it but lose momentum halfway through" },
      { id: 'c', text: "I overthink it until it feels impossible to start" },
      { id: 'd', text: "I do everything else on my list first" },
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
    text: "What does a productive day feel like for you?",
    options: [
      { id: 'a', text: "I completed everything on my list" },
      { id: 'b', text: "I made real progress on the one thing that mattered most" },
      { id: 'c', text: "I stayed focused without feeling overwhelmed" },
      { id: 'd', text: "I kept my promises to others and myself" },
    ]
  },
  // ── Slide 2: How you want to be coached ────────────────────
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
    text: "How do you respond to accountability?",
    options: [
      { id: 'a', text: "I need someone checking in or I'll drift" },
      { id: 'b', text: "I work better when I set my own deadlines" },
      { id: 'c', text: "Public commitment helps me follow through" },
      { id: 'd', text: "I do best when I understand the why behind the goal" },
    ]
  },
  // ── Slide 3: What gets in your way ─────────────────────────
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
    text: "When you miss a goal or deadline, your first instinct is:",
    options: [
      { id: 'a', text: "Figure out what went wrong and fix the system" },
      { id: 'b', text: "Beat myself up about it" },
      { id: 'c', text: "Remind myself it's not the end of the world" },
      { id: 'd', text: "Move on quickly and focus on what's next" },
    ]
  },
  {
    text: "When you finish something you've been putting off, you feel:",
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
  // Slide 1 — How you work
  /* Q1 procrastination */  { a: { drill_sergeant: 2 }, b: { coach: 2 }, c: { thinking_partner: 2 }, d: { strategist: 2 } },
  /* Q2 day start */        { a: { strategist: 2, drill_sergeant: 1 }, b: { thinking_partner: 2 }, c: { drill_sergeant: 2 }, d: { coach: 1, empath: 1 } },
  /* Q3 productive day */   { a: { drill_sergeant: 1, strategist: 1 }, b: { strategist: 2 }, c: { thinking_partner: 2 }, d: { coach: 2 } },
  // Slide 2 — How you want to be coached
  /* Q4 feedback */         { a: { drill_sergeant: 3 }, b: { coach: 2 }, c: { thinking_partner: 2 }, d: { empath: 3 } },
  /* Q5 ideal coach */      { a: { drill_sergeant: 3 }, b: { thinking_partner: 3 }, c: { hype_person: 3 }, d: { strategist: 3 }, e: { empath: 3 } },
  /* Q6 accountability */   { a: { drill_sergeant: 2, hype_person: 1 }, b: { strategist: 2 }, c: { hype_person: 2 }, d: { thinking_partner: 2 } },
  // Slide 3 — What gets in your way
  /* Q7 task stalls */      { a: { thinking_partner: 2 }, b: { strategist: 2 }, c: { thinking_partner: 1, coach: 1 }, d: { coach: 2 } },
  /* Q8 missed goals */     { a: { strategist: 3 }, b: { thinking_partner: 2 }, c: { coach: 2 }, d: { drill_sergeant: 2 } },
  /* Q9 completion feel */  { a: { thinking_partner: 1 }, b: { hype_person: 3 }, c: { strategist: 2 }, d: { drill_sergeant: 1 } },
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

// ── Mental health context options ─────────────────────────────────────────────

const MH_OPTIONS = [
  { id: 'adhd_diagnosed',   emoji: '🧠', label: 'ADHD — Diagnosed',              desc: 'I have a formal ADHD diagnosis.' },
  { id: 'adhd_suspected',   emoji: '🔍', label: 'ADHD — Suspected',              desc: "I haven't been diagnosed but relate strongly to ADHD." },
  { id: 'ocd',              emoji: '🌀', label: 'OCD',                            desc: 'I have OCD and want better systems around it.' },
  { id: 'anxiety',          emoji: '😟', label: 'Anxiety',                        desc: 'Anxiety gets in the way of starting and finishing things.' },
  { id: 'depression',       emoji: '😔', label: 'Depression',                     desc: 'Low energy and motivation make it hard to get things done.' },
  { id: 'multiple',         emoji: '🧩', label: 'Multiple things',               desc: "A mix of the above — it's complicated." },
  { id: 'no_diagnosis',     emoji: '📋', label: 'No diagnosis — just disorganized', desc: "I don't have a diagnosis but struggle to stay on top of things." },
  { id: 'well_organized',   emoji: '✅', label: 'Well organized — want more',    desc: "I'm already organized but want a smarter system." },
]

// ── Component ─────────────────────────────────────────────────────────────────

const RANK_ITEMS_DEFAULT = ['Deep focus work', 'Quick wins', 'External commitments', 'Self-care / personal tasks']
const QUESTIONS_PER_SLIDE = 3
const TOTAL_SLIDES = Math.ceil(QUESTIONS.length / QUESTIONS_PER_SLIDE)

export default function Onboarding() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [phase, setPhase] = useState('context') // context | intro | questions | rankq | analyzing | reveal | building
  const [mentalHealthContext, setMentalHealthContext] = useState(null)
  const [name, setName] = useState('')
  const [checkinTimes, setCheckinTimes] = useState(['morning', 'evening'])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [answers, setAnswers] = useState(Array(QUESTIONS.length).fill(null))
  const [animKey, setAnimKey] = useState(0)
  const [slideDirection, setSlideDirection] = useState('forward') // forward | backward
  const [personaBlend, setPersonaBlend] = useState([])
  const [personaVoice, setPersonaVoice] = useState('warm_gentle')
  const [rankItems, setRankItems] = useState([...RANK_ITEMS_DEFAULT])
  const [rankDragIdx, setRankDragIdx] = useState(null)

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

  const handleSelect = (qIdx, optionId) => {
    setAnswers(prev => prev.map((a, i) => i === qIdx ? optionId : a))
  }

  const handleNextSlide = () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setSlideDirection('forward')
      setAnimKey(k => k + 1)
      setCurrentSlide(s => s + 1)
    } else {
      setPhase('rankq')
    }
  }

  const handleBack = () => {
    if (currentSlide > 0) {
      setSlideDirection('backward')
      setAnimKey(k => k + 1)
      setCurrentSlide(s => s - 1)
    } else {
      setPhase('intro')
    }
  }

  const handleRankSubmit = () => {
    const keys = computePersonas(answers)
    const blend = (keys.length ? keys : ['coach']).map(k => PERSONA_DEFS[k].label)
    setPersonaBlend(blend)
    setPhase('analyzing')
    setTimeout(() => setPhase('reveal'), 1500)
  }

  const handleConfirm = async () => {
    setPhase('building')
    const upsertData = {
      id: user.id,
      email: user.email,
      full_name: name.trim() || user.email.split('@')[0],
      onboarded: true,
      persona_blend: personaBlend,
      persona_voice: personaVoice,
      persona_set: true,
      checkin_times: checkinTimes,
      onboarding_complete: true,
      tutorial_completed: false,
      created_at: new Date().toISOString(),
    }
    // Save ranked_priorities gracefully — column may not exist yet
    if (mentalHealthContext) upsertData.mental_health_context = mentalHealthContext
    try {
      await supabase.from('profiles').upsert({ ...upsertData, ranked_priorities: rankItems })
    } catch {
      await supabase.from('profiles').upsert(upsertData)
    }
    try {
      await fetch('/api/generate-baseline-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
    } catch (e) {
      console.error('[onboarding] baseline profile generation failed:', e)
    }
    router.push('/dashboard')
  }

  if (!user) return null

  // ── Context (step 0) ──────────────────────────────────────────────────────
  if (phase === 'context') {
    return (
      <>
        <Head><title>Getting Started — Cinis</title></Head>
        <div className={styles.page}>
          <div className={styles.contextContainer}>
            <div className={styles.contextLogo}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <CinisMark size={32} />
                <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.16em', color: '#F0EAD6' }}>CINIS</span>
              </span>
            </div>
            <h1 className={styles.introTitle}>What brings you here?</h1>
            <p className={styles.introSub}>This helps Cinis understand how to support you. You can always update this later.</p>

            <div className={styles.mhGrid}>
              {MH_OPTIONS.map(opt => {
                const selected = mentalHealthContext === opt.id
                return (
                  <div
                    key={opt.id}
                    onClick={() => setMentalHealthContext(selected ? null : opt.id)}
                    className={`${styles.mhCard} ${selected ? styles.mhCardSelected : ''}`}
                  >
                    <div className={styles.mhCardEmoji}>{opt.emoji}</div>
                    <div className={styles.mhCardLabel}>{opt.label}</div>
                    <div className={styles.mhCardDesc}>{opt.desc}</div>
                  </div>
                )
              })}
            </div>

            {mentalHealthContext && (
              <button onClick={() => setPhase('intro')} className={styles.startBtn} style={{ marginTop: '28px' }}>
                Continue →
              </button>
            )}
          </div>
        </div>
      </>
    )
  }

  // ── Intro ─────────────────────────────────────────────────────────────────
  if (phase === 'intro') {
    return (
      <>
        <Head><title>Getting Started — Cinis</title></Head>
        <div className={styles.page}>
          <div className={styles.introContainer}>
            <div className={styles.introLogo}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <CinisMark size={32} />
                <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.16em', color: '#F0EAD6' }}>CINIS</span>
              </span>
            </div>
            <h1 className={styles.introTitle}>Let's set you up.</h1>
            <p className={styles.introSub}>A few quick questions. No wrong answers. Under a minute.</p>

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

  // ── Questions (grouped slides) ────────────────────────────────────────────
  if (phase === 'questions') {
    const slideStart = currentSlide * QUESTIONS_PER_SLIDE
    const slideQuestions = QUESTIONS.slice(slideStart, slideStart + QUESTIONS_PER_SLIDE)
    const slideAllAnswered = slideQuestions.every((_, i) => answers[slideStart + i] !== null)
    const progress = ((currentSlide + 1) / (TOTAL_SLIDES + 1)) * 100

    return (
      <>
        <Head><title>Getting Started — Cinis</title></Head>
        <div className={styles.page}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>

          <div className={styles.questionContainer}>
            <div className={styles.questionNav}>
              <button onClick={handleBack} className={styles.backBtn}>&larr; Back</button>
              <span className={styles.questionCount}>{currentSlide + 1} of {TOTAL_SLIDES + 1}</span>
            </div>

            <div key={animKey} className={`${styles.questionWrap} ${slideDirection === 'backward' ? styles.questionWrapBackward : ''}`}>
              <p className={styles.slideTheme}>{SLIDE_THEMES[currentSlide]}</p>

              {slideQuestions.map((q, i) => {
                const qIdx = slideStart + i
                return (
                  <div key={qIdx} className={styles.questionBlock}>
                    <p className={styles.questionLabel}>{q.text}</p>
                    <div className={styles.optionsList}>
                      {q.options.map(opt => (
                        <button
                          key={opt.id}
                          onClick={() => handleSelect(qIdx, opt.id)}
                          className={`${styles.optionPill} ${answers[qIdx] === opt.id ? styles.optionPillSelected : ''}`}
                        >
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}

              <button
                onClick={handleNextSlide}
                disabled={!slideAllAnswered}
                className={styles.startBtn}
                style={{ marginTop: 8 }}
              >
                {currentSlide < TOTAL_SLIDES - 1 ? 'Next \u2192' : 'Almost done \u2192'}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── Rank question ─────────────────────────────────────────────────────────
  if (phase === 'rankq') {
    return (
      <>
        <Head><title>Getting Started — Cinis</title></Head>
        <div className={styles.page}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: '100%' }} />
          </div>
          <div className={styles.questionContainer}>
            <div className={styles.questionNav}>
              <button onClick={() => { setSlideDirection('backward'); setPhase('questions'); setCurrentSlide(TOTAL_SLIDES - 1); setAnimKey(k => k + 1) }} className={styles.backBtn}>&larr; Back</button>
              <span className={styles.questionCount}>{TOTAL_SLIDES + 1} of {TOTAL_SLIDES + 1}</span>
            </div>
            <div className={styles.questionWrap}>
              <h2 className={styles.questionText}>Drag to rank what matters most to you.</h2>
              <p className={styles.rankSubtext}>Top = highest priority. This helps Cinis sort your tasks.</p>
              <div className={styles.rankList}>
                {rankItems.map((item, i) => (
                  <div
                    key={item}
                    draggable
                    onDragStart={() => setRankDragIdx(i)}
                    onDragOver={e => { e.preventDefault() }}
                    onDrop={() => {
                      if (rankDragIdx === null || rankDragIdx === i) return
                      const next = [...rankItems]
                      const [moved] = next.splice(rankDragIdx, 1)
                      next.splice(i, 0, moved)
                      setRankItems(next)
                      setRankDragIdx(null)
                    }}
                    className={styles.rankItem}
                  >
                    <span className={styles.rankPosition}>{i + 1}</span>
                    <span className={styles.rankItemText}>{item}</span>
                    <span className={styles.rankHandle}>⠿</span>
                  </div>
                ))}
              </div>
              <button onClick={handleRankSubmit} className={styles.startBtn} style={{ marginTop: '28px' }}>
                Done →
              </button>
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
        <Head><title>Getting Started — Cinis</title></Head>
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
        <Head><title>Getting Started — Cinis</title></Head>
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
              <div className={styles.mhGrid}>
                {[
                  { id: 'warm_gentle',     emoji: '🌊', label: 'Warm & Gentle',      desc: 'Supportive, encouraging, patient' },
                  { id: 'warm_direct',     emoji: '🎯', label: 'Warm & Direct',       desc: 'Caring but no-nonsense, clear action steps' },
                  { id: 'bold_direct',     emoji: '⚡', label: 'Bold & Direct',       desc: 'High energy, blunt, gets you moving' },
                  { id: 'calm_analytical', emoji: '🧠', label: 'Calm & Analytical',   desc: 'Logical, structured, systems-focused' },
                ].map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => setPersonaVoice(opt.id)}
                    className={`${styles.mhCard} ${personaVoice === opt.id ? styles.mhCardSelected : ''}`}
                  >
                    <div className={styles.mhCardEmoji}>{opt.emoji}</div>
                    <div className={styles.mhCardLabel}>{opt.label}</div>
                    <div className={styles.mhCardDesc}>{opt.desc}</div>
                  </div>
                ))}
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

  // ── Building ──────────────────────────────────────────────────────────────
  if (phase === 'building') {
    return (
      <>
        <Head><title>Getting Started — Cinis</title></Head>
        <div className={styles.page}>
          <div className={styles.buildingContainer}>
            <div className={styles.buildingMark}>
              <CinisMark size={56} />
            </div>
            <p className={styles.buildingText}>Your coach is learning about you.</p>
          </div>
        </div>
      </>
    )
  }

  // ── Saving ────────────────────────────────────────────────────────────────
  return (
    <>
      <Head><title>Getting Started — Cinis</title></Head>
      <div className={styles.page}>
        <div className={styles.savingContainer}>
          <div className={styles.savingLogo}>
            <span className="brand">Cinis</span>
          </div>
          <p className={styles.savingText}>Setting up your space...</p>
        </div>
      </div>
    </>
  )
}
