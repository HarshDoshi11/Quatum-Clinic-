import { ArrowDown, ArrowUp, Check, Copy } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { api, useResource } from '@/api'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAppActions } from '@/features/actions'
import { ConfidenceMeter, CONFIDENCE_WORD } from '@/features/patient/ConfidenceMeter'
import { PATIENT_ICONS } from '@/features/patient/icons'
import { PatientFooter } from '@/features/patient/PatientFooter'
import { PeopleGrid } from '@/features/patient/PeopleGrid'
import { Reveal } from '@/features/patient/Reveal'
import { formatDateTime } from '@/lib/format'
import { easeGentle } from '@/lib/motion'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useCurrentPatient } from '@/state/patient'
import type { FeatureSpec, PatientReport, RiskBand } from '@/types'

/** The risk word, in its text-safe risk colour (the only other place risk colours appear is the people grid). */
const RISK_TEXT: Record<RiskBand, string> = { low: 'text-risk-low-text', moderate: 'text-risk-mid-text', high: 'text-risk-high-text' }

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="type-h2 font-serif text-ink">{children}</h2>
}

// ─── 1 · Hero ───────────────────────────────────────────────

function Hero({ r }: { r: PatientReport }) {
  const [allReasons, setAllReasons] = useState(false)
  const abstained = r.result.decision === 'abstain' || r.result.probability === null
  const filled = abstained || r.result.probability === null ? null : Math.round(r.result.probability * 100)
  const reasons = allReasons || r.result.reasons.length <= 3 ? r.result.reasons : r.result.reasons.slice(0, 2)
  return (
    <section aria-label="Your result" className="grid grid-cols-1 items-center gap-x-16 gap-y-10 md:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
      <PeopleGrid filled={filled} band={r.result.riskBand} className="w-full max-w-[19rem]" />
      <div className="max-w-[60ch]">
        {abstained ? (
          <>
            <p className="type-h2 font-serif text-ink">We couldn’t give you a clear result from this information.</p>
            <ul className="mt-5 flex flex-col gap-2">
              {reasons.map((reason) => (
                <li key={reason} className="flex gap-3 type-body-lg text-muted">
                  <span className="mt-[0.8rem] block h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
                  {reason}
                </li>
              ))}
            </ul>
            {r.result.reasons.length > 3 && (
              <button
                type="button"
                onClick={() => setAllReasons((v) => !v)}
                className="mt-2 type-body text-ink underline underline-offset-4 transition-colors duration-300 hover:text-muted print:hidden"
              >
                {allReasons ? 'Show fewer' : `Show ${r.result.reasons.length - 2} more`}
              </button>
            )}
            <p className="mt-5 type-body-lg text-ink">Please talk to your doctor. The steps below can help.</p>
          </>
        ) : (
          <>
            {r.result.riskBand && <p className={`type-display font-serif ${RISK_TEXT[r.result.riskBand]}`}>{r.result.headline}</p>}
            {r.result.frequency && <p className="mt-6 type-body-lg text-ink">{r.result.frequency}</p>}
            <p className="mt-3 type-body-lg text-muted">This is a screening signal, not a diagnosis. Only your doctor can diagnose.</p>
          </>
        )}
      </div>
    </section>
  )
}

// ─── 3 · What influenced it ─────────────────────────────────

function Influences({ r, features }: { r: PatientReport; features: FeatureSpec[] }) {
  const reduced = useReducedMotion() ?? false
  const byKey = new Map(features.map((f) => [f.key, f]))
  return (
    <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
      {r.influences.slice(0, 3).map((inf, i) => {
        const f = byKey.get(inf.feature)
        const Icon = f ? PATIENT_ICONS[f.icon] : null
        const up = inf.direction === 'increases'
        return (
          <motion.li
            key={inf.feature}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35, delay: i * 0.08, ease: easeGentle }}
            className="rounded-panel bg-surface p-6 print:!transform-none print:!opacity-100 print:break-inside-avoid"
          >
            {Icon && <Icon size="1.5rem" strokeWidth={1.5} className="text-muted" aria-hidden="true" />}
            <p className="mt-4 type-body-lg text-ink">{f?.question ?? inf.label}</p>
            <p className="mt-2 flex items-center gap-2 type-body text-muted">
              {up ? <ArrowUp size="1rem" strokeWidth={1.5} aria-hidden="true" /> : <ArrowDown size="1rem" strokeWidth={1.5} aria-hidden="true" />}
              {up ? 'Raised your estimate' : 'Lowered your estimate'}
            </p>
          </motion.li>
        )
      })}
    </ul>
  )
}

// ─── 4 · What to do next ────────────────────────────────────

function Journey({ r }: { r: PatientReport }) {
  const [done, setDone] = useState<Set<number>>(new Set())
  const toggle = (i: number) =>
    setDone((d) => {
      const next = new Set(d)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  return (
    <ol className="relative mt-8 flex flex-col gap-6">
      {/* The journey line runs behind the icons */}
      <span className="absolute top-6 bottom-6 left-6 w-px bg-rule" aria-hidden="true" />
      {r.journey.map((step, i) => {
        const Icon = PATIENT_ICONS[step.icon]
        const checked = done.has(i)
        return (
          <li key={step.text} className="relative print:break-inside-avoid">
            <label className="flex cursor-pointer items-center gap-5">
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-rule-strong bg-bg" aria-hidden="true">
                <Icon size="1.25rem" strokeWidth={1.5} className="text-ink" />
              </span>
              <span className={`flex-1 type-body-lg transition-colors duration-300 ${checked ? 'text-muted' : 'text-ink'}`}>{step.text}</span>
              <input type="checkbox" checked={checked} onChange={() => toggle(i)} className="peer sr-only" />
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-panel border transition-colors duration-300 peer-focus-visible:outline peer-focus-visible:outline-1 peer-focus-visible:outline-accent ${
                  checked ? 'border-accent bg-accent text-accent-ink' : 'border-rule-strong'
                }`}
                aria-hidden="true"
              >
                {checked && <Check size="1rem" strokeWidth={1.5} />}
              </span>
            </label>
          </li>
        )
      })}
    </ol>
  )
}

// ─── 5 · Questions ──────────────────────────────────────────

function Questions({ r }: { r: PatientReport }) {
  const { copyLine } = useAppActions()
  const [copied, setCopied] = useState<string | null>(null)
  const copy = async (q: string) => {
    await copyLine(q, 'Question')
    setCopied(q)
    window.setTimeout(() => setCopied((c) => (c === q ? null : c)), 1600)
  }
  return (
    <ul className="mt-8 flex flex-col gap-3">
      {r.questions.slice(0, 4).map((q) => (
        <li key={q} className="flex items-center justify-between gap-4 rounded-panel bg-surface px-6 py-4 print:break-inside-avoid">
          <span className="type-body-lg text-ink">{q}</span>
          <button
            type="button"
            onClick={() => void copy(q)}
            aria-label={`Copy question: ${q}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-panel text-muted transition-colors duration-300 hover:bg-accent-soft hover:text-ink print:hidden"
          >
            {copied === q ? <Check size="1.125rem" strokeWidth={1.5} className="text-accent" /> : <Copy size="1.125rem" strokeWidth={1.5} />}
          </button>
        </li>
      ))}
    </ul>
  )
}

// ─── Page ───────────────────────────────────────────────────

/**
 * Patient Mode · My Report ("Calm Clinic"): where the assessment lands. The result as 100 people,
 * how sure the check is, what influenced it, what to do next, questions for the doctor, and the
 * safety note — then Download PDF (print styles keep only this page) and Share.
 */
export function MyReport({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const { printReport, shareReport } = useAppActions()
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const { patient } = useCurrentPatient(datasetId, schema.data)
  const input = patient?.input
  const report = useResource(
    (signal) => (input ? api.getReport({ dataset: datasetId, input }, { signal }) : new Promise<never>(() => {})),
    [datasetId, version, input],
  )
  const r = report.data?.dataset === datasetId ? report.data : undefined
  const abstained = r?.result.decision === 'abstain'

  if (schema.status === 'error' || report.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn’t write your report." body={(schema.error ?? report.error)?.message} />
      </Page>
    )
  }

  return (
    <Page label={route.label} className="print:!p-0 [print-color-adjust:exact]">
      <PageItem as="header">
        <PageHeader route={route} compact>
          {r && (
            <p className="num type-small text-muted">
              {r.reportId} · {formatDateTime(r.generatedAt)}
            </p>
          )}
        </PageHeader>
        {patient && patient.source !== 'entered' && (
          <p className="mt-6 max-w-[60ch] type-body-lg text-muted print:hidden">
            This report uses example answers.{' '}
            <ButtonLink to={`${PATIENT_BASE}/assessment`} variant="ghost" className="!h-auto !px-0 !type-body-lg text-ink underline underline-offset-4">
              Take the assessment
            </ButtonLink>{' '}
            to use your own.
          </p>
        )}
      </PageItem>

      {r && schema.data ? (
        <div className="mt-14 max-w-[64rem]">
          <Hero r={r} />

          {!abstained && (
            <Reveal className="mt-16" label="How sure are we">
              <SectionTitle>How sure are we?</SectionTitle>
              <div className="mt-6">
                <ConfidenceMeter level={r.reliability.level} />
              </div>
              <p className="mt-5 max-w-[60ch] type-body-lg text-ink">
                <span className="text-muted">{CONFIDENCE_WORD[r.reliability.level]} confidence. </span>
                {r.reliability.summary}
              </p>
            </Reveal>
          )}

          {r.influences.length > 0 && (
            <Reveal className="mt-16" label="What influenced it">
              <SectionTitle>What influenced it</SectionTitle>
              <Influences r={r} features={schema.data.features} />
            </Reveal>
          )}

          <Reveal className="mt-16" label="What to do next">
            <SectionTitle>What to do next</SectionTitle>
            <Journey r={r} />
          </Reveal>

          <Reveal className="mt-16" label="Questions to ask your doctor">
            <SectionTitle>Questions to ask your doctor</SectionTitle>
            <Questions r={r} />
          </Reveal>

          <Reveal className="mt-16" label="Safety note">
            <div className="max-w-[60ch] rounded-panel bg-surface p-8 print:break-inside-avoid">
              <p className="type-body text-muted">A note on safety</p>
              <p className="mt-3 type-body-lg text-ink">{r.safetyNote}</p>
            </div>
          </Reveal>

          <Reveal className="mt-16 print:hidden" label="Download or share">
            <div className="flex flex-wrap gap-3" data-tour="report-actions">
              <Button onClick={() => printReport(r)}>Download PDF for your doctor</Button>
              <Button variant="outline" onClick={() => void shareReport(r)}>
                Share
              </Button>
            </div>
          </Reveal>
        </div>
      ) : (
        <div className="mt-14 flex flex-col gap-6" aria-hidden="true">
          <Skeleton width="19rem" height="19rem" />
          <Skeleton width="60%" height="2.5rem" />
          <Skeleton width="100%" height="6rem" />
        </div>
      )}

      <PatientFooter />
    </Page>
  )
}
