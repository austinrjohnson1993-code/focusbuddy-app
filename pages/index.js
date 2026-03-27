import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { supabase } from '../lib/supabase'
import styles from '../styles/Landing.module.css'
import LandingBackground from '../components/landing/LandingBackground'
import LandingNav from '../components/landing/LandingNav'
import LandingHero from '../components/landing/LandingHero'
import LandingEmpathy from '../components/landing/LandingEmpathy'
import LandingFeatureCards from '../components/landing/LandingFeatureCards'
import LandingTestimonials from '../components/landing/LandingTestimonials'
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
        <title>Cinis — Where start meets finished.</title>
        <meta name="description" content="Everyone has a gap between what they intend to do and what gets done. Cinis closes it." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Cinis — Where start meets finished." />
        <meta property="og:description" content="AI coaching that reaches out, remembers, and keeps you moving." />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #211A14; color: #F0EAD6; font-family: 'Figtree', sans-serif; }
          html { scroll-behavior: smooth; }
          @keyframes layerPop {
            0%   { opacity: 0; transform: scale(0.82); }
            60%  { transform: scale(1.04); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </Head>

      <div className={styles.page}>
        <LandingBackground />
        <LandingNav />
        <LandingHero />
        <LandingEmpathy />
        <LandingFeatureCards />
        <LandingTestimonials />
        <LandingPricing />
        <LandingFooter />
      </div>
    </>
  )
}
