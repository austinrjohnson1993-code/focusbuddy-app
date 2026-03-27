import styles from '../../styles/Landing.module.css'

export default function LandingBackground() {
  return (
    <>
      <div className={styles.bgGrain} aria-hidden="true" />
      <div className={styles.bgVignette} aria-hidden="true" />
      <div className={styles.bgWarmth} aria-hidden="true" />
    </>
  )
}
