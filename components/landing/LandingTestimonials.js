import styles from '../../styles/Landing.module.css'

const QUOTES = [
  {
    text: "I\u2019ve downloaded every productivity app that exists. Cinis is the first one where the app reaches out to me instead of waiting. That\u2019s the whole difference.",
    highlight: "the app reaches out to me",
    attr: "Alex \u00B7 Software engineer \u00B7 ADHD diagnosis",
  },
  {
    text: "It noticed I\u2019d moved the same task three times and asked what was actually in the way. I didn\u2019t have an answer. That was the answer.",
    highlight: "That was the answer.",
    attr: "Maya \u00B7 Freelance designer",
  },
  {
    text: "There was a bill I\u2019d been avoiding for three weeks. The coach just asked if I was ready. I paid it in two minutes. One less thing following me around.",
    highlight: "One less thing following me around.",
    attr: "Jordan \u00B7 Founder \u00B7 Early access",
  },
]

export default function LandingTestimonials() {
  return (
    <section className={styles.testimonialsSection}>
      <div className={styles.testimonialsInner}>
        <div className={styles.testimonialsEyebrow}>
          Early access · What people are saying
        </div>
        <div className={styles.quotesGrid}>
          {QUOTES.map((q, i) => (
            <div key={i} className={styles.quoteCard}>
              <div className={styles.quoteText}>
                &ldquo;{q.text.split(q.highlight).map((part, j, arr) =>
                  j < arr.length - 1 ? (
                    <span key={j}>
                      {part}
                      <strong>{q.highlight}</strong>
                    </span>
                  ) : (
                    <span key={j}>{part}</span>
                  )
                )}&rdquo;
              </div>
              <div className={styles.quoteAttr}>{q.attr}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
