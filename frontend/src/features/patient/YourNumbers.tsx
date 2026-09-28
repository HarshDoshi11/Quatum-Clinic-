import { motion, useReducedMotion } from 'motion/react'
import { formatFeatureValue } from '@/components/ui/Field'
import type { RangeZoneKind, ReferenceRange } from '@/lib/domain'
import { easeGentle } from '@/lib/motion'
import type { FeatureSpec, PatientInput } from '@/types'
import { PATIENT_ICONS } from './icons'

const ZONE: Record<RangeZoneKind, string> = { healthy: 'bg-risk-low', borderline: 'bg-amber', outside: 'bg-coral' }
const ZONE_WORD: Record<RangeZoneKind, string> = { healthy: 'healthy', borderline: 'borderline', outside: 'outside the healthy range' }

/** A calm range bar: healthy (sage), borderline (amber) and outside (coral), with the value's marker gliding into place once. */
function RangeBar({ range, value }: { range: ReferenceRange; value: number }) {
  const reduced = useReducedMotion() ?? false
  const [lo, hi] = range.scale
  const at = (v: number) => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100
  const zone = range.zones.find((z) => value >= z.from && value < z.to) ?? (value >= hi ? range.zones[range.zones.length - 1] : range.zones[0])
  return (
    <div className="relative pt-3 [print-color-adjust:exact]" aria-hidden="true">
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {range.zones.map((z) => (
          <span key={`${z.from}-${z.to}`} className={`block h-full opacity-60 ${ZONE[z.kind]}`} style={{ width: `${((z.to - z.from) / (hi - lo)) * 100}%` }} />
        ))}
      </div>
      <motion.span
        className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
        initial={reduced ? false : { left: '0%', opacity: 0 }}
        whileInView={{ left: `${at(value)}%`, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: easeGentle, delay: 0.1 }}
        style={reduced ? { left: `${at(value)}%` } : undefined}
      >
        <span className="block h-[1.375rem] w-[3px] rounded-full bg-ink shadow-[0_0_0_2px_var(--bg)]" />
      </motion.span>
      <span className="sr-only">{ZONE_WORD[zone.kind]}</span>
    </div>
  )
}

/**
 * "Your numbers": each measured value with a general reference range as a calm bar, the rest listed
 * simply. Kept visibly apart from the model: these ranges are not what it used to decide.
 */
export function YourNumbers({ features, input, ranges, note }: { features: FeatureSpec[]; input: PatientInput; ranges: Record<string, ReferenceRange>; note: string | null }) {
  const measured = features.filter((f) => !f.options)
  const withRange = measured.filter((f) => ranges[f.key])
  const others = measured.filter((f) => !ranges[f.key])

  if (withRange.length === 0 && note) {
    return (
      <div className="max-w-[60ch] rounded-panel bg-surface p-8">
        <p className="type-body-lg text-ink">{note}</p>
      </div>
    )
  }

  return (
    <div className="max-w-[44rem]">
      <p className="type-body-lg text-muted">These are general health ranges, not what the model used to decide.</p>
      <ul className="mt-8 flex flex-col gap-8">
        {withRange.map((f) => {
          const range = ranges[f.key]
          const value = input[f.key] ?? null
          const Icon = PATIENT_ICONS[f.icon]
          return (
            <li key={f.key} className="rounded-panel bg-surface p-6 print:break-inside-avoid">
              <p className="flex items-center gap-3 type-body-lg text-ink">
                <Icon size="1.25rem" strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
                <span>
                  {range.name} {value === null ? <span className="text-muted">· not recorded</span> : formatFeatureValue(f, value)}
                  <span className="text-muted"> · {range.healthy}</span>
                </span>
              </p>
              {value !== null && (
                <div className="mt-4">
                  <RangeBar range={range} value={value} />
                </div>
              )}
              <p className="mt-3 type-body text-muted">{range.source}</p>
            </li>
          )
        })}
      </ul>
      {others.length > 0 && (
        <>
          <p className="mt-12 type-body-lg text-ink">Your other numbers</p>
          <ul className="mt-4 flex flex-col gap-3">
            {others.map((f) => {
              const Icon = PATIENT_ICONS[f.icon]
              const value = input[f.key] ?? null
              return (
                <li key={f.key} className="flex items-center gap-3 type-body-lg text-ink">
                  <Icon size="1.125rem" strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden="true" />
                  <span>
                    {f.question} <span className="text-muted">· {value === null ? 'not recorded' : formatFeatureValue(f, value)}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
