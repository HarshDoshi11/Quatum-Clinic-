/** Plain-language patient report, built from the same predict + explain output. */
import { DATASETS } from '../../lib/domain'
import type { DatasetId, PatientInput, PatientReport, ReliabilityPoint, RiskBand, TrustLevel, TrustSignalId } from '../../types'
import { MODEL_FEATURES } from './features'
import { abstains, checkInput, explain, fmt, predict } from './model'

const RISK_WORD: Record<RiskBand, string> = { low: 'Lower', moderate: 'Moderate', high: 'Higher' }

/** Each trust check, named neutrally so it reads right whether it passed or not. */
const CHECK_PLAIN: Record<TrustSignalId, string> = {
  stability: 'Consistency each time the model is trained',
  'data-quality': 'Completeness of your information',
  'distribution-shift': 'How closely you resemble the people the model learned from',
  calibration: 'Whether its percentages come true for people like you',
  'input-sensitivity': 'Steadiness under small errors in your values',
  'hardware-sensitivity': 'Robustness on a real quantum computer',
}

const lower = (s: string) => s[0].toLowerCase() + s.slice(1)
const listOf = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join('; ')}; and ${items[items.length - 1]}`)

function reliabilitySummary(points: ReliabilityPoint[], abstained: boolean): string {
  const n = points.length
  const at = (level: TrustLevel) => points.filter((p) => p.level === level)
  const weak = at('weak')
  const partial = at('partial')
  if (abstained) return 'We couldn’t check this result, because some of your information is missing or outside what the model learned from.'
  if (weak.length > 0) return `${weak.length} of ${n} checks did not pass: ${listOf(weak.map((p) => lower(p.label)))}.`
  if (partial.length > 0) return `${n - partial.length} of ${n} checks passed. Less certain: ${listOf(partial.map((p) => lower(p.label)))}.`
  return `All ${n} checks passed.`
}

let reportCounter = 0

export function patientReport(dataset: DatasetId, input: PatientInput, generatedAt: string): PatientReport {
  const meta = DATASETS[dataset]
  const prediction = predict(dataset, input)
  const explanation = explain(dataset, input)
  const abstained = prediction.decision === 'abstain'

  const points: ReliabilityPoint[] = prediction.trust.map((t) => ({ id: t.id, level: t.level, label: CHECK_PLAIN[t.id], detail: t.reason }))
  const weakCount = points.filter((t) => t.level === 'weak').length
  const partialCount = points.filter((t) => t.level === 'partial').length
  const level: TrustLevel = abstained || weakCount > 0 ? 'weak' : partialCount > 1 ? 'partial' : 'strong'

  // "Your" (Heart) or "Your sample’s" (WDBC: tumor measurements) — from the dataset config.
  const subject = meta.reportSubject
  const plainLabel = (key: string) => MODEL_FEATURES[dataset].find((f) => f.key === key)?.plainLabel ?? key
  const influences = abstained
    ? []
    : explanation.contributions
        .filter((c) => c.value !== null)
        .slice(0, 4)
        .map((c) => ({
          feature: c.feature,
          label: plainLabel(c.feature),
          direction: c.direction,
          plain:
            c.direction === 'increases'
              ? `${subject} ${plainLabel(c.feature).toLowerCase()} pushed the estimate up.`
              : `${subject} ${plainLabel(c.feature).toLowerCase()} pulled the estimate down.`,
        }))

  // Why there is no result, in the patient's words (same checks as Predict's abstain reasons).
  const check = checkInput(dataset, input)
  const reasons = abstains(check)
    ? [
        ...check.outOfRange.map(
          ({ feature: f, value }) =>
            `${subject} ${f.plainLabel.toLowerCase()} (${fmt(f, value)}) is outside the range the model learned from (${fmt(f, f.min)} – ${fmt(f, f.max)}).`,
        ),
        ...check.missing.map((f) => `${subject} ${f.plainLabel.toLowerCase()} was not recorded.`),
      ]
    : []

  const band = prediction.riskBand
  const p = prediction.probability
  const outside = prediction.trust.find((t) => t.id === 'distribution-shift')?.level === 'weak'
  const journey = meta.patient.guidance[abstained || !band ? 'abstain' : band]
  reportCounter += 1

  return {
    reportId: `RPT-${dataset.toUpperCase()}-${String(reportCounter).padStart(4, '0')}`,
    dataset,
    condition: meta.condition,
    generatedAt,
    experimentId: prediction.experimentId,
    result: {
      decision: prediction.decision,
      riskBand: band,
      probability: p,
      headline: abstained || !band ? 'No reliable result' : `${RISK_WORD[band]} likelihood`,
      // A calibrated probability read as a natural frequency.
      frequency: p === null ? null : `Out of 100 people with results like yours, about ${Math.round(p * 100)} have ${meta.patient.name}.`,
      reasons,
    },
    meaning: abstained
      ? `${outside ? 'Some of your values are unlike anything the model learned from' : 'Too much of your information is missing'}, so any number would be a guess. That is neither good nor bad news about ${meta.condition}: it means the information needs checking with your doctor.`
      : `Compared with people whose tests look similar to yours, the model estimates a ${RISK_WORD[band ?? 'moderate'].toLowerCase()} likelihood of ${meta.condition}. This is a screening signal, not a diagnosis. Only your doctor can diagnose.`,
    reliability: { level, summary: reliabilitySummary(points, abstained), points },
    influences,
    // What to do next: the dataset config's journey for this outcome.
    nextSteps: journey.map((s) => s.text),
    journey,
    questions: [
      'What do these results mean for me specifically?',
      'Which follow-up tests would you recommend, and when?',
      'Are any of my results likely to change with treatment or lifestyle?',
      'How does this screening tool compare with the tests you usually use?',
    ],
    safetyNote:
      'This report comes from a research decision-support tool. It is not a diagnosis and must not replace advice from a qualified clinician. If you feel unwell, seek medical care.',
  }
}
