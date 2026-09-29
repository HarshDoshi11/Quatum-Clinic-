import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { usePatientStrings } from '@/i18n/patient'
import { easeGentle } from '@/lib/motion'

/** Small line illustrations: ink hairlines, the teal accent only where the eye should land. */
const svg = (children: ReactNode) => (
  <svg viewBox="0 0 64 64" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

const ART: Record<string, ReactNode> = {
  safety: svg(
    <>
      <rect x="20" y="10" width="22" height="44" rx="4" />
      <path d="M28 48h6" />
      <path d="M47 22a8 8 0 0 1 0 12M51 18a14 14 0 0 1 0 20" className="text-accent" />
    </>,
  ),
  guided: svg(
    <>
      <rect x="8" y="12" width="48" height="40" rx="5" className="text-rule-strong" />
      <path d="M16 24h28" />
      <rect x="16" y="33" width="14" height="9" rx="4.5" className="text-accent" />
      <rect x="34" y="33" width="14" height="9" rx="4.5" strokeDasharray="2.5 2.5" />
    </>,
  ),
  finder: svg(
    <>
      <rect x="14" y="8" width="36" height="48" rx="4" className="text-rule-strong" />
      <path d="M21 18h22M21 26h16M21 42h18M21 49h12" />
      <rect x="18" y="31" width="28" height="7" rx="2" className="text-accent" />
    </>,
  ),
  result: svg(
    <>
      {[10, 22, 34, 46].map((x, i) => (
        <g key={x} className={i < 2 ? 'text-accent' : undefined}>
          <circle cx={x + 4} cy="26" r="3.5" />
          <path d={`M${x - 1} 42c0-5 2.5-8 5-8s5 3 5 8`} />
        </g>
      ))}
    </>,
  ),
  numbers: svg(
    <>
      <path d="M8 34h16" className="text-accent" strokeWidth="4" />
      <path d="M28 34h12M44 34h12" strokeWidth="4" className="text-rule-strong" />
      <path d="M22 24v20" strokeWidth="2" />
    </>,
  ),
  visit: svg(
    <>
      <rect x="10" y="14" width="44" height="40" rx="5" />
      <path d="M10 25h44M22 9v9M42 9v9" />
      <path d="M25 39l5 5 10-10" className="text-accent" />
    </>,
  ),
  share: svg(
    <>
      <path d="M10 16h36a4 4 0 0 1 4 4v18a4 4 0 0 1-4 4H24l-9 8v-8h-5a4 4 0 0 1-4-4V20a4 4 0 0 1 4-4z" />
      <path d="M16 26h22M16 33h14" />
      <path d="M46 48l8-6-8-6" className="text-accent" />
    </>,
  ),
  language: svg(
    <>
      <rect x="6" y="12" width="28" height="22" rx="4" />
      <rect x="22" y="26" width="28" height="22" rx="4" className="text-rule-strong" />
      <path d="M12 20h16M12 26h10M28 34h16M28 40h10" />
      <path d="M55 30a6 6 0 0 1 0 8M58 26a11 11 0 0 1 0 16" className="text-accent" />
    </>,
  ),
}

/**
 * "What's coming": the features grouped as three beats (before the check, your result, after the result), an
 * editorial timeline that alternates sides, each item with a line illustration. Beats fade up once on scroll.
 */
export function WhatsComing() {
  const t = usePatientStrings().teaser
  const reduced = useReducedMotion() ?? false
  return (
    <div>
      <h2 id="whats-coming-title" className="type-display text-ink">
        {t.comingTitle}
      </h2>
      <p className="mt-5 max-w-[52ch] type-body-lg text-muted">{t.comingIntro}</p>
      <ol className="mt-16 flex flex-col">
        {t.beats.map((beat, i) => {
          const flip = i % 2 === 1
          return (
            <motion.li
              key={beat.title}
              initial={reduced ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -20% 0px' }}
              transition={{ duration: 0.5, ease: easeGentle }}
              className="grid grid-cols-1 gap-x-16 gap-y-8 border-t border-rule py-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
            >
              <div className={flip ? 'lg:order-2 lg:pl-8' : ''}>
                <p className="type-h2 text-accent" aria-hidden="true">
                  {i + 1}
                </p>
                <h3 className="mt-2 type-h2 text-ink">{beat.title}</h3>
                <p className="mt-3 max-w-[36ch] type-body-lg text-muted">{beat.body}</p>
              </div>
              <ul className={`flex flex-col gap-8 ${flip ? 'lg:order-1' : ''}`}>
                {beat.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-6">
                    <span className="size-20 shrink-0 rounded-panel bg-surface p-3 text-ink">{ART[item.id]}</span>
                    <span className="min-w-0 pt-2">
                      <span className="block type-body-lg font-medium text-ink">{item.title}</span>
                      <span className="mt-1 block max-w-[52ch] type-body-lg text-muted">{item.body}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}
