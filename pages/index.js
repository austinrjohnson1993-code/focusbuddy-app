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
        <title>FocusBuddy — The app that meets you in the middle</title>
      </Head>
      <div className={styles.page}>
        <nav className={styles.nav}>
          <span className="brand" style={{ fontSize: '1.4rem' }}>
            <span className="focus">Focus</span><span className="buddy">Buddy</span>
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
