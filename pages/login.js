import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import styles from '../styles/Auth.module.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // On success Supabase sets the session; dashboard will pick it up
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

          <a href="/" className={styles.logoWrap}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true" className={styles.mark}>
              <rect width="30" height="30" rx="8" fill="#FF6644"/>
              <path d="M15 7s-6 5-6 9.5a6 6 0 0012 0C21 12 15 7 15 7z" fill="#211A14"/>
              <circle cx="15" cy="18" r="2.2" fill="#FF6644"/>
            </svg>
            <span className={styles.wordmark}>CINIS</span>
          </a>

          <p className={styles.tagline}>Where start meets finished.</p>

          <h1 className={styles.heading}>Welcome back.</h1>
          <p className={styles.sub}>Sign in to your account.</p>

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

          <form onSubmit={handleLogin} className={styles.form}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className={styles.input}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className={styles.input}
            />
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className={styles.signupLink}>
            Don&apos;t have an account? <a href="/signup">Sign up free</a>
          </p>
        </div>
      </div>
    </>
  )
}
