import { ChevronDown, TriangleAlert } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { C, TICK, useChartUnits } from '@/components/charts/chartTheme'
import { Glossed } from '@/components/ui/Glossed'
import { Skeleton } from '@/components/ui/Skeleton'
import { StatusMark, TRUST_LABEL } from '@/components/ui/StatusMark'
import { BACKENDS } from '@/lib/domain'
import { formatDelta, formatNumber, formatPercent, formatPoints } from '@/lib/format'
import { easePrecise } from '@/lib/motion'
import { useElementSize } from '@/lib/useElementSize'
import type { FieldStatus, PredictResponse, TrustEvidence as Evidence, TrustLevel, TrustResponse, TrustSignal, TrustSignalId } from '@/types'

/** Shown instead of any panel that would reveal the withheld number (CLAUDE.md, results rule 6). */
function Withheld() {
  return <p className="type-small text-muted">Not shown: the system declined to answer for this patient, so there is no estimate to examine.</p>
}

/** A panel's SVG strip: full width, rem-sized. */
function Strip({ height, children }: { height: number; children: (width: number) => ReactNode }) {
  const [ref, { width }] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} style={{ height }} aria-hidden="true">
      {width > 0 && (
        <svg width={width} height={height} className="block overflow-visible">
          {children(width)}
        </svg>
      )}
    </div>
  )
}

const text = { ...TICK, fill: C.ink }
/** Anchor a label so it stays inside the strip near either end. */
const anchor = (x: number, width: number, w = 90) => (x < w / 2 ? 'start' : x > width - w / 2 ? 'end' : 'middle')

// ─── The six panels ─────────────────────────────────────────

function StabilityPanel({ seeds, estimate }: { seeds: number[] | null; estimate: number | null }) {
  const { rem } = useChartUnits()
  if (!seeds || estimate === null) return <Withheld />
  const lo = Math.min(...seeds)
  const hi = Math.max(...seeds)
  const pad = Math.max(0.02, (hi - lo) * 0.6)
  const [d0, d1] = [Math.max(0, lo - pad), Math.min(1, hi + pad)]
  return (
    <Strip height={rem * 3.25}>
      {(width) => {
        const x = (v: number) => rem * 0.5 + ((v - d0) / (d1 - d0)) * (width - rem)
        const axisY = rem * 1.5
        return (
          <>
            <line x1={0} x2={width} y1={axisY} y2={axisY} stroke={C.ruleStrong} />
            <line x1={x(estimate)} x2={x(estimate)} y1={axisY - rem * 0.6} y2={axisY + rem * 0.6} stroke={C.ink} strokeWidth={2} />
            <text x={x(estimate)} y={axisY - rem * 0.85} textAnchor={anchor(x(estimate), width, rem * 9)} {...text}>
              Estimate {formatPercent(estimate)}
            </text>
            {seeds.map((s, i) => (
              <circle key={i} cx={x(s)} cy={axisY} r={4} fill={C.bg} stroke={C.accent} strokeWidth={2} />
            ))}
            <text x={x(lo)} y={axisY + rem * 1.4} textAnchor="end" {...TICK}>
              {formatPercent(lo)}
            </text>
            <text x={x(hi)} y={axisY + rem * 1.4} textAnchor="start" {...TICK}>
              {formatPercent(hi)}
            </text>
          </>
        )
      }}
    </Strip>
  )
}

const FIELD_GLYPH: Record<FieldStatus, ReactNode> = {
  present: <span className="block h-2 w-2 shrink-0 bg-ink" />,
  imputed: <span className="block h-2 w-2 shrink-0 border border-ink" />,
  'out-of-range': <TriangleAlert size="0.75rem" strokeWidth={1.5} className="shrink-0 text-ink" />,
}
const FIELD_WORD: Record<FieldStatus, string> = { present: 'present', imputed: 'filled with the training average', 'out-of-range': 'outside the training range' }

function DataQualityPanel({ fields }: Evidence['dataQuality']) {
  const count = (s: FieldStatus) => fields.filter((f) => f.status === s).length
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 type-small text-muted">
        {(['present', 'imputed', 'out-of-range'] as FieldStatus[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true">{FIELD_GLYPH[s]}</span>
            <span className="num text-ink">{count(s)}</span> {FIELD_WORD[s]}
          </span>
        ))}
      </p>
      <ul className="mt-2 grid grid-cols-3 gap-x-4">
        {fields.map((f) => (
          <li key={f.key} className="flex h-5 min-w-0 items-center gap-1.5 type-small text-ink">
            <span aria-hidden="true">{FIELD_GLYPH[f.status]}</span>
            <span className="truncate">{f.label}</span>
            <span className="sr-only">: {FIELD_WORD[f.status]}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

function ShiftPanel({ distance, feature, typical, cutoff, outOfRange }: Evidence['distributionShift']) {
  const { rem } = useChartUnits()
  const max = Math.ceil(Math.max(cutoff + 1, distance + 0.5))
  return (
    <>
      <Strip height={rem * 4}>
        {(width) => {
          const x = (v: number) => (Math.min(v, max) / max) * width
          const trackY = rem * 1.75
          return (
            <>
              <rect x={0} y={trackY - 3} width={width} height={6} fill={C.rule} />
              <rect x={0} y={trackY - 3} width={x(typical)} height={6} fill={C.ink} fillOpacity={0.3} />
              <text x={0} y={trackY - rem * 0.75} {...TICK}>
                95% of training ≤ {formatNumber(typical, 1)} SD
              </text>
              <line x1={x(cutoff)} x2={x(cutoff)} y1={trackY - rem * 0.6} y2={trackY + rem * 0.6} stroke={C.ink} strokeDasharray="3 2" />
              <text x={x(cutoff)} y={trackY - rem * 0.75} textAnchor="end" {...text}>
                OOD cutoff {formatNumber(cutoff, 1)} SD
              </text>
              <path d={`M${x(distance)},${trackY + 4} l4,6 h-8 Z`} fill={C.accent} />
              <line x1={x(distance)} x2={x(distance)} y1={trackY - 5} y2={trackY + 5} stroke={C.accent} strokeWidth={2} />
              <text x={x(distance)} y={trackY + rem * 1.55} textAnchor={anchor(x(distance), width, rem * 14)} {...text}>
                This patient {formatNumber(distance, 1)} SD{feature ? ` · ${feature}` : ''}
              </text>
            </>
          )
        }}
      </Strip>
      {outOfRange > 0 && (
        <p className="mt-1 type-small text-ink">
          {outOfRange} value{outOfRange > 1 ? 's are' : ' is'} outside anything seen in training.
        </p>
      )}
    </>
  )
}

function CalibrationPanel({ trust, bin }: { trust: TrustResponse | undefined; bin: number | null }) {
  const { rem } = useChartUnits()
  if (!trust) return <Skeleton width="100%" height="7rem" />
  const size = rem * 7
  const s = (v: number) => v * size
  const mine = trust.calibration.find((b) => b.predicted === bin)
  return (
    <div className="flex items-start gap-5">
      <svg width={size} height={size} className="block shrink-0 overflow-visible" aria-hidden="true">
        <rect x={0} y={0} width={size} height={size} fill="none" stroke={C.rule} />
        <line x1={0} y1={size} x2={size} y2={0} stroke={C.ink} strokeDasharray="4 4" />
        {trust.calibration.map((b) => (
          <g key={b.predicted}>
            <line x1={s(b.predicted)} x2={s(b.predicted)} y1={size - s(Math.min(1, b.observed + b.observedStd))} y2={size - s(Math.max(0, b.observed - b.observedStd))} stroke={C.muted} />
            <circle cx={s(b.predicted)} cy={size - s(b.observed)} r={b.predicted === bin ? 5 : 3} fill={b.predicted === bin ? C.bg : C.muted} stroke={b.predicted === bin ? C.accent : 'none'} strokeWidth={2} />
          </g>
        ))}
      </svg>
      <div className="min-w-0 type-small text-muted">
        <p>
          Groups of test patients: predicted risk across, the share actually positive up. On the dashed line = the percentages come true.
        </p>
        <p className="num mt-1 type-label text-ink">ECE {formatPercent(trust.ece)}</p>
        <p className="mt-1 text-ink">
          {mine ? (
            <>
              This patient’s group: ~{formatPercent(mine.predicted, 0)} predicted → {formatPercent(mine.observed)} ±{formatPoints(mine.observedStd)} observed ({mine.count}{' '}
              test patients)
            </>
          ) : (
            'No estimate to place for this patient.'
          )}
        </p>
      </div>
    </div>
  )
}

function InputSensitivityPanel({ range, errorSd, estimate }: Evidence['inputSensitivity'] & { estimate: number | null }) {
  const { rem } = useChartUnits()
  if (!range || estimate === null) return <Withheld />
  const [lo, hi] = range
  const pad = Math.max(0.03, (hi - lo) * 1.5)
  const [d0, d1] = [Math.max(0, lo - pad), Math.min(1, hi + pad)]
  return (
    <>
      <Strip height={rem * 3.25}>
        {(width) => {
          const x = (v: number) => ((v - d0) / (d1 - d0)) * width
          const y = rem * 1.5
          return (
            <>
              <line x1={0} x2={width} y1={y} y2={y} stroke={C.ruleStrong} />
              <rect x={x(lo)} y={y - 4} width={Math.max(2, x(hi) - x(lo))} height={8} fill={C.ink} fillOpacity={0.25} stroke={C.ink} />
              <line x1={x(estimate)} x2={x(estimate)} y1={y - rem * 0.6} y2={y + rem * 0.6} stroke={C.ink} strokeWidth={2} />
              <text x={x(estimate)} y={y - rem * 0.85} textAnchor={anchor(x(estimate), width, rem * 9)} {...text}>
                Estimate {formatPercent(estimate)}
              </text>
              <text x={x(lo) - 4} y={y + rem * 1.4} textAnchor="end" {...TICK}>
                {formatPercent(lo)}
              </text>
              <text x={x(hi) + 4} y={y + rem * 1.4} textAnchor="start" {...TICK}>
                {formatPercent(hi)}
              </text>
            </>
          )
        }}
      </Strip>
      <p className="type-small text-muted">
        Each measured value nudged by ±{errorSd} standard deviations, one at a time: the estimate stays between these ends.
      </p>
    </>
  )
}

function HardwarePanel({ rows }: { rows: Evidence['hardware'] }) {
  const deployed = rows.find((r) => r.deployed)?.probability ?? null
  return (
    <>
      {deployed === null && <Withheld />}
      {deployed !== null && (
        <dl className="grid grid-cols-3 gap-4">
          {rows.map((r) => (
            <div key={r.backend}>
              <dt className="type-label text-muted">
                {BACKENDS[r.backend].name}
                {r.deployed && <span className="text-ink"> · this page</span>}
              </dt>
              <dd className="mt-0.5 flex items-baseline gap-2">
                <span className="num type-body-lg text-ink">{r.probability === null ? '—' : formatPercent(r.probability)}</span>
                {!r.deployed && r.probability !== null && (
                  <span className="num type-small text-muted">{formatDelta((r.probability - deployed) * 100, 1)} pts</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <Link to="/hardware" className="mt-2 inline-block type-label text-ink underline-offset-4 hover:underline">
        Open in Hardware Reality Lab ↗
      </Link>
    </>
  )
}

function Panel({ id, prediction, trust }: { id: TrustSignalId; prediction: PredictResponse; trust: TrustResponse | undefined }) {
  const ev = prediction.evidence
  switch (id) {
    case 'stability':
      return <StabilityPanel seeds={ev.stability.seeds} estimate={prediction.probability} />
    case 'data-quality':
      return <DataQualityPanel {...ev.dataQuality} />
    case 'distribution-shift':
      return <ShiftPanel {...ev.distributionShift} />
    case 'calibration':
      return <CalibrationPanel trust={trust} bin={ev.calibration.bin} />
    case 'input-sensitivity':
      return <InputSensitivityPanel {...ev.inputSensitivity} estimate={prediction.probability} />
    case 'hardware-sensitivity':
      return <HardwarePanel rows={ev.hardware} />
  }
}

// ─── The list ───────────────────────────────────────────────

function Row({
  signal,
  open,
  onToggle,
  children,
}: {
  signal: TrustSignal
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const panelId = useId()
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex h-7 w-full items-center gap-3 text-left hover:bg-ink/[0.04] [@media(max-height:52rem)]:h-6"
      >
        <StatusMark level={signal.level} />
        <span className="type-label w-[4.25rem] shrink-0 text-muted">{TRUST_LABEL[signal.level]}</span>
        <span className="w-[11.5rem] shrink-0 truncate type-small text-ink">{signal.label}</span>
        <span className="min-w-0 flex-1 truncate type-small text-muted">{signal.short}</span>
        <ChevronDown
          size="0.875rem"
          strokeWidth={1.5}
          className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: easePrecise }}
            className="overflow-hidden"
          >
            {/* Indented to the level word, so the panel reads as part of its row */}
            <div className="max-h-[10rem] pt-1 pb-4 pl-6">
              <p className="mb-2 type-small text-ink">
                <Glossed text={signal.reason} />
              </p>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

/**
 * The six trust signals as one-line rows; a row expands inline (one at a time) to show the
 * evidence behind it. Every panel reads the prediction's `evidence` and the trust API, so it
 * shows the same numbers as the rest of the page, and nothing that would reveal a withheld estimate.
 */
export function TrustEvidenceList({ prediction, trust }: { prediction: PredictResponse | null; trust: TrustResponse | undefined }) {
  const [openId, setOpenId] = useState<TrustSignalId | null>(null)
  if (!prediction) return <Skeleton width="100%" height="11rem" />
  const counts = (['strong', 'partial', 'weak'] as TrustLevel[]).map((l) => `${prediction.trust.filter((s) => s.level === l).length} ${TRUST_LABEL[l].toLowerCase()}`)
  return (
    <>
      <div className="flex h-6 items-center justify-between gap-4 [@media(max-height:52rem)]:h-5">
        <p className="type-label text-muted">Trust evidence</p>
        <p className="num type-label text-muted">{counts.join(' · ')}</p>
      </div>
      <ul className="mt-1">
        {prediction.trust.map((s) => (
          <Row key={s.id} signal={s} open={openId === s.id} onToggle={() => setOpenId((o) => (o === s.id ? null : s.id))}>
            <Panel id={s.id} prediction={prediction} trust={trust} />
          </Row>
        ))}
      </ul>
    </>
  )
}
