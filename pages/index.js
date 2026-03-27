import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import styles from '../styles/Landing.module.css'
import LandingBackground from '../components/landing/LandingBackground'
import LandingNav from '../components/landing/LandingNav'
import LandingHero from '../components/landing/LandingHero'
import LandingFeatureCards from '../components/landing/LandingFeatureCards'
import LandingPricing from '../components/landing/LandingPricing'
import LandingFooter from '../components/landing/LandingFooter'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/dashboard')
    })
  }, [router])

  return (
    <>
      <Head>
        <title>Cinis — AI coaching for ADHD and executive function</title>
        <meta name="description" content="Everyone has a gap between what they intend to do and what gets done. Cinis closes it." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Cinis — Where start meets finished." />
        <meta property="og:description" content="AI coaching that reaches out, remembers, and keeps you moving." />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #211A14; color: #F5F0E3; font-family: 'Figtree', sans-serif; }
          @keyframes layerPop {
            0%   { transform: scale(0.82); opacity: 0; }
            60%  { transform: scale(1.04); opacity: 1; }
            100% { transform: scale(1);    opacity: 1; }
          }
        `}</style>
      </Head>

      <div className={styles.page}>
        <LandingBackground />
        <LandingNav />
        <LandingHero />
        <LandingFeatureCards />
        <LandingPricing />
        <LandingFooter />
      </div>
    </>
  )
}
