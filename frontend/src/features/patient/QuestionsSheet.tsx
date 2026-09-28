import { Drawer } from '@/components/ui/Drawer'
import { Skeleton } from '@/components/ui/Skeleton'
import type { FeatureSpec } from '@/types'
import { PATIENT_ICONS } from './icons'

/** "What will you ask me?": every question of the check, in its steps, before you start. */
export function QuestionsSheet({ open, onClose, features }: { open: boolean; onClose: () => void; features: FeatureSpec[] | null }) {
  const groups = new Map<string, FeatureSpec[]>()
  for (const f of features ?? []) groups.set(f.group, [...(groups.get(f.group) ?? []), f])

  return (
    <Drawer open={open} onClose={onClose} label="What I’ll ask you" width={520}>
      <div className="px-8 pt-10 pb-12">
        <h2 className="type-h2 text-ink">What I’ll ask you</h2>
        <p className="mt-4 max-w-[60ch] type-body-lg text-muted">
          {features ? `${features.length} short questions in ${groups.size} steps.` : 'Short questions in a few steps.'} Answer what you know; “Not sure”
          is always fine.
        </p>
        {features ? (
          <ol className="mt-10 flex flex-col gap-10">
            {[...groups.entries()].map(([group, items], i) => (
              <li key={group}>
                <p className="type-body text-accent">
                  Step {i + 1} · {group}
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {items.map((f) => {
                    const Icon = PATIENT_ICONS[f.icon]
                    return (
                      <li key={f.key} className="flex items-center gap-3 type-body-lg text-ink">
                        <Icon size="1.25rem" strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
                        {f.question}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ol>
        ) : (
          <Skeleton className="mt-10" width="100%" height="16rem" />
        )}
      </div>
    </Drawer>
  )
}
