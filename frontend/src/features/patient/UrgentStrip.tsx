import { Phone } from 'lucide-react'
import type { PatientUrgent } from '@/lib/domain'

/**
 * "Is this urgent?": a calm strip for symptoms that can't wait for a check. The symptoms and the numbers
 * to call come from the dataset config.
 */
export function UrgentStrip({ urgent }: { urgent: PatientUrgent }) {
  return (
    <section aria-labelledby="urgent" className="rounded-panel bg-surface px-8 py-8 md:px-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="max-w-[60ch]">
          <h2 id="urgent" className="type-h2 text-ink">
            Is this urgent?
          </h2>
          <p className="mt-3 type-body-lg text-muted">
            If you have <span className="text-risk-high-text">{urgent.symptoms}</span>, don’t use this check. Call for help now.
          </p>
        </div>
        <ul className="flex shrink-0 flex-wrap gap-3">
          {urgent.numbers.map((n) => (
            <li key={n.number}>
              <a
                href={`tel:${n.number}`}
                className="inline-flex h-12 items-center gap-3 rounded-control border border-rule-strong px-5 type-body text-ink transition-colors duration-300 hover:border-ink"
              >
                <Phone size="1.125rem" strokeWidth={1.5} className="text-risk-high-text" aria-hidden="true" />
                <span>
                  <span className="font-medium">{n.number}</span> <span className="text-muted">· {n.label}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
