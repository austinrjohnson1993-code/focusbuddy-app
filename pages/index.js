import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import Head from 'next/head'
import styles from '../styles/Home.module.css'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
    })
  }, [])

  return (
    <>
      <Head>
        <title>Cinis — The app that meets you in the middle</title>
      </Head>
      <div className={styles.page}>
        <nav className={styles.nav}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
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
            <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '0.85rem', letterSpacing: '0.16em', color: '#F0EAD6' }}>CINIS</span>
          </span>
          <div className={styles.navLinks}>
            <a href="/login" className={styles.loginLink}>Sign in</a>
            <a href="/signup" className={styles.signupLink}>Get started free</a>
          </div>
        </nav>
        <div className={styles.hero}>
          <div className={styles.badge}>Early Access — Now Open</div>
          <h1 className={styles.headline}>
            Your brain isn't broken.<br />It just needs a better <em>buddy.</em>
          </h1>
          <p className={styles.sub}>
            Not another app waiting for you to use it.<br />
            One that actually meets you in the middle.
          </p>
          <div className={styles.ctas}>
            <a href="/signup" className={styles.primaryCta}>Create free account</a>
            <a href="/login" className={styles.secondaryCta}>Sign in</a>
          </div>
        </div>
      </div>
    </>
  )
}
