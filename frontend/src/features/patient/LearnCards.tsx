import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import type { LearnCard } from '@/lib/domain'
import { easeGentle } from '@/lib/motion'
import type { FeatureSpec, ReportInfluence } from '@/types'
import { PATIENT_ICONS } from './icons'

function Card({ feature: f, card, influence }: { feature: FeatureSpec; card: LearnCard; influence: ReportInfluence | undefined }) {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion() ?? false
  const panelId = useId()
  const Icon = PATIENT_ICONS[f.icon]
  return (
    <li className="rounded-panel bg-surface print:break-inside-avoid">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panelId} className="flex w-full items-center gap-4 p-6 text-left">
        <Icon size="1.5rem" strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
        <span className="flex-1 type-body-lg text-ink">{card.title}</span>
        <ChevronDown size="1.125rem" strokeWidth={1.5} className={`shrink-0 text-muted transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.35, ease: easeGentle }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pl-16">
              <p className="max-w-[60ch] type-body-lg text-ink">{card.body}</p>
              {influence && (
                <p className="mt-4 type-body-lg text-muted">
                  For you: this was one of the things that {influence.direction === 'increases' ? 'raised' : 'lowered'} your estimate.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

/**
 * "Learn": plain cards about the patient's own strongest influences (or, with no result, their first
 * inputs). General education from the dataset config: no numbers, no advice.
 */
export function LearnCards({ features, learn, influences }: { features: FeatureSpec[]; learn: Record<string, LearnCard>; influences: ReportInfluence[] }) {
  const byKey = new Map(features.map((f) => [f.key, f]))
  const keys = influences.length > 0 ? influences.slice(0, 4).map((i) => i.feature) : features.slice(0, 4).map((f) => f.key)
  return (
    <div className="max-w-[44rem]">
      <p className="type-body-lg text-muted">
        {influences.length > 0 ? 'About the results that shaped your estimate the most.' : 'About some of the results this check uses.'} Tap a card to read more.
      </p>
      <ul className="mt-8 flex flex-col gap-4">
        {keys.map((k) => {
          const f = byKey.get(k)
          const card = learn[k]
          return f && card ? <Card key={k} feature={f} card={card} influence={influences.find((i) => i.feature === k)} /> : null
        })}
      </ul>
    </div>
  )
}
