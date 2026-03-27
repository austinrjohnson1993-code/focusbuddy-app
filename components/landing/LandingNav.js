import styles from '../../styles/Landing.module.css'
import CinisMark from '../../lib/CinisMark'

export default function LandingNav() {
  return (
    <nav className={styles.nav}>
      <a href="#" className={styles.navLogo}>
        <CinisMark size={18} />
        CINIS
      </a>
      <div className={styles.navLinks}>
        <a href="#features" className={styles.navLink}>How it works</a>
        <a href="#pricing" className={styles.navLink}>Pricing</a>
        <a href="https://cinis.app/login" className={styles.navLink}>Sign in</a>
        <a href="https://cinis.app/signup" className={styles.navCta}>Get started</a>
      </div>
    </nav>
  )
}
