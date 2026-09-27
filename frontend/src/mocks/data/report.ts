/** Plain-language patient report, built from the same predict + explain output. */
import { DATASETS } from '../../lib/domain'
import type { DatasetId, PatientInput, PatientReport, RiskBand, TrustLevel } from '../../types'
import { MODEL_FEATURES } from './features'
import { explain, predict } from './model'

const RISK_WORD: Record<RiskBand, string> = { low: 'Lower', moderate: 'Moderate', high: 'Higher' }

let reportCounter = 0

export function patientReport(dataset: DatasetId, input: PatientInput, generatedAt: string): PatientReport {
  const meta = DATASETS[dataset]
  const prediction = predict(dataset, input)
  const explanation = explain(dataset, input)
  const abstained = prediction.decision === 'abstain'

  const weakCount = prediction.trust.filter((t) => t.level === 'weak').length
  const partialCount = prediction.trust.filter((t) => t.level === 'partial').length
  const level: TrustLevel = abstained || weakCount > 0 ? 'weak' : partialCount > 1 ? 'partial' : 'strong'

  const plainLabel = (key: string) => MODEL_FEATURES[dataset].find((f) => f.key === key)?.plainLabel ?? key
  const influences = explanation.contributions
    .filter((c) => c.value !== null)
    .slice(0, 4)
    .map((c) => ({
      label: plainLabel(c.feature),
      direction: c.direction,
      plain:
        c.direction === 'increases'
          ? `Your ${plainLabel(c.feature).toLowerCase()} pushed the estimate up.`
          : `Your ${plainLabel(c.feature).toLowerCase()} pulled the estimate down.`,
    }))

  const band = prediction.riskBand
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
      probability: prediction.probability,
      headline: abstained || !band ? 'No reliable result' : `${RISK_WORD[band]} likelihood`,
    },
    meaning: abstained
      ? `We couldn't give a reliable result from this information. Some of your values are unlike anything the model learned from, so any number would be a guess.`
      : `Compared with people whose tests look similar to yours, the model estimates a ${RISK_WORD[band ?? 'moderate'].toLowerCase()} likelihood of ${meta.condition}. This is a screening signal, not a diagnosis — only your doctor can diagnose.`,
    reliability: {
      level,
      summary:
        level === 'strong'
          ? 'The model was consistent and your information was complete.'
          : level === 'partial'
            ? 'The result is usable, but some checks were less certain.'
            : 'Several reliability checks did not pass.',
      points: prediction.trust.map((t) => `${t.label}: ${t.reason}`),
    },
    influences,
    nextSteps: abstained
      ? ['Book an appointment with your doctor.', 'Bring this report and your original test results.', 'Ask whether any tests should be repeated.']
      : band === 'high'
        ? ['Book an appointment with your doctor soon.', 'Bring this report and your original test results.', 'Ask about follow-up tests.', 'Note any new symptoms before your visit.']
        : band === 'moderate'
          ? ['Discuss this result at your next appointment.', 'Bring this report and your original test results.', 'Ask whether follow-up tests are needed.']
          : ['Keep your routine check-ups.', 'Share this report at your next appointment.', 'Seek care sooner if symptoms appear.'],
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
