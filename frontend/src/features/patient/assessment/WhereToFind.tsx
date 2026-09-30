import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { fill, usePatientStrings, type DatasetStrings } from '@/i18n/patient'
import type { PatientAssessment } from '@/lib/domain'

/** Placeholder for a value on the sample report: a soft bar, never a number. */
function Blank({ w = 'w-12' }: { w?: string }) {
  return <span className={`inline-block h-2 rounded-full bg-rule-strong ${w}`} />
}

/**
 * A small illustrated lab report: the dataset's report sections, each with the lines where its values are
 * printed, and the asked-about line highlighted. Values are blank bars, so it never shows a number.
 */
function SampleReport({ assessment, strings, highlight }: { assessment: PatientAssessment; strings: DatasetStrings; highlight: string }) {
  const t = usePatientStrings().find
  // Bring the highlighted line into view when the sheet opens.
  const mark = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const id = window.setTimeout(() => mark.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350)
    return () => window.clearTimeout(id)
  }, [highlight])
  return (
    <div className="rounded-panel border border-rule bg-bg p-5 shadow-[var(--shadow-soft)]" aria-hidden="true">
      <div className="flex items-start justify-between gap-4 border-b border-rule pb-4">
        <p className="type-body font-medium text-ink">{strings.report.title}</p>
        <span className="flex flex-col items-end gap-1.5 pt-1.5">
          <Blank w="w-24" />
          <Blank w="w-16" />
        </span>
      </div>
      <div className="mt-2 flex flex-col">
        {assessment.report.map((section) => (
          <div key={section.id} className="border-b border-rule py-2 last:border-b-0">
            <p className="type-small font-medium text-muted">{strings.report.sections[section.id]}</p>
            <ul className="mt-1 flex flex-col">
              {section.features.map((key) => {
                const on = key === highlight
                return (
                  <li
                    key={key}
                    ref={on ? mark : undefined}
                    className={`relative flex items-center justify-between gap-4 rounded-control px-2 py-0.5 type-small ${on ? 'bg-accent-soft text-ink ring-1 ring-accent' : 'text-muted'}`}
                  >
                    <span>{strings.features[key]?.find?.reportLabel}</span>
                    <span className="flex items-center gap-2">
                      <Blank w={on ? 'w-14' : 'w-10'} />
                      {on && (
                        <span className="flex items-center gap-1 text-accent">
                          <ArrowLeft size="0.875rem" strokeWidth={2} />
                          {t.lookHere}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

interface WhereToFindProps {
  open: boolean
  onClose: () => void
  featureKey: string | null
  assessment: PatientAssessment
  strings: DatasetStrings
}

/** "Where do I find this?": a tip, the section it's usually in, a sample report with that line highlighted, and its other names. */
export function WhereToFind({ open, onClose, featureKey, assessment, strings }: WhereToFindProps) {
  const t = usePatientStrings().find
  const words = featureKey ? strings.features[featureKey] : undefined
  const find = words?.find
  const section = assessment.report.find((s) => featureKey && s.features.includes(featureKey))
  return (
    <Drawer open={open} onClose={onClose} label={t.title} width={560}>
      {find && words && (
        <div className="px-8 pt-10 pb-12">
          <h2 className="type-h2 text-ink">{t.title}</h2>
          <p className="mt-3 type-body-lg text-muted">{words.ask}</p>
          <p className="mt-6 type-body-lg text-ink">{find.tip}</p>
          {section && <p className="mt-2 type-body-lg text-ink">{fill(t.usuallyIn, { section: strings.report.sections[section.id] })}</p>}
          <div className="mt-8">
            <SampleReport assessment={assessment} strings={strings} highlight={featureKey ?? ''} />
            <p className="mt-3 type-body text-muted">{t.sample}</p>
          </div>
          <p className="mt-8 type-body-lg text-ink">{t.alsoCalled}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {find.names.map((n) => (
              <li key={n} className="rounded-control bg-surface px-3 py-1.5 type-body text-ink">
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  )
}
