import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { DATASET_CATALOG, DATASETS, PATIENTS_IN_USE, SEEDS, UPCOMING_DATASETS, type CatalogEntry } from '@/lib/domain'
import { tQuick } from '@/lib/motion'
import { useDismiss } from '@/lib/useDismiss'

const IN_USE = DATASET_CATALOG.filter((d) => d.status === 'in_use')

function Status({ entry }: { entry: CatalogEntry }) {
  return entry.status === 'in_use' ? (
    <span className="type-label rounded-[2px] border border-accent px-1.5 py-px whitespace-nowrap text-accent">In use</span>
  ) : (
    <span className="type-label rounded-[2px] border border-rule-strong px-1.5 py-px whitespace-nowrap text-muted">Coming soon</span>
  )
}

/**
 * The datasets behind every result, in one line under the top bar (Research Mode). Counts come from the dataset
 * config; any dataset, or "coming soon", opens the catalogue: name, count, source and status for every dataset.
 * Full names from 80rem of strip width, codes below, so it never overflows.
 */
export function DataStrip() {
  const [open, setOpen] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  const panelId = useId()

  const close = useCallback(() => {
    setOpen(false)
    returnTo.current?.focus()
  }, [])
  const dismissRefs = useMemo(() => [stripRef, panelRef], [])
  useDismiss(dismissRefs, open, close)

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    returnTo.current = event.currentTarget
    setOpen((o) => !o)
  }
  const trigger = {
    type: 'button' as const,
    'aria-haspopup': 'dialog' as const,
    'aria-expanded': open,
    'aria-controls': open ? panelId : undefined,
    onClick: toggle,
  }

  return (
    <div ref={stripRef} data-strip="datasets" className="@container relative h-full border-b border-rule">
      <div className="flex h-full items-center gap-4 overflow-hidden px-5 type-label text-muted @min-[80rem]:gap-6">
        <span className="shrink-0 rounded-[2px] border border-accent px-1.5 py-px whitespace-nowrap text-accent">Data · Real</span>
        {IN_USE.map((d) => (
          <button key={d.key} {...trigger} className="type-label shrink-0 whitespace-nowrap hover:text-ink" aria-label={`${d.name}, ${d.count} ${d.unit}. Show all datasets`}>
            <span className="text-ink">
              <span className="hidden @min-[80rem]:inline">{d.name}</span>
              <span className="@min-[80rem]:hidden">{d.datasetId ? DATASETS[d.datasetId].code : d.name}</span>
            </span>
            {' · '}
            <span className="num text-ink">{d.count}</span> {d.unit}
          </button>
        ))}
        <span className="shrink-0 whitespace-nowrap">
          <span className="num text-ink">{PATIENTS_IN_USE}</span> real patients · <span className="num text-ink">{SEEDS}</span> seeds
        </span>
        <button {...trigger} className="type-label ml-auto shrink-0 whitespace-nowrap hover:text-ink">
          +<span className="num">{UPCOMING_DATASETS.length}</span> datasets coming soon
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label="Datasets"
            tabIndex={-1}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                close()
              }
            }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={tQuick}
            className="shadow-float absolute top-[calc(100%+6px)] left-5 z-40 w-[min(46rem,calc(100%-2.5rem))] rounded-[4px] border border-rule-strong bg-bg px-4 py-3 outline-none"
          >
            <p className="type-label text-muted">Datasets</p>
            <table className="mt-2 w-full border-collapse">
              <thead>
                <tr className="border-b border-rule-strong text-left">
                  <th className="type-label py-2 pr-4 font-normal text-muted">Name</th>
                  <th className="type-label py-2 pr-4 text-right font-normal text-muted">Count</th>
                  <th className="type-label py-2 pr-4 font-normal text-muted">Source</th>
                  <th className="type-label py-2 font-normal text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {DATASET_CATALOG.map((d) => (
                  <tr key={d.key} className="h-11 border-b border-rule last:border-b-0 type-ui">
                    <td className={`pr-4 ${d.status === 'in_use' ? 'text-ink' : 'text-muted'}`}>{d.name}</td>
                    <td className="pr-4 text-right whitespace-nowrap text-muted">
                      <span className={`num ${d.status === 'in_use' ? 'text-ink' : ''}`}>{d.count}</span> {d.unit}
                    </td>
                    <td className="pr-4 type-small text-muted">{d.source}</td>
                    <td>
                      <Status entry={d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
