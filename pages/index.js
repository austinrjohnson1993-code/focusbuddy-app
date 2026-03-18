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
        <title>Cinis — AI that reaches out, not waits</title>
      </Head>
      <div className={styles.page}>
        <nav className={styles.nav}>
          <span className={styles.logo}>Cinis</span>
          <div className={styles.navLinks}>
            <a href="/login" className={styles.loginLink}>Sign in</a>
            <a href="/signup" className={styles.signupLink}>Get started free</a>
          </div>
        </nav>
        <div className={styles.hero}>
          <div className={styles.badge}>EARLY ACCESS — NOW OPEN</div>
          <h1 className={styles.headline}>
            The AI that shows up for you.
          </h1>
          <p className={styles.sub}>
            Not an app you have to remember to open.<br />
            A partner that reaches out and meets you where you are.
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
