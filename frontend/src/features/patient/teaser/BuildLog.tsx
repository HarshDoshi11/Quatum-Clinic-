import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useId, useState } from 'react'
import { usePatientStrings } from '@/i18n/patient'
import { easeGentle } from '@/lib/motion'
import { ROADMAP, type RoadmapStatus } from './roadmap'
import { WIREFRAMES } from './Wireframes'

const TAG: Record<RoadmapStatus, string> = {
  ready: 'border-accent bg-accent-soft text-accent',
  progress: 'border-amber text-risk-mid-text',
  planned: 'border-rule-strong text-muted',
}

const COLS = 'md:grid-cols-[10rem_minmax(0,16rem)_minmax(0,1fr)]'

/**
 * The build log: one hairline row per roadmap entry (status, feature, what it does), from the same array as the
 * build counter and the heart. A row opens on hover or tap to show a wireframe of that screen. Rows above the one
 * you point at stay open, so nothing shifts under the pointer; leaving the table closes them.
 */
export function BuildLog() {
  const t = usePatientStrings().teaser
  const reduced = useReducedMotion() ?? false
  const [open, setOpen] = useState<ReadonlySet<number>>(new Set())
  const id = useId()

  const hover = (i: number) => setOpen((prev) => new Set([...prev].filter((j) => j < i)).add(i))
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  return (
    <div
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') setOpen(new Set())
      }}
    >
      <div className={`hidden gap-x-8 border-b border-rule-strong pb-3 type-label text-muted md:grid ${COLS}`} aria-hidden="true">
        <span>{t.columns.status}</span>
        <span>{t.columns.feature}</span>
        <span>{t.columns.does}</span>
      </div>
      <ul>
        {ROADMAP.map((entry, i) => {
          const words = t.items[entry.id]
          const isOpen = open.has(i)
          return (
            <li key={entry.id} className="border-b border-rule">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${id}-${entry.id}`}
                onPointerEnter={(e) => {
                  if (e.pointerType === 'mouse') hover(i)
                }}
                onClick={() => toggle(i)}
                className={`grid w-full grid-cols-1 items-baseline gap-x-8 gap-y-2 py-5 text-left transition-colors duration-300 hover:bg-accent-soft/40 ${COLS}`}
              >
                <span>
                  <span className={`inline-block rounded-control border px-2 py-0.5 type-label ${TAG[entry.status]}`}>{t.status[entry.status]}</span>
                </span>
                <span className="type-body-lg font-medium text-ink">{words.feature}</span>
                <span className="max-w-[60ch] type-body-lg text-muted">{words.does}</span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    id={`${id}-${entry.id}`}
                    key="preview"
                    initial={reduced ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={reduced ? { height: 0, opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: easeGentle }}
                    className="overflow-hidden"
                    aria-hidden="true"
                  >
                    <div className={`grid gap-x-8 pb-6 ${COLS}`}>
                      <div className="md:col-start-2 md:col-span-2">{WIREFRAMES[entry.id]}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
