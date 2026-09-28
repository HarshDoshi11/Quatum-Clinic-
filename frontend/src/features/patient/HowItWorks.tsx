import { motion, useReducedMotion, useScroll } from 'motion/react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { fill, usePatientStrings } from '@/i18n/patient'
import { easeGentle } from '@/lib/motion'

/** Small line illustrations: ink hairlines on a soft panel, the teal accent only where the eye should land. */
function AnswerArt() {
  return (
    <svg viewBox="0 0 160 120" className="h-auto w-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="24" y="14" width="112" height="92" rx="8" className="text-rule-strong" />
      <path d="M40 34h56M40 46h40" />
      <rect x="40" y="60" width="38" height="16" rx="8" className="text-accent" />
      <path d="M50 68l4 4 8-8" className="text-accent" />
      <rect x="84" y="60" width="38" height="16" rx="8" strokeDasharray="3 3" />
      <path d="M40 90h32" className="text-rule-strong" />
    </svg>
  )
}

function ReadArt() {
  return (
    <svg viewBox="0 0 160 120" className="h-auto w-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="18" y="14" width="96" height="92" rx="8" className="text-rule-strong" />
      <path d="M32 34h60M32 46h48M32 58h56M32 70h40M32 82h52" />
      <circle cx="104" cy="66" r="22" className="text-accent" />
      <path d="M120 82l18 18" className="text-accent" strokeWidth="2.5" />
    </svg>
  )
}

function NextStepsArt() {
  return (
    <svg viewBox="0 0 160 120" className="h-auto w-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <rect x="24" y="14" width="112" height="92" rx="8" className="text-rule-strong" />
      <path d="M40 34h64" strokeWidth="3" />
      {[54, 70, 86].map((y, i) => (
        <g key={y}>
          <circle cx="44" cy={y} r="5" className={i === 0 ? 'text-accent' : undefined} />
          {i === 0 && <path d={`M41.5 ${y}l2 2 3.5 -3.5`} className="text-accent" />}
          <path d={`M56 ${y}h${48 - i * 8}`} />
        </g>
      ))}
    </svg>
  )
}

/** One illustration per beat, in the order of the beats in the i18n file. */
const ART: ReactNode[] = [<AnswerArt key="answer" />, <ReadArt key="read" />, <NextStepsArt key="next" />]

/**
 * "How it works": three beats down a vertical line that fills as you scroll, alternating left and right.
 * Each beat fades up as it reaches the middle of the screen. Reduced motion: all shown, line full.
 */
export function HowItWorks() {
  const reduced = useReducedMotion() ?? false
  const t = usePatientStrings().home
  const list = useRef<HTMLOListElement>(null)
  // The page scrolls inside the shell's <main>, not the window.
  const container = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    container.current = document.getElementById('main')
  }, [])
  const { scrollYProgress } = useScroll({ target: list, container, offset: ['start 70%', 'end 55%'] })

  return (
    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="type-body-lg text-muted lg:text-center">
        {t.howItWorks}
      </h2>
      <div className="relative mt-14">
        {/* The line the story runs down; it fills with teal as you scroll */}
        <div className="absolute top-2 bottom-2 left-1/2 hidden w-px -translate-x-1/2 bg-rule lg:block" aria-hidden="true">
          <motion.div className="h-full w-full origin-top bg-accent" style={{ scaleY: reduced ? 1 : scrollYProgress }} />
        </div>
      <ol ref={list} className="relative flex flex-col gap-20 lg:gap-28">
        {t.beats.map((beat, i) => {
          const artFirst = i % 2 === 1
          const text = (
            <div className={`max-w-[34rem] ${artFirst ? 'lg:order-3' : 'lg:order-1 lg:justify-self-end lg:text-right'}`}>
              <p className="type-body text-accent">{fill(t.step, { n: i + 1 })}</p>
              <h3 className="mt-2 type-h2 text-ink">
                {beat.title}
              </h3>
              <p className="mt-4 type-body-lg text-muted">{beat.body}</p>
            </div>
          )
          const art = (
            <div className={`w-full max-w-[20rem] rounded-panel bg-surface p-8 text-ink ${artFirst ? 'lg:order-1 lg:justify-self-end' : 'lg:order-3'}`}>
              {ART[i]}
            </div>
          )
          return (
            <motion.li
              key={beat.title}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -25% 0px' }}
              transition={{ duration: 0.5, ease: easeGentle }}
              className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] lg:gap-x-12"
            >
              {text}
              {/* The beat's stop on the line */}
              <span className="relative z-10 hidden size-3 justify-self-center rounded-full border-2 border-accent bg-bg lg:order-2 lg:block" aria-hidden="true" />
              {art}
            </motion.li>
          )
        })}
      </ol>
      </div>
    </section>
  )
}
