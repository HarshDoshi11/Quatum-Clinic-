import { motion, useReducedMotion } from 'motion/react'
import { Tooltip } from '@/components/ui/Tooltip'
import type { DatasetMeta } from '@/lib/domain'

interface Stage {
  label: string
  detail: string
  quantum: boolean
  /** One plain sentence for the hover tooltip. */
  explain: string
}

function stages(dataset: DatasetMeta): Stage[] {
  return [
    {
      label: 'Data',
      detail: `${dataset.samples} × ${dataset.features}`,
      quantum: false,
      explain: `Patient records go in: ${dataset.samples} patients, ${dataset.features} measurements each.`,
    },
    {
      label: 'Preprocess',
      detail: 'Clean · z-score',
      quantum: false,
      explain: 'Gaps are filled, extreme values tamed, and every measurement put on the same scale.',
    },
    {
      label: 'PCA',
      detail: '→ 4 dims',
      quantum: false,
      explain: 'Many measurements are squeezed into 4 summary numbers, one for each qubit.',
    },
    {
      label: 'Encode',
      detail: 'Angle · 4 qubits',
      quantum: true,
      explain: 'Each summary number becomes a rotation angle that tilts one qubit.',
    },
    {
      label: 'Circuit',
      detail: 'ZZ map · depth 2',
      quantum: true,
      explain: 'Quantum gates let the qubits interact, mixing the patient’s features together.',
    },
    {
      label: 'Measure',
      detail: '4096 shots',
      quantum: true,
      explain: 'The qubits are read thousands of times; the pattern of 0s and 1s is the model’s signal.',
    },
    {
      label: 'Evaluate',
      detail: 'AUC · 5 seeds',
      quantum: false,
      explain: 'Predictions are scored against the true diagnoses, repeated over 5 random seeds.',
    },
  ]
}

const pct = (i: number, n: number) => `${(i / (n - 1)) * 100}%`

function StageTag({ quantum }: { quantum: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`block h-[6px] w-[6px] ${quantum ? 'bg-accent' : 'bg-classical'}`} aria-hidden="true" />
      {quantum ? 'Quantum' : 'Classical'}
    </span>
  )
}

/** Seven-stage hybrid pipeline: classical stages grey, quantum stages accent, a dot looping every 4s. */
export function Pipeline({ dataset }: { dataset: DatasetMeta }) {
  const reduced = useReducedMotion()
  const list = stages(dataset)
  const n = list.length
  const firstQ = list.findIndex((s) => s.quantum)
  const lastQ = list.length - 1 - [...list].reverse().findIndex((s) => s.quantum)

  return (
    <div className="px-[60px] pt-10" data-tour="pipeline">
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
            <li key={stage.label} className="absolute top-[18px] w-[120px] -translate-x-1/2" style={{ left: pct(i, n) }}>
              <Tooltip label={<StageTag quantum={stage.quantum} />} content={stage.explain} width={240}>
                <span
                  tabIndex={0}
                  className="group flex cursor-help flex-col items-center rounded-[2px] px-1 pt-[7px] pb-1 text-center"
                >
                  <span
                    className={`block h-[13px] w-[13px] border transition-transform duration-200 group-hover:scale-125 group-focus-visible:scale-125 ${
                      stage.quantum ? 'border-accent bg-accent' : 'border-classical bg-classical'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="mt-4 text-[13.5px] text-ink underline decoration-transparent decoration-dotted underline-offset-[3px] group-hover:decoration-muted">
                    {stage.label}
                  </span>
                  <span className="label-mono mt-1 text-[10px] text-muted">{stage.detail}</span>
                  <span className="sr-only">
                    ({stage.quantum ? 'quantum' : 'classical'} stage) {stage.explain}
                  </span>
                </span>
              </Tooltip>
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
        <span>· Hover a stage for a plain explanation</span>
      </p>
    </div>
  )
}
