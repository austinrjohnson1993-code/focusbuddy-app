import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import CinisMark from '../lib/CinisMark'
const AnimatedMark = ({ phase }) => {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 28 }}>
      {phase && (
        <>
          <polygon points="32,2 56,15 56,43 32,56 8,43 8,15" fill="none" stroke="#FF6644" strokeWidth="1.1" opacity="0.45" style={{ animation: 'markBuild1 0.4s ease-out 0.1s forwards', opacity: 0 }} />
          <polygon points="32,4 54,16 54,42 32,54 10,42 10,16" fill="#FF6644" style={{ animation: 'markBuild2 0.4s ease-out 0.2s forwards', opacity: 0 }} />
          <polygon points="32,7 51,18 51,40 32,52 13,40 13,18" fill="#120704" style={{ animation: 'markBuild3 0.4s ease-out 0.3s forwards', opacity: 0 }} />
          <polygon points="32,14 46,22 46,40 32,48 18,40 18,22" fill="#5A1005" style={{ animation: 'markBuild1 0.4s ease-out 0.4s forwards', opacity: 0 }} />
          <polygon points="32,20 42,26 42,40 32,45 22,40 22,26" fill="#A82010" style={{ animation: 'markBuild2 0.4s ease-out 0.5s forwards', opacity: 0 }} />
          <polygon points="32,26 38,29 38,40 32,43 26,40 26,29" fill="#E8321A" style={{ animation: 'markBuild3 0.4s ease-out 0.6s forwards', opacity: 0 }} />
          <polygon points="32,29 45,40 40,43 32,47 24,43 19,40" fill="#FF6644" opacity="0.92" style={{ animation: 'markBuild1 0.4s ease-out 0.7s forwards', opacity: 0 }} />
          <polygon points="32,33 41,40 38,42 32,45 26,42 23,40" fill="#FFD0C0" opacity="0.76" style={{ animation: 'markBuild2 0.4s ease-out 0.8s forwards', opacity: 0 }} />
          <polygon points="32,36 37,40 36,41 32,43 28,41 27,40" fill="#FFF0EB" opacity="0.60" style={{ animation: 'markBuild3 0.4s ease-out 0.9s forwards', opacity: 0 }} />
        </>
      )}
      <g style={{ animation: 'markGlow 3s ease-in-out 1s infinite' }} opacity="0">
        <circle cx="32" cy="32" r="32" fill="#FF6644" opacity="0.1" />
      </g>
    </svg>
  )
}

const EmberParticles = ({ ready }) => {
  if (!ready) return null

  const particles = Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2
    const distance = 80
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance

    return (
      <div
        key={i}
        style={{
          position: 'absolute',
          width: 6,
          height: 6,
          background: '#FF6644',
          borderRadius: '50%',
          left: `calc(50% + ${x}px)`,
          top: `calc(50% + ${y}px)`,
          opacity: 0,
          animation: `e${i + 1} 2s ease-in-out ${i * 0.1}s infinite`,
        }}
      />
    )
  })

  return <div style={{ position: 'relative', height: 200, width: '100%' }}>{particles}</div>
}

export default function Home() {
  const router = useRouter()
  const [phase, setPhase] = useState(0)
  const [embersReady, setEmbersReady] = useState(false)
  const [formSubmitted, setFormSubmitted] = useState(false)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const revealRefs = useRef({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
    })
  }, [router])

  useEffect(() => {
    const timings = [
      { phase: 1, delay: 0 },
      { phase: 2, delay: 100 },
      { phase: 3, delay: 600 },
      { phase: 4, delay: 1500 },
      { phase: 5, delay: 1600 },
      { phase: 6, delay: 2000 },
      { phase: 7, delay: 2600 },
    ]

    const timers = timings.map(({ phase: p, delay }) => {
      return setTimeout(() => setPhase(p), delay)
    })

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
          }
        })
      },
      { threshold: 0.2 }
    )

    Object.values(revealRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const move = (e) => {
      const el = document.getElementById('cursor-glow')
      if (el) {
        el.style.left = e.clientX + 'px'
        el.style.top = e.clientY + 'px'
      }
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Please enter a valid email')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone }),
      })

      if (response.ok) {
        setFormSubmitted(true)
        setEmail('')
        setPhone('')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch (err) {
      setError('Network error. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Cinis — AI coaching for ADHD and executive function</title>
        <meta name="description" content="The part of your brain that keeps you on track." />
        <style>{`
          @keyframes pageEntry {
            0%   { opacity: 0; transform: translateY(12px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes markEntry {
            0%   { transform: scale(0.85); opacity: 0; }
            100% { transform: scale(1);    opacity: 1; }
          }
          @keyframes textReveal {
            0% { clip-path: inset(0 100% 0 0); opacity: 1; }
            100% { clip-path: inset(0 0% 0 0); opacity: 1; }
          }
          @keyframes wordSlice {
            0% { clip-path: inset(0 100% 0 0); letter-spacing: 0.4em; }
            100% { clip-path: inset(0 0% 0 0); letter-spacing: 0.16em; }
          }
          @keyframes markForge {
            0% { transform: scale(0.2); opacity: 0; filter: blur(24px); }
            35% { opacity: 0.8; filter: blur(6px); }
            70% { transform: scale(1.04); filter: blur(1px); }
            100% { transform: scale(1); opacity: 1; filter: blur(0); }
          }
          @keyframes ambientBreathe {
            0%, 100% { opacity: 0.08; transform: scale(1); }
            50% { opacity: 0.18; transform: scale(1.15); }
          }
          @keyframes grainShift {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(-2%, -3%); }
            20% { transform: translate(-4%, 1%); }
            30% { transform: translate(2%, -4%); }
            40% { transform: translate(-1%, 3%); }
            50% { transform: translate(3%, 1%); }
            60% { transform: translate(-3%, 2%); }
            70% { transform: translate(1%, -2%); }
            80% { transform: translate(-2%, 4%); }
            90% { transform: translate(4%, -1%); }
          }
          @keyframes sectionReveal {
            0% { opacity: 0; transform: translateY(28px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideUp {
            0% { opacity: 0; transform: translateY(20px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes ctaPulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 102, 68, 0.5); }
            70% { box-shadow: 0 0 0 14px rgba(255, 102, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 102, 68, 0); }
          }
          @keyframes markBuild1 {
            0% { opacity: 0; transform: scale(0.95); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes markBuild2 {
            0% { opacity: 0; transform: scale(0.9); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes markBuild3 {
            0% { opacity: 0; transform: scale(0.85); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes markGlow {
            0%, 100% { opacity: 0; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.2); }
          }
          ${Array.from({ length: 16 }, (_, i) => `
            @keyframes e${i + 1} {
              0% { opacity: 0; transform: translate(0, 0) scale(1); }
              50% { opacity: 0.8; }
              100% { opacity: 0; transform: translate(${Math.random() * 200 - 100}px, ${Math.random() * 200 - 100}px) scale(0); }
            }
          `).join('')}
          @keyframes wordIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          @keyframes fadeUp {
            0% { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            background: #211A14;
            color: #F5F0E3;
            font-family: 'Figtree', sans-serif;
          }
          .page {
            background: #211A14;
            min-height: 100vh;
            position: relative;
          }
          #cursor-glow {
            position: fixed;
            pointer-events: none;
            z-index: 0;
            width: 600px;
            height: 600px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,102,68,0.06) 0%, transparent 60%);
            transform: translate(-50%, -50%);
            transition: left 0.8s ease, top 0.8s ease;
          }
          @media (max-width: 768px) {
            #cursor-glow { display: none; }
          }
          #grain-overlay {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 1;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
            background-repeat: repeat;
            background-size: 200px 200px;
            opacity: 0.025;
            animation: grainShift 0.4s steps(1) infinite;
            mix-blend-mode: overlay;
          }
          .nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 40px;
            border-bottom: 1px solid #F5F0E31A;
            background: #211A14;
            position: relative;
            z-index: 10;
          }
          .nav-logo {
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'Sora', sans-serif;
            font-weight: 600;
            font-size: 0.85rem;
            letter-spacing: 0.16em;
            color: #F5F0E3;
          }
          .nav-links {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .nav-link {
            color: rgba(240, 234, 214, 0.65);
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            transition: color 0.2s;
            padding: 10px 20px;
          }
          .nav-link:hover { color: #F5F0E3; }
          .nav-cta {
            background: #FF6644;
            color: #110d06;
            padding: 10px 24px;
            border-radius: 100px;
            font-weight: 700;
            text-decoration: none;
            font-size: 0.9rem;
            transition: all 0.2s;
            cursor: pointer;
            border: none;
            font-family: 'Figtree', sans-serif;
          }
          .nav-cta:hover { background: #FF7755; transform: translateY(-1px); }
          .hero {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            min-height: 100vh;
            padding: 100px 24px 60px;
            background: #211A14;
            position: relative;
            z-index: 2;
          }
          .eyebrow {
            font-family: 'Sora', sans-serif;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: #FF6644;
            margin-bottom: 24px;
            opacity: 0;
            animation: fadeUp 0.5s ease-out forwards;
          }
          .headline {
            font-family: 'Sora', sans-serif;
            font-weight: 600;
            font-size: 52px;
            color: #F5F0E3;
            line-height: 1.1;
            margin-bottom: 16px;
            max-width: 640px;
            opacity: 0;
            animation: fadeUp 0.5s ease-out forwards;
            overflow: hidden;
          }
          .headline-line {
            clip-path: inset(0 100% 0 0);
          }
          .headline-line.active {
            animation: textReveal 0.5s ease-out forwards;
          }
          .subhead {
            font-family: 'Figtree', sans-serif;
            font-size: 16px;
            color: #F5F0E390;
            line-height: 1.7;
            max-width: 480px;
            margin-bottom: 32px;
            opacity: 0;
            animation: fadeUp 0.5s ease-out forwards;
          }
          .form {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
            max-width: 340px;
            opacity: 0;
            animation: slideUp 0.4s ease-out forwards;
          }
          .input {
            font-family: 'Figtree', sans-serif;
            font-size: 14px;
            padding: 14px 16px;
            border: 1px #F5F0E31E;
            border-style: solid;
            border-radius: 10px;
            background: rgba(58, 50, 40, 0.4);
            color: #F5F0E3;
            transition: all 0.2s ease;
          }
          .input::placeholder { color: rgba(240, 234, 214, 0.4); }
          .input:focus {
            outline: none;
            border-color: rgba(255, 102, 68, 0.4);
            background: rgba(58, 50, 40, 0.6);
          }
          .error {
            font-size: 12px;
            color: #FF5252;
            margin-top: -8px;
          }
          .button {
            font-family: 'Figtree', sans-serif;
            font-size: 14px;
            font-weight: 600;
            padding: 14px 20px;
            background: #FF6644;
            color: #F5F0E3;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            animation: ctaPulse 2s ease 3.5s infinite;
          }
          .button:hover:not(:disabled) {
            background: #FF7755;
            transform: translateY(-2px);
          }
          .button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .micro {
            font-family: 'Figtree', sans-serif;
            font-size: 11px;
            color: #F5F0E318;
            margin-top: 8px;
            opacity: 0;
            animation: fadeUp 0.4s ease-out forwards;
          }
          .confirmation {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            min-height: 100vh;
            padding: 24px;
            position: relative;
            z-index: 2;
          }
          .confirmation-mark {
            font-size: 48px;
            margin-bottom: 12px;
          }
          .confirmation-headline {
            font-family: 'Sora', sans-serif;
            font-size: 24px;
            font-weight: 600;
            color: #F5F0E3;
            margin-bottom: 8px;
          }
          .confirmation-sub {
            font-family: 'Figtree', sans-serif;
            font-size: 14px;
            color: rgba(240, 234, 214, 0.6);
            margin-bottom: 20px;
            line-height: 1.5;
          }
          .confirmation-divider {
            height: 1px;
            background: #F5F0E318;
            width: 100%;
            max-width: 300px;
            margin: 16px auto;
          }
          .confirmation-rows {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .confirmation-row {
            font-family: 'Figtree', sans-serif;
            font-size: 12px;
            color: #F5F0E350;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
          }
          .checkmark {
            color: #FF6644;
            font-weight: 700;
          }
          .reveal-section {
            opacity: 0;
            transform: translateY(28px);
            transition: none;
          }
          .reveal-section.revealed {
            animation: sectionReveal 0.6s ease forwards;
          }
          .section {
            padding: 100px 24px;
            position: relative;
            z-index: 2;
          }
          .problem-section {
            background: #1A130E;
            text-align: center;
          }
          .problem-eyebrow {
            color: #FF6644;
            font-family: 'Sora', sans-serif;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            margin-bottom: 16px;
          }
          .problem-headline {
            font-family: 'Sora', sans-serif;
            font-size: 32px;
            font-weight: 600;
            color: #F5F0E3;
            margin-bottom: 20px;
            border-left: 3px solid #FF6644;
            padding-left: 20px;
            text-align: left;
            display: inline-block;
          }
          .problem-text {
            font-family: 'Figtree', sans-serif;
            font-size: 16px;
            color: rgba(240, 234, 214, 0.7);
            line-height: 1.85;
            max-width: 580px;
            margin: 0 auto;
            text-align: left;
          }
          .problem-text + .problem-text {
            margin-top: 12px;
          }
          .pillars-section {
            background: #211A14;
          }
          .pillars-eyebrow {
            color: #FF6644;
            font-family: 'Sora', sans-serif;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            text-align: center;
            margin-bottom: 16px;
          }
          .pillars-headline {
            font-family: 'Sora', sans-serif;
            font-size: 32px;
            font-weight: 600;
            color: #F5F0E3;
            text-align: center;
            margin-bottom: 48px;
          }
          .pillars-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 16px;
            max-width: 1000px;
            margin: 0 auto;
          }
          .pillar-card {
            background: #1A130E;
            border: 1px #F5F0E31E;
            border-style: solid;
            border-radius: 14px;
            border-top: 2px solid #FF6644;
            padding: 28px 24px;
            text-align: left;
          }
          .pillar-number {
            font-family: 'Sora', sans-serif;
            font-size: 11px;
            font-weight: 300;
            color: #F5F0E350;
            margin-bottom: 12px;
          }
          .pillar-title {
            font-family: 'Sora', sans-serif;
            font-size: 17px;
            font-weight: 600;
            color: #F5F0E3;
            margin-bottom: 10px;
          }
          .pillar-body {
            font-family: 'Figtree', sans-serif;
            font-size: 14px;
            color: rgba(240, 234, 214, 0.65);
            line-height: 1.8;
          }
          .proof-section {
            background: #1A130E;
            text-align: center;
          }
          .proof-headline {
            font-family: 'Sora', sans-serif;
            font-size: 28px;
            font-weight: 600;
            color: #F5F0E3;
            margin-bottom: 40px;
          }
          .proof-tiles {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            max-width: 900px;
            margin: 0 auto;
          }
          .proof-tile {
            background: #211A14;
            border-radius: 12px;
            border: 1px #F5F0E31E;
            border-style: solid;
            padding: 24px 16px;
            text-align: center;
          }
          .proof-number {
            font-family: 'Sora', sans-serif;
            font-size: 28px;
            font-weight: 600;
            color: #FF6644;
            margin-bottom: 6px;
          }
          .proof-label {
            font-family: 'Figtree', sans-serif;
            font-size: 13px;
            font-weight: 500;
            color: #F5F0E3;
            margin-bottom: 6px;
          }
          .proof-desc {
            font-family: 'Figtree', sans-serif;
            font-size: 11px;
            color: rgba(240, 234, 214, 0.5);
            line-height: 1.6;
          }
          .cta-section {
            background: #211A14;
            text-align: center;
          }
          .cta-headline {
            font-family: 'Sora', sans-serif;
            font-size: 32px;
            font-weight: 600;
            color: #F5F0E3;
            margin-bottom: 12px;
          }
          .cta-subhead {
            font-family: 'Figtree', sans-serif;
            font-size: 15px;
            color: rgba(240, 234, 214, 0.7);
            margin-bottom: 32px;
          }
          .footer {
            background: #110C08;
            padding: 32px 24px;
            text-align: center;
            border-top: 0.5px solid #F5F0E318;
            position: relative;
            z-index: 2;
          }
          .footer-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            margin-bottom: 12px;
            font-family: 'Sora', sans-serif;
            font-weight: 600;
            font-size: 9px;
            letter-spacing: 0.16em;
            color: #F5F0E3;
          }
          .footer-tagline {
            font-family: 'Figtree', sans-serif;
            font-size: 11px;
            color: #F5F0E350;
            margin-bottom: 12px;
          }
          .footer-links {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            margin-bottom: 16px;
            font-size: 10px;
          }
          .footer-link {
            color: #F5F0E350;
            text-decoration: none;
            transition: color 0.2s;
          }
          .footer-link:hover { color: #F5F0E3; }
          .footer-micro {
            font-family: 'Figtree', sans-serif;
            font-size: 9px;
            color: #F5F0E318;
            margin-top: 16px;
          }
          @media (max-width: 640px) {
            .nav { padding: 16px 20px; }
            .hero { padding: 64px 20px 48px; }
            .headline { font-size: 34px; }
            .pillars-grid { grid-template-columns: 1fr; }
            .proof-tiles { grid-template-columns: 1fr; }
            .section { padding: 64px 20px; }
            .problem-headline { font-size: 28px; }
            .pillars-headline { font-size: 28px; }
            .proof-headline { font-size: 24px; }
            .cta-headline { font-size: 28px; }
          }
        `}</style>
      </Head>

      <div className="page" style={{ animation: 'pageEntry 0.6s ease-out forwards' }}>
        <div id="cursor-glow" />
        <div id="grain-overlay" />

        {/* NAV */}
        <nav className="nav">
          <span className="nav-logo">
            <CinisMark size={20} style={{ flexShrink: 0, animation: 'markEntry 0.4s ease-out forwards' }} />
            CINIS
          </span>
          <div className="nav-links">
            <a href="https://cinis.app/login" className="nav-link">Sign in</a>
            <button onClick={() => router.push('/signup')} className="nav-cta">Get started</button>
          </div>
        </nav>

        {/* HERO */}
        {formSubmitted ? (
          <div className="hero confirmation">
            <div style={{ maxWidth: 400 }}>
              <div className="confirmation-mark">🔥</div>
              <h2 className="confirmation-headline">You're on the list.</h2>
              <p className="confirmation-sub">We launch April 14. You'll hear from us that morning.</p>
              <div className="confirmation-divider" />
              <div className="confirmation-rows">
                <div className="confirmation-row"><span className="checkmark">✓</span> Early access confirmed</div>
                <div className="confirmation-row"><span className="checkmark">✓</span> Launch-day pricing locked</div>
                <div className="confirmation-row"><span className="checkmark">✓</span> We'll never send you spam</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hero">
            <div style={{
              animation: phase >= 1 ? 'markForge 0.8s ease-out forwards' : 'none',
              marginBottom: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AnimatedMark phase={phase >= 2} />
            </div>
            {phase >= 4 && <EmberParticles ready={true} />}

            <div style={{
              fontFamily: "'Sora', sans-serif",
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: '0.16em',
              color: '#F5F0E3',
              marginBottom: 24,
              opacity: phase >= 4 ? 1 : 0,
              animation: phase >= 4 ? 'wordSlice 0.6s ease-out forwards' : 'none'
            }}>
              CINIS
            </div>

            <div className="eyebrow" style={{ animation: phase >= 5 ? 'fadeUp 0.5s ease-out forwards' : 'none' }}>
              EARLY ACCESS
            </div>

            <h2 className="headline" style={{ animation: phase >= 5 ? 'fadeUp 0.5s ease-out forwards' : 'none' }}>
              The part of your brain<br />that keeps you on track.
            </h2>

            <p className="subhead" style={{ animation: phase >= 6 ? 'fadeUp 0.5s ease-out forwards' : 'none' }}>
              Cinis learns how you work, reaches out before you fall behind, and remembers everything — so you don't have to.
            </p>

            <form onSubmit={handleSubmit} className="form" style={{ animation: phase >= 7 ? 'slideUp 0.4s ease-out forwards' : 'none' }}>
              <input type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
              <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
              {error && <span className="error">{error}</span>}
              <button type="submit" disabled={loading || !email.includes('@')} className="button">
                {loading ? 'Joining...' : 'Get early access'}
              </button>
            </form>
            <p className="micro" style={{ animation: phase >= 7 ? 'fadeUp 0.4s ease-out forwards' : 'none' }}>Free to start. No credit card.</p>
          </div>
        )}

        {/* THE PROBLEM */}
        <section className="section problem-section reveal-section" ref={(el) => { revealRefs.current.problem = el }}>
          <div style={{ maxWidth: 580, margin: '0 auto', textAlign: 'center' }}>
            <div className="problem-eyebrow">THE PROBLEM</div>
            <div className="problem-headline">You're not lazy. You're not broken.</div>
            <p className="problem-text">The gap between knowing what to do and actually doing it is real. For a lot of people, it's wider than for others — and no amount of motivation or better apps has closed it.</p>
            <p className="problem-text">Cinis doesn't try to motivate you. It doesn't send you another push notification you'll ignore. It builds a picture of how you actually work, then keeps you moving — quietly, specifically, in the background.</p>
          </div>
        </section>

        {/* THREE PILLARS */}
        <section className="section pillars-section reveal-section" ref={(el) => { revealRefs.current.pillars = el }}>
          <div className="pillars-eyebrow">HOW IT WORKS</div>
          <h2 className="pillars-headline">Three things no other app does</h2>
          <div className="pillars-grid">
            <div className="pillar-card">
              <div className="pillar-number">01</div>
              <div className="pillar-title">It learns you</div>
              <p className="pillar-body">Answer 13 questions once. Cinis builds a coaching profile around your specific patterns — what stalls you, what moves you, what time of day you actually function. Every interaction gets smarter from there.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">02</div>
              <div className="pillar-title">It reaches out</div>
              <p className="pillar-body">You don't open Cinis. Cinis opens you. Morning check-ins, evening wrap-ups, nudges when you've gone quiet. It shows up — before you've had a chance to forget.</p>
            </div>
            <div className="pillar-card">
              <div className="pillar-number">03</div>
              <div className="pillar-title">It remembers</div>
              <p className="pillar-body">What you told it last week. What you avoided. What actually worked. The longer you use it, the more it knows — and the less you have to explain yourself every time.</p>
            </div>
          </div>
        </section>

        {/* PROOF POINTS */}
        <section className="section proof-section reveal-section" ref={(el) => { revealRefs.current.proof = el }}>
          <h2 className="proof-headline">Built for the way your brain actually works.</h2>
          <div className="proof-tiles">
            <div className="proof-tile">
              <div className="proof-number">13</div>
              <div className="proof-label">Questions</div>
              <p className="proof-desc">Your coach knows you before you send a single message</p>
            </div>
            <div className="proof-tile">
              <div className="proof-number">6</div>
              <div className="proof-label">Coaching voices</div>
              <p className="proof-desc">Find the tone that actually moves you</p>
            </div>
            <div className="proof-tile">
              <div className="proof-number">3-layer</div>
              <div className="proof-label">Memory</div>
              <p className="proof-desc">Remembers yesterday, last week, and who you are</p>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}
        <section className="section cta-section reveal-section" ref={(el) => { revealRefs.current.cta = el }}>
          <h2 className="cta-headline">Ready for something that actually shows up?</h2>
          <p className="cta-subhead">Join free. No credit card. Cancel whenever.</p>
          <form onSubmit={handleSubmit} className="form" style={{ maxWidth: 340, margin: '0 auto 12px' }}>
            <input type="tel" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="input" />
            <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required />
            {error && <span className="error">{error}</span>}
            <button type="submit" disabled={loading || !email.includes('@')} className="button">
              {loading ? 'Joining...' : 'Get early access'}
            </button>
          </form>
          <p className="micro" style={{ opacity: 1, animation: 'none', marginTop: 0 }}>Free to start. No credit card.</p>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-logo">
            <CinisMark size={14} />
            CINIS
          </div>
          <p className="footer-tagline">Where start meets finished.</p>
          <div className="footer-links">
            <a href="https://twitter.com" className="footer-link">Twitter</a>
            <a href="https://instagram.com" className="footer-link">Instagram</a>
            <a href="/privacy" className="footer-link">Privacy</a>
            <a href="https://cinis.app/terms" className="footer-link">Terms</a>
          </div>
          <p className="footer-micro">Cinis · Early Access 2026</p>
        </footer>
      </div>
    </>
  )
}
