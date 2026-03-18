import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Head from 'next/head'
import styles from '../styles/Auth.module.css'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/onboarding`,
        shouldCreateUser: true
      }
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
      options: { redirectTo: `${window.location.origin}/onboarding` }
    })
  }

  return (
    <>
      <Head>
        <title>Create Account — Cinis</title>
      </Head>
      <div className={styles.page}>
        <div className={styles.card}>
          <a href="/" className={styles.logo}>
            <span className="brand"><span className="focus">Focus</span><span className="buddy">Buddy</span></span>
          </a>

          <h1 className={styles.heading}>Let's get started.</h1>
          <p className={styles.sub}>Create your free account. No credit card required.</p>

          {sent ? (
            <div className={styles.success}>
              <div className={styles.successIcon}>✓</div>
              <p>Check your email. We sent a magic link to <strong>{email}</strong>.</p>
              <p className={styles.successSub}>Click the link to activate your account instantly.</p>
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

              <div className={styles.divider}><span>or sign up with email</span></div>

              {error && <div className={styles.error}>{error}</div>}

              <form onSubmit={handleSignup} className={styles.form}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className={styles.input}
                />
                <button type="submit" disabled={loading} className={styles.submitBtn}>
                  {loading ? 'Creating account...' : 'Create free account'}
                </button>
              </form>

              <p className={styles.signupLink}>
                Already have an account? <a href="/login">Sign in</a>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
