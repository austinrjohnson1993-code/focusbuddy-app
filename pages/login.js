import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import styles from '../styles/Auth.module.css'

const CinisMark = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    <polygon points="32,2 56,15 56,43 32,56 8,43 8,15" fill="none" stroke="#FF6644" strokeWidth="1.1" opacity="0.45"/>
    <polygon points="32,4 54,16 54,42 32,54 10,42 10,16" fill="#FF6644"/>
    <polygon points="32,7 51,18 51,40 32,52 13,40 13,18" fill="#120704"/>
    <polygon points="32,14 46,22 46,40 32,48 18,40 18,22" fill="#5A1005"/>
    <polygon points="32,20 42,26 42,40 32,45 22,40 22,26" fill="#A82010"/>
    <polygon points="32,26 38,29 38,40 32,43 26,40 26,29" fill="#E8321A"/>
    <polygon points="32,29 45,40 40,43 32,47 24,43 19,40" fill="#FF6644" opacity="0.92"/>
    <polygon points="32,33 41,40 38,42 32,45 26,42 23,40" fill="#FFD0C0" opacity="0.76"/>
    <polygon points="32,36 37,40 36,41 32,43 28,41 27,40" fill="#FFF0EB" opacity="0.60"/>
  </svg>
)

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleMagicLink = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSent(true)
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    })
  }

  return (
    <>
      <Head>
        <title>Sign In — Cinis</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.card}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', textDecoration: 'none' }}>
            <CinisMark size={36} />
            <span style={{ fontFamily: 'Figtree, sans-serif', fontWeight: 700, fontSize: '22px', color: '#F0EAD6', letterSpacing: '-0.03em' }}>Cinis</span>
          </a>

          <h1 className={styles.heading}>Welcome back.</h1>
          <p className={styles.sub}>Sign in to your account — no password needed.</p>

          {sent ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>✓</div>
              <p>Check your email. We sent a magic link to <strong>{email}</strong>.</p>
              <p className={styles.successSub}>Click the link in the email to sign in instantly.</p>
            </div>
          ) : (
            <>
              <button onClick={handleGoogle} className={styles.googleBtn}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.96L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>

              <div className={styles.divider}><span>or sign in with email</span></div>

              {error && <div className={styles.error}>{error}</div>}

              <form onSubmit={handleMagicLink} className={styles.form}>
                <div className={styles.inputGroup}>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className={styles.input}
                  />
                </div>
                <button type="submit" disabled={loading} className={styles.submitBtn}>
                  {loading ? 'Sending...' : 'Send magic link'}
                </button>
              </form>

              <p className={styles.signupLink}>
                Don't have an account? <a href="/signup">Sign up free</a>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
