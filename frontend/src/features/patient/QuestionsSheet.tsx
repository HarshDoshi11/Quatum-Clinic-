import { Drawer } from '@/components/ui/Drawer'
import { Skeleton } from '@/components/ui/Skeleton'
import { fill, usePatientStrings, type DatasetStrings } from '@/i18n/patient'
import type { PatientAssessment } from '@/lib/domain'
import type { FeatureSpec } from '@/types'
import { PATIENT_ICONS } from './icons'

interface QuestionsSheetProps {
  open: boolean
  onClose: () => void
  features: FeatureSpec[] | null
  assessment: PatientAssessment | null
  strings: DatasetStrings
}

/** "What will you ask me?": every question of the check, step by step, before you start. */
export function QuestionsSheet({ open, onClose, features, assessment, strings }: QuestionsSheetProps) {
  const t = usePatientStrings().sheet
  const byKey = new Map((features ?? []).map((f) => [f.key, f]))
  const ready = features && assessment
  const count = assessment?.steps.reduce((n, s) => n + s.features.length, 0) ?? 0

  return (
    <Drawer open={open} onClose={onClose} label={t.title} width={520}>
      <div className="px-8 pt-10 pb-12">
        <h2 className="type-h2 text-ink">{t.title}</h2>
        <p className="mt-4 max-w-[60ch] type-body-lg text-muted">
          {ready ? fill(t.intro, { count, steps: assessment.steps.length }) : t.introLoading} {t.reassure}
        </p>
        {ready ? (
          <ol className="mt-10 flex flex-col gap-10">
            {assessment.steps.map((step, i) => (
              <li key={step.id}>
                <p className="type-body text-accent">{fill(t.step, { n: i + 1, title: strings.steps[step.id] ?? step.id })}</p>
                {step.fromReport && <p className="mt-1 type-body text-muted">{t.fromReport}</p>}
                <ul className="mt-4 flex flex-col gap-3">
                  {step.features.map((key) => {
                    const f = byKey.get(key)
                    const Icon = PATIENT_ICONS[f?.icon ?? 'circle-dot']
                    return (
                      <li key={key} className="flex items-center gap-3 type-body-lg text-ink">
                        <Icon size="1.25rem" strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
                        {strings.features[key]?.ask ?? f?.question}
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
