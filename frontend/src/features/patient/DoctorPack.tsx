import { formatFeatureValue } from '@/components/ui/Field'
import { formatDateTime, formatDelta, formatPercent, formatPoints } from '@/lib/format'
import { NO_ANSWER, NOT_A_DIAGNOSIS, confidenceSentence } from '@/lib/patientText'
import type { ExplainResponse, FeatureSpec, PatientReport, PredictResponse } from '@/types'
import type { VisitPlan } from './PlanVisit'

const TRUST_WORD = { strong: 'Strong', partial: 'Partial', weak: 'Weak' } as const

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-6 border-b border-rule py-2">
      <dt className="w-[11rem] shrink-0 type-small text-muted">{label}</dt>
      <dd className="type-small text-ink">{children}</dd>
    </div>
  )
}

/**
 * What "Download for my doctor" prints (never shown on screen). Page 1: the patient's summary with
 * their chosen questions and notes. Page 2, "For your doctor": the clinician summary from the same
 * prediction and explanation as Research Mode (estimate, seed range, decision, trust checks, drivers).
 */
export function DoctorPack({
  r,
  plan,
  prediction,
  explanation,
  features,
}: {
  r: PatientReport
  plan: VisitPlan
  prediction: PredictResponse | undefined
  explanation: ExplainResponse | undefined
  features: FeatureSpec[]
}) {
  const abstained = r.result.decision === 'abstain'
  const spec = new Map(features.map((f) => [f.key, f]))
  return (
    <div className="hidden text-ink print:block">
      {/* ── Page 1: for the patient to bring */}
      <section>
        <p className="type-label text-muted">
          JeevSetu · Your health check · {r.reportId} · {formatDateTime(r.generatedAt)}
        </p>
        <h1 className="mt-6 type-headline-soft">{abstained ? NO_ANSWER : r.result.patientHeadline}</h1>
        {!abstained && <p className="mt-3 type-body-lg">{r.result.frequency}</p>}
        {!abstained && <p className="mt-2 type-body text-muted">{confidenceSentence(r)}</p>}
        <p className="mt-2 type-body text-muted">{NOT_A_DIAGNOSIS}</p>

        <h2 className="mt-10 type-body-lg font-medium">Next steps</h2>
        <ul className="mt-2 list-disc pl-6 type-body">
          {r.journey.map((s) => (
            <li key={s.text}>{s.text}</li>
          ))}
        </ul>

        <h2 className="mt-8 type-body-lg font-medium">My questions</h2>
        {plan.questions.length > 0 ? (
          <ol className="mt-2 list-decimal pl-6 type-body">
            {plan.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 type-body text-muted">None chosen.</p>
        )}

        <h2 className="mt-8 type-body-lg font-medium">My notes</h2>
        <p className="mt-2 whitespace-pre-line type-body">{plan.notes.trim() || '—'}</p>

        {plan.appointment && (
          <p className="mt-8 type-body">
            <span className="font-medium">Appointment:</span> {new Date(plan.appointment).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
          </p>
        )}
      </section>

      {/* ── Page 2: for the doctor */}
      <section style={{ breakBefore: 'page' }}>
        <p className="type-label text-muted">{r.reportId}</p>
        <h1 className="mt-4 type-h2 font-serif">For your doctor</h1>
        <p className="mt-2 type-small text-muted">
          Screening decision support, not a diagnosis. {prediction?.evaluation ?? ''}
        </p>

        <dl className="mt-6 border-t border-rule">
          {prediction && prediction.decision === 'predict' && prediction.probability !== null ? (
            <>
              <Row label="Estimated probability">
                <span className="num">{formatPercent(prediction.probability)}</span>
                {prediction.interval && (
                  <span className="num text-muted">
                    {' '}
                    (5-seed range {formatPoints(prediction.interval[0])}–{formatPercent(prediction.interval[1])})
                  </span>
                )}
              </Row>
              <Row label="Risk band">{prediction.riskBand}</Row>
              <Row label="Decision">
                {prediction.flagged ? 'Flagged' : 'Not flagged'} at the default threshold of <span className="num">{Math.round(prediction.threshold * 100)}%</span>
              </Row>
            </>
          ) : (
            <Row label="Result">
              Abstained (no probability reported).
              <ul className="mt-1 list-disc pl-5">
                {(prediction?.abstainReasons ?? r.result.reasons).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Row>
          )}
        </dl>

        {prediction && (
          <>
            <h2 className="mt-8 type-label text-muted">Trust checks</h2>
            <dl className="mt-2 border-t border-rule">
              {prediction.trust.map((t) => (
                <Row key={t.id} label={t.label}>
                  <span className="font-medium">{TRUST_WORD[t.level]}</span> · {t.reason}
                </Row>
              ))}
            </dl>
          </>
        )}

        {explanation && !abstained && (
          <>
            <h2 className="mt-8 type-label text-muted">Strongest influences (vs an average patient)</h2>
            <dl className="mt-2 border-t border-rule">
              {explanation.contributions.slice(0, 6).map((c) => {
                const f = spec.get(c.feature)
                return (
                  <Row key={c.feature} label={c.label}>
                    {f ? formatFeatureValue(f, c.used) : c.used}
                    {c.adjustment ? ` (${c.adjustment})` : ''} · <span className="num">{formatDelta(c.effect * 100, 1)} pts</span>
                    <span className="num text-muted"> · log-odds {formatDelta(c.contribution, 2)}</span>
                  </Row>
                )
              })}
            </dl>
          </>
        )}
      </section>
    </div>
  )
}
