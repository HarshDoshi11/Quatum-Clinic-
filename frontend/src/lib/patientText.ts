/**
 * Patient Mode's spoken and shared texts, built from the report so they can never disagree with
 * the page. Relative imports only: check:mocks tests these too.
 */
import type { PatientReport, TrustLevel } from '../types'

export const CONFIDENCE_WORD: Record<TrustLevel, 'Low' | 'Medium' | 'High'> = { weak: 'Low', partial: 'Medium', strong: 'High' }

/** How sure the check is, in words a family member would use. */
const SURE: Record<TrustLevel, string> = {
  strong: 'The check is quite sure about this.',
  partial: 'The check is fairly sure about this.',
  weak: 'The check isn’t very sure about this.',
}

export const NO_ANSWER = 'We couldn’t give you a clear answer from this information.'
export const NOT_A_DIAGNOSIS = 'This isn’t a diagnosis.'

const abstained = (r: PatientReport) => r.result.decision === 'abstain' || r.result.outOfTen === null

/** "High confidence. 5 of 6 checks passed…" */
export const confidenceSentence = (r: PatientReport): string => `${CONFIDENCE_WORD[r.reliability.level]} confidence. ${r.reliability.summary}`

/**
 * For family: plain words, no personal identifiers (no report ID, date or values) and no exact numbers
 * other than the "about N in 10" sentence.
 */
export function familySummary(r: PatientReport): string {
  const lines = abstained(r)
    ? [`I did a short health check about ${r.condition}.`, NO_ANSWER, 'The next step is to talk it through with a doctor.']
    : [
        `I did a short health check about ${r.condition}.`,
        `${r.result.patientHeadline ?? ''}.`,
        r.result.frequency ?? '',
        SURE[r.reliability.level],
      ]
  return [
    ...lines,
    '',
    'Next steps:',
    ...r.journey.map((s) => `• ${s.text}`),
    '',
    `${NOT_A_DIAGNOSIS} It’s a screening check to discuss with a doctor.`,
  ].join('\n')
}

/** What the read-aloud button says: the headline, the "about N in 10" sentence, how sure we are, and the next steps. */
export function readAloudScript(r: PatientReport): string {
  const head = abstained(r) ? [NO_ANSWER] : [`${r.result.patientHeadline ?? ''}.`, r.result.frequency ?? '', `How sure are we? ${confidenceSentence(r)}`]
  return [...head, 'What to do next.', ...r.journey.map((s) => s.text), NOT_A_DIAGNOSIS].join(' ')
}
