import { useState, type ReactNode } from 'react'
import { Glossed } from '@/components/ui/Glossed'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { StatusMark } from '@/components/ui/StatusMark'
import { formatDateTime } from '@/lib/format'
import type { PatientReport, RiskBand, TrustLevel } from '@/types'

const RISK_BG: Record<RiskBand, string> = { low: 'bg-risk-low', moderate: 'bg-risk-mid', high: 'bg-risk-high' }
const RELIABILITY_WORD: Record<TrustLevel, string> = { strong: 'High', partial: 'Medium', weak: 'Low' }
const RELIABILITY_FILLED: Record<TrustLevel, number> = { strong: 3, partial: 2, weak: 1 }

/** Three-segment reliability meter: shape and word carry the meaning, not colour. */
function ReliabilityMeter({ level }: { level: TrustLevel }) {
  const filled = RELIABILITY_FILLED[level]
  return (
    <div className="flex items-center gap-4">
      <div className="flex gap-1" role="img" aria-label={`Reliability ${RELIABILITY_WORD[level].toLowerCase()}: ${filled} of 3`}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`block h-2 w-10 border border-ink ${i < filled ? 'bg-ink' : ''}`} aria-hidden="true" />
        ))}
      </div>
      <span className="type-label text-ink">Reliability · {RELIABILITY_WORD[level]}</span>
    </div>
  )
}

function Checklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setDone((d) => {
      const next = new Set(d)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  return (
    <ul className="border-t border-rule">
      {items.map((s, i) => (
        <li key={s} className="border-b border-rule print:break-inside-avoid">
          <label className="flex min-h-11 cursor-pointer items-center gap-4 py-3 type-body text-ink">
            <input
              type="checkbox"
              checked={done.has(i)}
              onChange={() => toggle(i)}
              className="h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[1px] border border-ink checked:bg-ink"
            />
            {s}
          </label>
        </li>
      ))}
    </ul>
  )
}

interface ReportLetterProps {
  report: PatientReport
  /** Research-only extras for the letterhead (e.g. an ExperimentTag); hidden when printed. */
  aside?: ReactNode
}

/**
 * The patient report as a numbered letter (01 Your result … 07 Safety note).
 * Research Mode (III.4); Patient Mode's My Report has its own Calm Clinic layout.
 */
export function ReportLetter({ report: r, aside }: ReportLetterProps) {
  const abstained = r.result.decision === 'abstain'
  return (
    <article aria-label="Patient report" className="flex flex-col gap-16">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-ink pb-4">
        <div>
          <p className="type-label text-ink">Q/Clinical · Screening report</p>
          <p className="num mt-1 type-small text-muted">
            {r.reportId} · {formatDateTime(r.generatedAt)} · about {r.condition}
          </p>
        </div>
        {aside && <div className="print:hidden">{aside}</div>}
      </header>

      <section>
        <SectionHeader index="01" title="Your result" plain="The main finding of this check, in one line." />
        <div className="mt-6">
          <p className="flex items-center gap-4 type-h2 text-ink">
            {r.result.riskBand && <span className={`block h-4 w-4 shrink-0 ${RISK_BG[r.result.riskBand]}`} aria-hidden="true" />}
            {r.result.headline}
          </p>
          {r.result.frequency && <p className="measure mt-3 type-body-lg text-ink">{r.result.frequency}</p>}
          {abstained && (
            <>
              <p className="measure mt-3 type-body-lg text-ink">We couldn’t give a reliable result from this information, because:</p>
              <ul className="measure mt-2 flex flex-col gap-1">
                {r.result.reasons.map((reason) => (
                  <li key={reason} className="flex gap-3 type-body text-ink">
                    <span className="mt-[0.7rem] block h-1 w-1 shrink-0 bg-ink" aria-hidden="true" />
                    {reason}
                  </li>
                ))}
              </ul>
              <p className="measure mt-4 type-body-lg text-ink">Please consult a doctor.</p>
            </>
          )}
        </div>
      </section>

      <section>
        <SectionHeader index="02" title="What it means" plain="How to read the result, and what it can’t tell you." />
        <p className="measure mt-6 type-body-lg text-ink">{r.meaning}</p>
      </section>

      <section>
        <SectionHeader index="03" title="How reliable it is" plain="We ran six checks on this result. Here is what they found." />
        <div className="mt-6">
          <ReliabilityMeter level={r.reliability.level} />
          <p className="measure mt-4 type-body-lg text-ink">{r.reliability.summary}</p>
          <ul className="mt-6 border-t border-rule">
            {r.reliability.points.map((p) => (
              <li key={p.id} className="flex gap-4 border-b border-rule py-3 print:break-inside-avoid">
                <StatusMark level={p.level} className="mt-[0.4rem]" />
                <div>
                  <p className="type-ui text-ink">{p.label}</p>
                  <p className="type-small text-muted">
                    <Glossed text={p.detail} skip={['sensitivity']} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <SectionHeader index="04" title="What influenced it" plain="The results that moved the estimate the most, up or down." />
        {r.influences.length > 0 ? (
          <ul className="mt-6 border-t border-rule">
            {r.influences.map((inf) => (
              <li key={inf.label} className="flex items-baseline gap-4 border-b border-rule py-3 print:break-inside-avoid">
                <span className="type-label w-24 shrink-0 text-muted">{inf.direction === 'increases' ? '↑ Raised' : '↓ Lowered'}</span>
                <span className="type-body text-ink">{inf.plain}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="measure mt-6 type-body text-muted">Not shown, because there is no reliable result to explain.</p>
        )}
      </section>

      <section>
        <SectionHeader index="05" title="What to do next" plain="Simple steps you can tick off." />
        <div className="mt-6">
          <Checklist items={r.nextSteps} />
        </div>
      </section>

      <section>
        <SectionHeader index="06" title="Questions for your doctor" plain="Questions worth bringing to your appointment." />
        <ol className="mt-6 border-t border-rule">
          {r.questions.map((q, i) => (
            <li key={q} className="flex gap-4 border-b border-rule py-3 type-body text-ink print:break-inside-avoid">
              <span className="num type-small text-muted">{String(i + 1).padStart(2, '0')}</span>
              {q}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionHeader index="07" title="Safety note" plain="What this report is, and what it is not." />
        <p className="measure mt-6 border-l-2 border-ink pl-4 type-body text-ink">{r.safetyNote}</p>
      </section>
    </article>
  )
}
