import { formatDateTime } from '@/lib/format'
import type { PatientReport } from '@/types'

/** Plain-text summary of a report, for sharing (Web Share or clipboard). */
export function reportSummaryText(r: PatientReport): string {
  return [
    `JeevSetu screening report · ${r.reportId} · ${formatDateTime(r.generatedAt)}`,
    '',
    `Result: ${r.result.headline}${r.result.frequency ? `. ${r.result.frequency}` : ''}`,
    r.meaning,
    '',
    `How reliable it is: ${r.reliability.summary}`,
    '',
    'What to do next:',
    ...r.nextSteps.map((s) => `- ${s}`),
    '',
    r.safetyNote,
  ].join('\n')
}
