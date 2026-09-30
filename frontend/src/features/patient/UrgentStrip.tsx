import { Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fillNodes, usePatientStrings } from '@/i18n/patient'
import { PATIENT_BASE } from '@/routes'

/** Tap-to-call buttons for the emergency numbers (from the i18n file: they are local). */
export function CallButtons({ label }: { label?: (number: string) => string }) {
  const { emergency } = usePatientStrings()
  return (
    <ul className="flex shrink-0 flex-wrap gap-3">
      {emergency.map((n) => (
        <li key={n.number}>
          <a
            href={`tel:${n.number}`}
            className="inline-flex h-12 items-center gap-3 rounded-control border border-rule-strong px-5 type-body text-ink transition-colors duration-300 hover:border-ink"
          >
            <Phone size="1.125rem" strokeWidth={1.5} className="text-risk-high-text" aria-hidden="true" />
            <span>
              <span className="font-medium">{label ? label(n.number) : n.number}</span> <span className="text-muted">· {n.label}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * "Is this urgent?": a calm strip for symptoms that can't wait for a check, with the numbers to call and a
 * link to the safety check (the first screen of the assessment).
 */
export function UrgentStrip({ symptoms }: { symptoms: string }) {
  const t = usePatientStrings().urgent
  return (
    <section aria-labelledby="urgent" className="rounded-panel bg-surface px-8 py-8 md:px-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="max-w-[60ch]">
          <h2 id="urgent" className="type-h2 text-ink">
            {t.title}
          </h2>
          <p className="mt-3 type-body-lg text-muted">{fillNodes(t.body, { symptoms: <span className="text-risk-high-text">{symptoms}</span> })}</p>
          <Link
            to={`${PATIENT_BASE}/assessment`}
            className="mt-3 inline-block type-body text-ink underline underline-offset-4 transition-colors duration-300 hover:text-muted"
          >
            {t.safetyLink}
          </Link>
        </div>
        <CallButtons />
      </div>
    </section>
  )
}
