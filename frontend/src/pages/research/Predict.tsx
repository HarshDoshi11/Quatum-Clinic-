import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { api, isAbortError, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, DRAW_MS, TICK, niceScale, useChartUnits } from '@/components/charts/chartTheme'
import { endLabel } from '@/components/charts/directLabels'
import { BackendNote } from '@/components/ui/BackendNote'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { FeatureField } from '@/components/ui/Field'
import { Gauge } from '@/components/ui/Gauge'
import { Glossed } from '@/components/ui/Glossed'
import type { Column } from '@/components/ui/HairlineTable'
import { AnimatedNumber } from '@/components/ui/Metric'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Slider } from '@/components/ui/Slider'
import { StatusMark, TRUST_LABEL } from '@/components/ui/StatusMark'
import { Tabs } from '@/components/ui/Tabs'
import { Term } from '@/components/ui/Term'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatPercent, formatPoints } from '@/lib/format'
import { tBase } from '@/lib/motion'
import { operatingSentence } from '@/lib/safety'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { usePageBackend } from '@/state/pageBackend'
import { PATIENT_SOURCE_LABEL, useCurrentPatient } from '@/state/patient'
import type { CalibrationBin, DatasetId, FeatureSpec, PatientInput, PredictResponse, RiskBand, ThresholdPoint, TrustLevel, TrustResponse } from '@/types'

const RISK_LABEL: Record<RiskBand, string> = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' }
/** Risk as a word: the text-safe risk tokens (≥ 4.5 : 1 in both themes). */
const RISK_TEXT: Record<RiskBand, string> = { low: 'text-risk-low-text', moderate: 'text-risk-mid-text', high: 'text-risk-high-text' }
/** Risk-band edges (the mock/API's riskBand rule), drawn as gauge ticks. */
const BAND_EDGES = [0.3, 0.6]

const pm = (std: number) => `±${formatPoints(std)}`
const pct = (x: number) => `${Math.round(x * 100)}%`

// ─── Fig. 01 — calibration ──────────────────────────────────

type CalRow = CalibrationBin & { band: [number, number] }

function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  const reduced = useReducedMotion() ?? false
  const units = useChartUnits()
  const rows: CalRow[] = bins.map((b) => ({ ...b, band: [Math.max(0, b.observed - b.observedStd), Math.min(1, b.observed + b.observedStd)] }))
  const { ticks } = niceScale(0, 1, 5, true)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: units.rem * 1.5, right: units.rem, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={C.rule} />
        <XAxis
          {...AXIS}
          type="number"
          dataKey="predicted"
          interval={0}
          domain={[0, 1]}
          ticks={ticks}
          tickFormatter={pct}
          height={units.rem * 2.75}
          label={{ value: 'Predicted risk', position: 'insideBottom', offset: 0, ...TICK, fill: C.muted }}
        />
        <YAxis {...AXIS} type="number" domain={[0, 1]} ticks={ticks} tickFormatter={pct} width={units.rem * 3.25} />
        <ReferenceLine
          segment={[
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]}
          stroke={C.ink}
          strokeDasharray="4 4"
        />
        {/* Direct label at the end of the diagonal, not floating mid-plot. */}
        <ReferenceDot
          x={1}
          y={1}
          r={0}
          ifOverflow="visible"
          label={(props: unknown) => {
            // Anchored at the diagonal's end (1, 1), just above-left of it so the line never runs through the text.
            const vb = (props as { viewBox?: { x: number; y: number } }).viewBox
            if (!vb) return <g />
            return (
              <text x={vb.x - units.rem * 0.5} y={vb.y - units.rem * 0.6} textAnchor="end" {...TICK} fill={C.ink}>
                Perfect calibration
              </text>
            )
          }}
        />
        <ChartTooltip
          cursor={{ stroke: C.ruleStrong, strokeWidth: 1 }}
          content={({ active, payload }) => {
            const r = active ? (payload?.[0]?.payload as CalRow | undefined) : undefined
            if (!r) return null
            return (
              <ChartTooltipCard
                title={`Predicted ~${formatPercent(r.predicted, 0)}`}
                rows={[
                  { key: 'o', color: C.accent, label: 'Observed', value: `${formatPercent(r.observed)} ${pm(r.observedStd)}` },
                  { key: 'n', label: 'Test patients', value: r.count },
                ]}
              />
            )
          }}
        />
        <Area dataKey="band" type="monotone" stroke="none" fill={C.accent} fillOpacity={0.12} isAnimationActive={false} activeDot={false} legendType="none" tooltipType="none" />
        <Line
          dataKey="observed"
          type="monotone"
          stroke={C.accent}
          strokeWidth={2}
          dot={{ r: 4, strokeWidth: 2, fill: C.bg }}
          activeDot={{ r: 5, strokeWidth: 2, fill: C.bg }}
          isAnimationActive={!reduced}
          animationDuration={DRAW_MS}
          animationEasing="ease-out"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Fig. 02 — threshold ────────────────────────────────────

/** Y range covering both bands; zoomed (with a note) when it doesn't start at 0. */
function thresholdScale(trust: TrustResponse) {
  const lows = trust.thresholdCurve.flatMap((p) => [p.sensitivity - p.sensitivityStd, p.specificity - p.specificityStd])
  return niceScale(Math.max(0, Math.min(...lows, trust.safeSensitivity)), 1, 5)
}

type ThrRow = ThresholdPoint & { sensBand: [number, number]; specBand: [number, number] }

function ThresholdChart({ trust, threshold }: { trust: TrustResponse; threshold: number }) {
  const reduced = useReducedMotion() ?? false
  const units = useChartUnits()
  const rows: ThrRow[] = trust.thresholdCurve.map((p) => ({
    ...p,
    sensBand: [Math.max(0, p.sensitivity - p.sensitivityStd), Math.min(1, p.sensitivity + p.sensitivityStd)],
    specBand: [Math.max(0, p.specificity - p.specificityStd), Math.min(1, p.specificity + p.specificityStd)],
  }))
  const { domain, ticks } = thresholdScale(trust)
  const xTicks = niceScale(0, 1, 5, true).ticks
  const last = rows.length - 1
  const current = trust.thresholdCurve.find((p) => p.threshold === threshold)
  const t0 = trust.defaultThreshold
  // Bands are narrow (±1–2 points), so they get a visible fill and hairline edges.
  const band = { type: 'monotone' as const, stroke: C.accent, strokeOpacity: 0.45, strokeWidth: 1, fill: C.accent, fillOpacity: 0.22, isAnimationActive: false, activeDot: false, legendType: 'none' as const, tooltipType: 'none' as const }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: units.rem * 2.25, right: units.rem * 7, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} stroke={C.rule} />
        <XAxis
          {...AXIS}
          type="number"
          dataKey="threshold"
          interval={0}
          domain={[0, 1]}
          ticks={xTicks}
          tickFormatter={pct}
          height={units.rem * 2.75}
          label={{ value: 'Decision threshold', position: 'insideBottom', offset: 0, ...TICK, fill: C.muted }}
        />
        <YAxis {...AXIS} type="number" domain={domain} ticks={ticks} tickFormatter={pct} width={units.rem * 3.25} />
        <ReferenceLine y={trust.safeSensitivity} stroke={C.riskHigh} strokeDasharray="4 4" label={{ value: `${pct(trust.safeSensitivity)} safety`, position: 'insideBottomLeft', ...TICK, fill: C.ink }} />
        <ReferenceLine
          x={t0}
          stroke={C.ink}
          strokeDasharray="4 4"
          label={(props: unknown) => {
            // Marker rule, written in the top margin from the line rightwards (clear of both curves on every dataset).
            const vb = (props as { viewBox?: { x: number; y: number } }).viewBox
            if (!vb) return <g />
            return (
              <text x={vb.x} y={vb.y - units.rem * 0.75} {...TICK} fill={C.ink}>
                {`Default ${pct(t0)}`}
                <tspan fill={C.muted}> = benchmark operating point</tspan>
              </text>
            )
          }}
        />
        {threshold !== t0 && <ReferenceLine x={threshold} stroke={C.ink} />}
        <ChartTooltip
          cursor={{ stroke: C.ruleStrong, strokeWidth: 1 }}
          content={({ active, payload }) => {
            const r = active ? (payload?.[0]?.payload as ThrRow | undefined) : undefined
            if (!r) return null
            return (
              <ChartTooltipCard
                title={`Threshold ${pct(r.threshold)}${r.threshold === t0 ? ' · default' : ''}`}
                rows={[
                  { key: 's', color: C.accent, label: 'Sensitivity', value: `${formatPercent(r.sensitivity)} ${pm(r.sensitivityStd)}` },
                  { key: 'p', color: C.accent, dashed: true, label: 'Specificity', value: `${formatPercent(r.specificity)} ${pm(r.specificityStd)}` },
                ]}
              />
            )
          }}
        />
        <Area dataKey="sensBand" {...band} />
        <Area dataKey="specBand" {...band} strokeDasharray="3 3" />
        <Line
          dataKey="sensitivity"
          type="monotone"
          stroke={C.accent}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: C.bg }}
          isAnimationActive={!reduced}
          animationDuration={DRAW_MS}
          label={endLabel(last, 'Sensitivity')}
        />
        <Line
          dataKey="specificity"
          type="monotone"
          stroke={C.accent}
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, fill: C.bg, strokeDasharray: '0' }}
          isAnimationActive={!reduced}
          animationDuration={DRAW_MS}
          label={endLabel(last, 'Specificity')}
        />
        {current && <ReferenceDot x={current.threshold} y={current.sensitivity} r={5} fill={C.bg} stroke={C.ink} strokeWidth={2} />}
        {current && <ReferenceDot x={current.threshold} y={current.specificity} r={5} fill={C.bg} stroke={C.ink} strokeWidth={2} />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Right column: result, threshold, trust, stats ─────────

function ResultBlock({ prediction }: { prediction: PredictResponse | null }) {
  if (!prediction) {
    return (
      <div className="flex items-center gap-6" aria-hidden="true">
        <Skeleton width="8rem" height="4.5rem" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton width="60%" height="3.5rem" />
          <Skeleton width="80%" />
        </div>
      </div>
    )
  }
  const t = pct(prediction.threshold)
  return (
    <AnimatePresence mode="wait" initial={false}>
      {prediction.decision === 'predict' && prediction.probability !== null && prediction.riskBand ? (
        <motion.div key="predict" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tBase}>
          {/* One row: gauge · probability + seed range · risk word + threshold status (keeps the story above the fold). */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="w-[6.5rem] shrink-0">
              <Gauge
                value={prediction.probability}
                band={prediction.riskBand}
                threshold={prediction.threshold}
                ticks={BAND_EDGES}
                label={`Estimated probability ${formatPercent(prediction.probability)}, ${RISK_LABEL[prediction.riskBand].toLowerCase()}`}
              />
            </div>
            <div className="shrink-0">
              <p className="type-metric-xl text-ink">
                <AnimatedNumber value={prediction.probability} format={(v) => formatPercent(v)} />
              </p>
              {prediction.interval && (
                <p className="num type-small whitespace-nowrap text-muted">
                  5-<Term term="seed">seed</Term> range {formatPercent(prediction.interval[0])} – {formatPercent(prediction.interval[1])}
                </p>
              )}
            </div>
            <div className="min-w-[9rem] flex-1">
              <p className={`type-body-lg font-medium ${RISK_TEXT[prediction.riskBand]}`}>{RISK_LABEL[prediction.riskBand]}</p>
              <p className="type-small text-ink">{prediction.flagged ? `Passes the ${t} threshold` : `Below the ${t} threshold`}</p>
              <p className="type-small text-muted">{prediction.flagged ? 'Flag for follow-up' : 'Not flagged'}</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div key="abstain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tBase}>
          <AbstainBlock reasons={prediction.abstainReasons} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Replaces the result when the system abstains: no number, the computed reasons.
 * At most three lines (two reasons + "show more" when there are more), so the block fits the first screen.
 */
function AbstainBlock({ reasons }: { reasons: string[] }) {
  const [all, setAll] = useState(false)
  const shown = all || reasons.length <= 3 ? reasons : reasons.slice(0, 2)
  return (
    <>
      <p className="type-h2 text-ink">Not enough evidence to decide.</p>
      <ul className="mt-2 flex flex-col">
        {shown.map((r) => (
          <li key={r} className="flex gap-2 type-small text-ink">
            <span className="mt-[0.55rem] block h-1 w-1 shrink-0 bg-ink" aria-hidden="true" />
            <span>
              <Glossed text={r} />
            </span>
          </li>
        ))}
      </ul>
      {reasons.length > 3 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="type-label text-ink underline-offset-4 hover:underline">
          {all ? 'Show fewer' : `Show ${reasons.length - 2} more`}
        </button>
      )}
    </>
  )
}

function TrustList({ prediction }: { prediction: PredictResponse | null }) {
  if (!prediction) return <Skeleton width="100%" height="11rem" />
  const counts = (['strong', 'partial', 'weak'] as TrustLevel[]).map((l) => `${prediction.trust.filter((s) => s.level === l).length} ${TRUST_LABEL[l].toLowerCase()}`)
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <p className="type-label text-ink">Trust evidence</p>
        <p className="num type-label text-muted">{counts.join(' · ')}</p>
      </div>
      <ul className="mt-1.5 border-t border-rule">
        {prediction.trust.map((s) => (
          // One line each; the full reason on hover or focus.
          <Tooltip key={s.id} label={`${s.label} · ${TRUST_LABEL[s.level]}`} content={s.reason} width={300}>
            <li tabIndex={0} className="flex h-7 cursor-help items-center gap-3 border-b border-rule">
              <StatusMark level={s.level} />
              <span className="w-[11.5rem] shrink-0 truncate type-small text-ink">{s.label}</span>
              <span className="min-w-0 truncate type-small text-muted">{s.short}</span>
              <span className="sr-only">. {s.reason}</span>
            </li>
          </Tooltip>
        ))}
      </ul>
    </>
  )
}

// ─── Left column: collapsible input groups ─────────────────

const isFlagged = (f: FeatureSpec, v: number | null) => v === null || v < f.min || v > f.max

/** Groups to open for a patient: the first, plus any with a missing or out-of-range value. */
function groupsToOpen(groups: [string, FeatureSpec[]][], input: PatientInput): Set<string> {
  const open = new Set<string>(groups[0] ? [groups[0][0]] : [])
  for (const [g, fs] of groups) if (fs.some((f) => isFlagged(f, input[f.key] ?? null))) open.add(g)
  return open
}

function FieldGroup({ name, features, input, open, onToggle, onChange }: {
  name: string
  features: FeatureSpec[]
  input: PatientInput
  open: boolean
  onToggle: () => void
  onChange: (key: string, v: number | null) => void
}) {
  const recorded = features.filter((f) => (input[f.key] ?? null) !== null).length
  const outside = features.filter((f) => {
    const v = input[f.key] ?? null
    return v !== null && (v < f.min || v > f.max)
  }).length
  const missing = features.length - recorded
  return (
    <fieldset className="border-b border-rule">
      <legend className="contents">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex h-11 w-full items-center justify-between gap-3 text-left">
          <span className="type-label text-ink">{name}</span>
          <span className="flex items-center gap-3">
            <span className="num type-label text-muted">
              {recorded} of {features.length} recorded
              {outside > 0 && <span className="text-ink"> · {outside} outside range</span>}
              {missing > 0 && outside === 0 && <span className="text-ink"> · {missing} not recorded</span>}
            </span>
            <ChevronDown size="0.875rem" strokeWidth={1.5} className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </span>
        </button>
      </legend>
      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-1 pb-6">
          {features.map((f) => (
            <FeatureField key={f.key} feature={f} value={input[f.key] ?? null} onChange={(v) => onChange(f.key, v)} />
          ))}
        </div>
      )}
    </fieldset>
  )
}

// ─── Page ───────────────────────────────────────────────────

interface Request {
  dataset: DatasetId
  input: PatientInput
  threshold: number
}

type TrustTab = 'calibration' | 'threshold'

export function Predict({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const trust = useResource((signal) => api.getTrust(datasetId, { signal }), [datasetId, version])
  const { patient, setPatient } = useCurrentPatient(datasetId, schema.data)
  const trustData = trust.data?.dataset === datasetId ? trust.data : undefined
  // The top bar shows this page's backend, so the two never disagree.
  usePageBackend(trustData?.backend, trustData?.qubits)

  // Threshold: the default operating point until the user moves the slider (per dataset).
  const [picked, setPicked] = useState<{ dataset: DatasetId; value: number } | null>(null)
  const threshold = picked?.dataset === datasetId ? picked.value : trustData?.defaultThreshold
  const isDefault = threshold === trustData?.defaultThreshold

  const request = useMemo<Request | null>(
    () => (patient && threshold !== undefined ? { dataset: datasetId, input: patient.input, threshold } : null),
    [patient, threshold, datasetId],
  )
  const debounced = useDebouncedValue(request, 200)
  const [prediction, setPrediction] = useState<PredictResponse | null>(null)
  const [predictError, setPredictError] = useState<Error | null>(null)
  useEffect(() => {
    if (!debounced || debounced.dataset !== datasetId) return
    const controller = new AbortController()
    api.predict(debounced, { signal: controller.signal }).then(
      (res) => {
        setPrediction(res)
        setPredictError(null)
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) setPredictError(error instanceof Error ? error : new Error(String(error)))
      },
    )
    return () => controller.abort()
  }, [debounced, datasetId, version])
  const current = prediction?.dataset === datasetId ? prediction : null

  const groups = useMemo(() => {
    const out = new Map<string, FeatureSpec[]>()
    for (const f of schema.data?.features ?? []) out.set(f.group, [...(out.get(f.group) ?? []), f])
    return [...out.entries()]
  }, [schema.data])

  // Collapsible groups: first open; loading a patient also opens groups with flagged values.
  const [open, setOpen] = useState<{ dataset: DatasetId; groups: Set<string> } | null>(null)
  const openGroups = open?.dataset === datasetId ? open.groups : patient ? groupsToOpen(groups, patient.input) : new Set<string>()
  const toggle = (g: string) => {
    const next = new Set(openGroups)
    if (next.has(g)) next.delete(g)
    else next.add(g)
    setOpen({ dataset: datasetId, groups: next })
  }
  const load = (input: PatientInput, source: 'sample' | 'unusual' | 'entered') => {
    setPatient({ input, source })
    setOpen({ dataset: datasetId, groups: groupsToOpen(groups, input) })
  }
  const setValue = (key: string, value: number | null) => patient && setPatient({ input: { ...patient.input, [key]: value }, source: 'entered' })
  const clearAll = () => schema.data && load(Object.fromEntries(schema.data.features.map((f) => [f.key, null])), 'entered')

  const point = trustData && threshold !== undefined ? trustData.thresholdCurve.find((p) => p.threshold === threshold) : undefined
  const [tab, setTab] = useState<TrustTab>('calibration')

  const calColumns: Column<CalibrationBin>[] = [
    { key: 'p', header: 'Predicted', mono: true, render: (b) => formatPercent(b.predicted) },
    { key: 'o', header: 'Observed', align: 'right', mono: true, render: (b) => `${formatPercent(b.observed)} ${pm(b.observedStd)}` },
    { key: 'n', header: 'Test patients', align: 'right', mono: true, render: (b) => String(b.count) },
  ]
  const thrColumns: Column<ThresholdPoint>[] = [
    { key: 't', header: 'Threshold', mono: true, render: (p) => `${pct(p.threshold)}${p.threshold === trustData?.defaultThreshold ? ' · default' : ''}` },
    { key: 's', header: 'Sensitivity', align: 'right', mono: true, render: (p) => `${formatPercent(p.sensitivity)} ${pm(p.sensitivityStd)}` },
    { key: 'p', header: 'Specificity', align: 'right', mono: true, render: (p) => `${formatPercent(p.specificity)} ${pm(p.specificityStd)}` },
  ]
  const thrRows = trustData?.thresholdCurve.filter((p) => Math.round(p.threshold * 100) % 5 === 0 || p.threshold === trustData.defaultThreshold)

  if (schema.status === 'error' || trust.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn't load the prediction tools." body={(schema.error ?? trust.error)?.message} />
      </Page>
    )
  }

  return (
    // Tighter top padding than other pages: the core story must fit the first screen at 1366×768.
    <Page label={route.label} className="!pt-8">
      <PageItem as="header">
        <PageHeader route={route} />
      </PageItem>

      {/* 01 — patient + estimate: the core story, on the first screen */}
      <PageItem as="section" className="mt-5">
        <SectionHeader
          index="01"
          title="Patient and estimate"
          plain="Type in a patient's test results, or load a demo patient. The estimate and its trust evidence update as you type."
          aside={
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1">
              {trustData && <BackendNote backend={trustData.backend} model={trustData.model} qubits={trustData.qubits} />}
              {trustData && <ExperimentTag id={trustData.experimentId} detail="5 seeds" />}
            </div>
          }
        />
        {/* Side by side when the content column is wide enough in rem; otherwise stacked, result first (projector, zoom). */}
        <div className="@container mt-3">
          <div className="grid grid-cols-1 gap-x-10 gap-y-10 @min-[60rem]:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
            {/* Left: the form scrolls */}
            <div data-tour="predict-form">
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => schema.data && load(schema.data.samplePatient, 'sample')} disabled={!schema.data}>
                  Load sample patient
                </Button>
                <Button variant="outline" size="sm" onClick={() => schema.data && load(schema.data.unusualPatient, 'unusual')} disabled={!schema.data}>
                  Load unusual patient
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll} disabled={!schema.data}>
                  Clear
                </Button>
                {patient && <span className="type-label ml-auto text-muted">{PATIENT_SOURCE_LABEL[patient.source]}</span>}
              </div>
              <div className="mt-3 border-t border-rule">
                {patient && schema.data?.dataset === datasetId
                  ? groups.map(([g, fs]) => (
                      <FieldGroup key={g} name={g} features={fs} input={patient.input} open={openGroups.has(g)} onToggle={() => toggle(g)} onChange={setValue} />
                    ))
                  : Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="border-b border-rule py-3">
                        <Skeleton width="100%" height="1.5rem" />
                      </div>
                    ))}
              </div>
            </div>

            {/* Right: result + trust, sticky while the form scrolls */}
            <aside className="order-first self-start @min-[60rem]:sticky @min-[60rem]:top-4 @min-[60rem]:order-none" aria-live="polite" aria-label="Estimate and trust" data-tour="predict-result">
              {predictError ? (
                <EmptyState tone="error" title="Couldn't score this patient." body={predictError.message} />
              ) : (
                <ResultBlock prediction={current} />
              )}

              {trustData && threshold !== undefined && (
                <div className="mt-3">
                  <Slider
                    label={<Term term="decision threshold">Decision threshold</Term>}
                    value={threshold}
                    min={0.01}
                    max={0.99}
                    step={0.01}
                    onChange={(v) => setPicked({ dataset: datasetId, value: Math.round(v * 100) / 100 })}
                    format={(v) => pct(v)}
                    tone="accent"
                    hint={
                      <span className="flex items-baseline justify-between gap-3">
                        <span>
                          {isDefault ? 'Default' : `Default ${pct(trustData.defaultThreshold)}`} · benchmark operating point
                          {point && ` · sensitivity ${formatPercent(point.sensitivity)}, specificity ${formatPercent(point.specificity)}`}
                        </span>
                        {!isDefault && (
                          <button type="button" onClick={() => setPicked(null)} className="type-label shrink-0 text-ink underline-offset-4 hover:underline">
                            Reset
                          </button>
                        )}
                      </span>
                    }
                  />
                </div>
              )}

              <div className="mt-3" data-tour="trust-evidence">
                <TrustList prediction={current} />
              </div>

              <p className="type-label mt-2 text-muted" data-tour="trust-stats">
                {trustData ? (
                  <>
                    <Term term="abstain">Abstained</Term>{' '}
                    <span className="num text-ink">
                      {trustData.abstained} of {trustData.testPatients} ({formatPercent(trustData.abstainRate)})
                    </span>{' '}
                    · <span className="num text-ink">{trustData.highConfidenceMisses}</span> high-confidence misses · <Term term="ece">ECE</Term>{' '}
                    <span className="num text-ink">{formatPercent(trustData.ece)}</span>
                  </>
                ) : (
                  <Skeleton width="80%" />
                )}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink to="/explain" variant="outline" size="sm">
                  Why this estimate? →
                </ButtonLink>
                <ButtonLink to="/report" variant="outline" size="sm">
                  Patient report →
                </ButtonLink>
              </div>
            </aside>
          </div>
        </div>
      </PageItem>

      {/* 02 — model trust: one chart at a time */}
      <PageItem as="section" className="mt-20">
        <SectionHeader
          index="02"
          title="Model trust"
          plain="Checks on the whole test set, not one patient: do its percentages come true, and how many sick patients does it catch at each cut-off?"
        />
        <div className="mt-6">
          <Tabs<TrustTab>
            ariaLabel="Model trust charts"
            value={tab}
            onChange={setTab}
            items={[
              {
                value: 'calibration',
                label: 'Calibration',
                panel: (
                  <ChartFigure<CalibrationBin>
                    label="Fig. 01 — Calibration · predicted vs observed"
                    subtitle={trustData?.evaluation}
                    takeaway={trustData?.calibrationTakeaway}
                    caption={
                      <>
                        Test patients are grouped by predicted risk. If the model is well <Term term="calibration">calibrated</Term>, each dot sits on the dashed
                        diagonal. The shaded band is ±1 std across the 5 <Term term="seed">seeds</Term>; bins with few patients are naturally wide.
                      </>
                    }
                    note={trustData ? `ECE ${formatPercent(trustData.ece)}` : undefined}
                    loading={!trustData}
                    height="24rem"
                    table={{ columns: calColumns, rows: trustData?.calibration, rowKey: (b) => String(b.predicted), caption: 'Calibration bins' }}
                  >
                    {trustData && <CalibrationChart bins={trustData.calibration} />}
                  </ChartFigure>
                ),
              },
              {
                value: 'threshold',
                label: 'Threshold',
                panel: (
                  <ChartFigure<ThresholdPoint>
                    label="Fig. 02 — Sensitivity and specificity by decision threshold"
                    subtitle={trustData?.evaluation}
                    takeaway={trustData && point && threshold !== undefined ? operatingSentence(threshold, point, trustData.safeSensitivity, isDefault) : undefined}
                    caption={
                      <>
                        Lowering the <Term term="decision threshold">decision threshold</Term> catches more sick patients (<Term>sensitivity</Term>) but clears
                        fewer healthy ones (<Term>specificity</Term>). The dashed vertical line is the default, the benchmark operating point behind the
                        sensitivity shown on every page; the red dashed line is the 85% safety threshold. Shaded bands are ±1 std across seeds.
                      </>
                    }
                    note={trustData && thresholdScale(trustData).domain[0] > 0 ? `Axis zoomed · ${pct(thresholdScale(trustData).domain[0])}–100%` : undefined}
                    loading={!trustData || threshold === undefined}
                    height="24rem"
                    table={{ columns: thrColumns, rows: thrRows, rowKey: (p) => String(p.threshold), caption: 'Sensitivity and specificity by threshold' }}
                  >
                    {trustData && threshold !== undefined && <ThresholdChart trust={trustData} threshold={threshold} />}
                  </ChartFigure>
                ),
              },
            ]}
          />
        </div>
      </PageItem>

      <PageItem as="footer" className="mt-20 border-t border-rule pt-5">
        <p className="type-label text-muted">Decision support · not a diagnosis</p>
      </PageItem>
    </Page>
  )
}
