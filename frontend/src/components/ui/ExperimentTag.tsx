import { useExperimentDrawer } from '@/features/experiments/ExperimentDrawer'

interface ExperimentTagProps {
  id: string
  /** Extra mono detail, e.g. "5 seeds". */
  detail?: string
  className?: string
}

/** Clickable experiment reference, e.g. "EXP-2037 · 5 SEEDS ↗". Opens the experiment drawer. */
export function ExperimentTag({ id, detail, className = '' }: ExperimentTagProps) {
  const { openExperiment } = useExperimentDrawer()
  return (
    <button
      type="button"
      onClick={() => openExperiment(id)}
      aria-label={`Open experiment ${id}${detail ? `, ${detail}` : ''}`}
      className={`label-mono inline-flex items-center gap-1.5 rounded-[2px] border border-rule px-2 py-1 text-muted hover:border-ink hover:text-ink ${className}`}
    >
      <span className="text-ink">{id}</span>
      {detail && (
        <>
          <span aria-hidden="true">·</span>
          <span>{detail}</span>
        </>
      )}
      <span aria-hidden="true">↗</span>
    </button>
  )
}
