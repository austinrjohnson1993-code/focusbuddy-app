import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Onboarding.module.css'

const PERSONAS = {
  drill_sergeant: {
    label: 'The Drill Sergeant',
    description: 'Blunt, direct, zero fluff. High accountability, no excuses.',
    example: '"HEY. You\'ve rescheduled this three times. What\'s the actual problem?"'
  },
  coach: {
    label: 'The Coach',
    description: 'Warm, strategic, keeps you moving. Believes in you without letting you off the hook.',
    example: '"You\'ve got momentum today. Let\'s use it — what\'s the one thing that moves the needle?"'
  },
  thinking_partner: {
    label: 'The Thinking Partner',
    description: 'Collaborative, asks questions, helps you figure it out yourself.',
    example: '"You\'ve moved this task three times. What\'s actually in the way?"'
  },
  hype_person: {
    label: 'The Hype Person',
    description: 'Energetic, celebratory, motivational. Makes wins feel huge.',
    example: '"Wake UP! You knocked out two things before noon. You\'re unstoppable today!"'
  },
  strategist: {
    label: 'The Strategist',
    description: 'Logical, pragmatic, systems-focused. Gives you the optimal path.',
    example: '"You have 4 open tasks. Based on dependencies and deadlines, here\'s the sequence."'
  }
}

export default function Onboarding() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [phase, setPhase] = useState('welcome')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [selectedPersonas, setSelectedPersonas] = useState([])
  const [saving, setSaving] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else setUser(session.user)
    })

    // Restore conversation from sessionStorage if it exists
    const savedPhase = sessionStorage.getItem('onboarding_phase')
    const savedMessages = sessionStorage.getItem('onboarding_messages')
    const savedComplete = sessionStorage.getItem('onboarding_complete')
    const savedPersonas = sessionStorage.getItem('onboarding_personas')

    if (savedPhase) setPhase(savedPhase)
    if (savedMessages) setMessages(JSON.parse(savedMessages))
    if (savedComplete === 'true') setIsComplete(true)
    if (savedPersonas) setSelectedPersonas(JSON.parse(savedPersonas))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Save conversation to sessionStorage on every change
  useEffect(() => {
    if (phase !== 'welcome') {
      sessionStorage.setItem('onboarding_phase', phase)
    }
  }, [phase])

  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('onboarding_messages', JSON.stringify(messages))
    }
  }, [messages])

  useEffect(() => {
    sessionStorage.setItem('onboarding_complete', isComplete.toString())
  }, [isComplete])

  useEffect(() => {
    if (selectedPersonas.length > 0) {
      sessionStorage.setItem('onboarding_personas', JSON.stringify(selectedPersonas))
    }
  }, [selectedPersonas])

  const startConversation = async () => {
    setPhase('conversation')
    setLoading(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hi, I just signed up for FocusBuddy.' }],
          userName: user?.email
        })
      })
      const data = await res.json()
      setMessages([{ role: 'assistant', content: data.message }])
      if (data.isComplete) setIsComplete(true)
    } catch (err) {
      setMessages([{ role: 'assistant', content: "Hey! What should I call you?" }])
    }
    setLoading(false)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input.trim() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          userName: user?.email
        })
      })
      const data = await res.json()
      const newMessages = [...updatedMessages, { role: 'assistant', content: data.message }]
      setMessages(newMessages)
      if (data.isComplete) {
        setIsComplete(true)
        extractProfile(newMessages)
      }
    } catch (err) {
      setMessages([...updatedMessages, { role: 'assistant', content: "I'm here. Keep going." }])
    }
    setLoading(false)
  }

  const extractProfile = async (conversationMessages) => {
    try {
      const res = await fetch('/api/extract-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationMessages })
      })
      const data = await res.json()
      if (data.coaching_blend) {
        const initial = [data.coaching_blend.primary]
        if (data.coaching_blend.secondary) initial.push(data.coaching_blend.secondary)
        setSelectedPersonas(initial)
      }
    } catch (err) {
      console.error('Profile extraction failed:', err)
    }
  }

  const togglePersona = (key) => {
    if (selectedPersonas.includes(key)) {
      if (selectedPersonas.length > 1) {
        setSelectedPersonas(selectedPersonas.filter(p => p !== key))
      }
    } else {
      if (selectedPersonas.length < 3) {
        setSelectedPersonas([...selectedPersonas, key])
      }
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    setPhase('saving')

    const weights = {}
    const weightValues = [60, 25, 15]
    selectedPersonas.forEach((p, i) => {
      weights[p] = weightValues[i] || 10
    })

    const coaching_blend = {
      primary: selectedPersonas[0],
      secondary: selectedPersonas[1] || null,
      tertiary: selectedPersonas[2] || null,
      weights
    }

    try {
      const res = await fetch('/api/extract-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      })
      const profileData = await res.json()

      const profile = {
        id: user.id,
        email: user.email,
        full_name: profileData.full_name || user.email.split('@')[0],
        diagnosis: 'other',
        main_struggle: profileData.biggest_friction || 'starting',
        checkin_times: ['morning', 'evening'],
        onboarded: true,
        coaching_blend,
        communication_style: profileData.communication_style,
        work_schedule: profileData.work_schedule,
        sleep_habits: profileData.sleep_habits,
        exercise_habits: profileData.exercise_habits,
        food_habits: profileData.food_habits,
        family_context: profileData.family_context,
        biggest_friction: profileData.biggest_friction,
        accountability_style: profileData.accountability_style,
        past_failures: profileData.past_failures,
        current_priorities: profileData.current_priorities,
        ai_context: profileData.ai_context,
        onboarding_complete: true,
        created_at: new Date().toISOString()
      }

      await supabase.from('profiles').upsert(profile)

      // Clear onboarding session data
      sessionStorage.removeItem('onboarding_phase')
      sessionStorage.removeItem('onboarding_messages')
      sessionStorage.removeItem('onboarding_complete')
      sessionStorage.removeItem('onboarding_personas')

      router.push('/dashboard')
    } catch (err) {
      console.error('Save failed:', err)
      setSaving(false)
      setPhase('persona')
    }
  }

  const assistantStyle = {
    background: '#221608',
    border: '1px solid rgba(255,200,120,0.1)',
    borderRadius: '18px 18px 18px 4px',
    padding: '16px 20px',
    color: '#f0ead6',
    WebkitTextFillColor: '#f0ead6',
    fontSize: '1.05rem',
    lineHeight: '1.6',
    maxWidth: '85%',
    alignSelf: 'flex-start',
    marginBottom: '8px'
  }

  const userStyle = {
    background: '#ff4d1c',
    borderRadius: '18px 18px 4px 18px',
    padding: '14px 20px',
    color: '#110d06',
    WebkitTextFillColor: '#110d06',
    fontSize: '1rem',
    fontWeight: '500',
    lineHeight: '1.5',
    maxWidth: '75%',
    alignSelf: 'flex-end',
    marginBottom: '8px'
  }

  if (!user) return null

  // WELCOME SCREEN
  if (phase === 'welcome') {
    return (
      <>
        <Head><title>Getting Started — FocusBuddy</title></Head>
        <div className={styles.page}>
          <div className={styles.welcomeContainer}>
            <div className={styles.welcomeLogo}>
              <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
            </div>
            <h1 className={styles.welcomeTitle}>Let's get to know you.</h1>
            <p className={styles.welcomeSub}>
              This conversation takes 5–10 minutes. That investment upfront means FocusBuddy works better for you from day one — faster results, fewer repetitive questions, a coach that already knows you.
            </p>
            <p className={styles.welcomeSub2}>
              We'll ask about your work style, daily habits, what's worked before, what hasn't, and how you like to be held accountable. The more you share, the more personal this gets.
            </p>
            <button onClick={startConversation} className={styles.startBtn}>
              I'm ready — let's do this →
            </button>
            <p className={styles.welcomeNote}>No wrong answers. This is just a conversation.</p>
          </div>
        </div>
      </>
    )
  }

  // SAVING SCREEN
  if (phase === 'saving') {
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

  // PERSONA SELECTION
  if (phase === 'persona') {
    return (
      <>
        <Head><title>Getting Started — FocusBuddy</title></Head>
        <div className={styles.page}>
          <div className={styles.personaContainer}>
            <div className={styles.personaHeader}>
              <h1 className={styles.personaTitle}>Your coaching style.</h1>
              <p className={styles.personaSub}>
                Based on our conversation, here's what I think will work for you. Adjust it however you want — you can always change this later.
              </p>
              <p className={styles.personaInstructions}>Pick up to 3. The first one you select is your dominant style.</p>
            </div>

            <div className={styles.personaGrid}>
              {Object.entries(PERSONAS).map(([key, persona]) => {
                const isSelected = selectedPersonas.includes(key)
                const position = selectedPersonas.indexOf(key)
                const isPrimary = position === 0
                const isSecondary = position === 1

                return (
                  <div
                    key={key}
                    onClick={() => togglePersona(key)}
                    style={{
                      background: isSelected ? 'rgba(255,77,28,0.08)' : '#221608',
                      border: isSelected ? '1px solid rgba(255,77,28,0.4)' : '1px solid rgba(255,200,120,0.08)',
                      cursor: 'pointer',
                      borderRadius: '16px',
                      padding: '20px',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: '#ff4d1c',
                        color: '#110d06',
                        WebkitTextFillColor: '#110d06',
                        borderRadius: '100px',
                        padding: '2px 10px',
                        fontSize: '0.72rem',
                        fontWeight: '700'
                      }}>
                        {isPrimary ? 'Primary' : isSecondary ? 'Secondary' : 'Tertiary'}
                      </div>
                    )}
                    <p style={{ color: '#f0ead6', WebkitTextFillColor: '#f0ead6', fontWeight: '700', fontSize: '1rem', marginBottom: '8px' }}>
                      {persona.label}
                    </p>
                    <p style={{ color: 'rgba(240,234,214,0.6)', WebkitTextFillColor: 'rgba(240,234,214,0.6)', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '12px' }}>
                      {persona.description}
                    </p>
                    <p style={{ color: 'rgba(240,234,214,0.4)', WebkitTextFillColor: 'rgba(240,234,214,0.4)', fontSize: '0.82rem', lineHeight: '1.5', fontStyle: 'italic' }}>
                      {persona.example}
                    </p>
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleFinish}
              disabled={selectedPersonas.length === 0 || saving}
              className={styles.finishBtn}
            >
              {saving ? 'Setting up your space...' : "This is me — let's go →"}
            </button>
          </div>
        </div>
      </>
    )
  }

  // CONVERSATION SCREEN
  return (
    <>
      <Head><title>Getting Started — FocusBuddy</title></Head>
      <div className={styles.page}>
        <div className={styles.conversationContainer}>
          <div className={styles.conversationMessages}>
            <div className={styles.conversationSpacer} />
            {messages.map((msg, i) => (
              <div key={i} style={msg.role === 'assistant' ? assistantStyle : userStyle}>
                {msg.content}
              </div>
            ))}
            {loading && (
              <div style={assistantStyle}>
                <span style={{ fontSize: '1.4rem', letterSpacing: '4px', color: 'rgba(240,234,214,0.4)', WebkitTextFillColor: 'rgba(240,234,214,0.4)' }}>···</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {isComplete && (
            <button
              onClick={() => setPhase('persona')}
              className={styles.finishBtn}
              style={{ marginBottom: '16px' }}
            >
              Choose my coaching style →
            </button>
          )}

          <form onSubmit={sendMessage} className={styles.conversationForm}>
            <input
              type="text"
              placeholder="Type your answer..."
              value={input}
              onChange={e => setInput(e.target.value)}
              className={styles.conversationInput}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={styles.conversationSendBtn}
            >
              →
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
