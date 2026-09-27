import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { Term } from '@/components/ui/Term'
import type { DatasetMeta } from '@/lib/domain'

interface Stage {
  label: ReactNode
  detail: string
  quantum: boolean
}

function stages(dataset: DatasetMeta): Stage[] {
  return [
    { label: 'Data', detail: `${dataset.samples} × ${dataset.features}`, quantum: false },
    { label: 'Preprocess', detail: 'Clean · z-score', quantum: false },
    { label: <Term term="pca">PCA</Term>, detail: '→ 4 dims', quantum: false },
    { label: <Term term="encoding">Encode</Term>, detail: 'Angle · 4 qubits', quantum: true },
    { label: 'Circuit', detail: 'ZZ map · depth 2', quantum: true },
    { label: 'Measure', detail: '4096 shots', quantum: true },
    { label: 'Evaluate', detail: 'AUC · 5 seeds', quantum: false },
  ]
}

const pct = (i: number, n: number) => `${(i / (n - 1)) * 100}%`

/** Seven-stage hybrid pipeline: classical stages grey, quantum stages accent, a dot looping every 4s. */
export function Pipeline({ dataset }: { dataset: DatasetMeta }) {
  const reduced = useReducedMotion()
  const list = stages(dataset)
  const n = list.length
  const firstQ = list.findIndex((s) => s.quantum)
  const lastQ = list.length - 1 - [...list].reverse().findIndex((s) => s.quantum)

  return (
    <div className="px-[60px] pt-10">
      <div className="relative h-[132px]">
        {/* Quantum bracket */}
        <div
          className="absolute top-0 h-3 border-x border-t border-accent"
          style={{ left: pct(firstQ, n), width: `calc(${pct(lastQ, n)} - ${pct(firstQ, n)})` }}
          aria-hidden="true"
        >
          <span className="label-mono absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-accent">
            Quantum · simulator / QPU
          </span>
        </div>

        {/* Rail */}
        <div className="absolute top-[31px] right-0 left-0 h-px bg-rule-strong" aria-hidden="true" />

        {/* Travelling dot */}
        {!reduced && (
          <motion.span
            aria-hidden="true"
            className="absolute top-[28px] block h-[7px] w-[7px] -translate-x-1/2 bg-accent"
            initial={{ left: '0%' }}
            animate={{ left: '100%' }}
            transition={{ duration: 4, ease: 'linear', repeat: Infinity }}
          />
        )}

        <ol className="absolute inset-0" aria-label="Hybrid pipeline stages">
          {list.map((stage, i) => (
            <li
              key={i}
              className="absolute top-[25px] flex w-[120px] -translate-x-1/2 flex-col items-center text-center"
              style={{ left: pct(i, n) }}
            >
              <span
                className={`block h-[13px] w-[13px] border ${stage.quantum ? 'border-accent bg-accent' : 'border-classical bg-classical'}`}
                aria-hidden="true"
              />
              <span className="mt-4 text-[13.5px] text-ink">{stage.label}</span>
              <span className="label-mono mt-1 text-[10px] text-muted">{stage.detail}</span>
              <span className="sr-only">{stage.quantum ? '(quantum stage)' : '(classical stage)'}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="label-mono -mx-[60px] mt-2 flex items-center gap-5 text-muted">
        <span className="flex items-center gap-2">
          <span className="block h-2 w-2 bg-classical" aria-hidden="true" /> Classical · CPU
        </span>
        <span className="flex items-center gap-2">
          <span className="block h-2 w-2 bg-accent" aria-hidden="true" /> Quantum
        </span>
      </p>
    </div>
  )
}
