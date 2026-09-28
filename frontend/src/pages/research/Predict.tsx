import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, isAbortError, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, DRAW_MS, niceScale, useChartUnits } from '@/components/charts/chartTheme'
import { endLabel } from '@/components/charts/directLabels'
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
import { Term } from '@/components/ui/Term'
import { formatPercent, formatPoints } from '@/lib/format'
import { tBase } from '@/lib/motion'
import { SAFETY_LABEL, operatingSentence, safetyStatus } from '@/lib/safety'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { PATIENT_SOURCE_LABEL, useCurrentPatient } from '@/state/patient'
import type { CalibrationBin, DatasetId, FeatureSpec, PredictResponse, RiskBand, ThresholdPoint, TrustLevel, TrustResponse } from '@/types'

const RISK_LABEL: Record<RiskBand, string> = { low: 'Low risk', moderate: 'Moderate risk', high: 'High risk' }
const RISK_BG: Record<RiskBand, string> = { low: 'bg-risk-low', moderate: 'bg-risk-mid', high: 'bg-risk-high' }
/** Risk-band edges (the mock/API's riskBand rule), drawn as gauge ticks. */
const BAND_EDGES = [0.3, 0.6]

const pm = (std: number) => `±${formatPoints(std)}`

// ─── Fig. 01 — calibration ──────────────────────────────────

type CalRow = CalibrationBin & { band: [number, number] }

function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  const reduced = useReducedMotion() ?? false
  const units = useChartUnits()
  const rows: CalRow[] = bins.map((b) => ({ ...b, band: [Math.max(0, b.observed - b.observedStd), Math.min(1, b.observed + b.observedStd)] }))
  const { ticks } = niceScale(0, 1, 5, true)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 12, right: units.rem, bottom: 8, left: 8 }}>
        <CartesianGrid stroke={C.rule} />
        <XAxis
          {...AXIS}
          type="number"
          dataKey="predicted"
          interval={0}
          domain={[0, 1]}
          ticks={ticks}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          height={units.rem * 2.75}
          label={{ value: 'Predicted risk', position: 'insideBottom', offset: 0, fill: C.muted, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
        />
        <YAxis {...AXIS} type="number" domain={[0, 1]} ticks={ticks} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} width={units.rem * 3.25} />
        <ReferenceLine
          segment={[
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]}
          stroke={C.ink}
          strokeDasharray="4 4"
          label={{ value: 'Perfect calibration', position: 'insideTopLeft', fill: C.ink, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', dy: units.rem * 2 }}
        />
        <Tooltip
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
        <Area dataKey="band" type="monotone" stroke="none" fill={C.accent} fillOpacity={0.1} isAnimationActive={false} activeDot={false} legendType="none" tooltipType="none" />
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
  const mono = { fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }
  // Lines end near 0 and 1 at the right edge, so their direct labels never collide.
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
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          height={units.rem * 2.75}
          label={{ value: 'Decision threshold', position: 'insideBottom', offset: 0, fill: C.muted, ...mono }}
        />
        <YAxis {...AXIS} type="number" domain={domain} ticks={ticks} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} width={units.rem * 3.25} />
        <ReferenceLine y={trust.safeSensitivity} stroke={C.riskHigh} strokeDasharray="4 4" label={{ value: `${Math.round(trust.safeSensitivity * 100)}% safety`, position: 'insideTopLeft', fill: C.ink, ...mono }} />
        <ReferenceLine
          x={t0}
          stroke={C.ink}
          strokeDasharray="4 4"
          label={(props: unknown) => {
            // Marker rule, written in the top margin from the line rightwards (clear of both curves on every dataset).
            const vb = (props as { viewBox?: { x: number; y: number } }).viewBox
            if (!vb) return <g />
            return (
              <text x={vb.x} y={vb.y - units.rem * 0.75} fill={C.ink} {...mono}>
                {`Default ${Math.round(t0 * 100)}%`}
                <tspan fill={C.muted}> = benchmark operating point</tspan>
              </text>
            )
          }}
        />
        {threshold !== t0 && <ReferenceLine x={threshold} stroke={C.ink} />}
        <Tooltip
          cursor={{ stroke: C.ruleStrong, strokeWidth: 1 }}
          content={({ active, payload }) => {
            const r = active ? (payload?.[0]?.payload as ThrRow | undefined) : undefined
            if (!r) return null
            return (
              <ChartTooltipCard
                title={`Threshold ${Math.round(r.threshold * 100)}%${r.threshold === t0 ? ' · default' : ''}`}
                rows={[
                  { key: 's', color: C.accent, label: 'Sensitivity', value: `${formatPercent(r.sensitivity)} ${pm(r.sensitivityStd)}` },
                  { key: 'p', color: C.accent, dashed: true, label: 'Specificity', value: `${formatPercent(r.specificity)} ${pm(r.specificityStd)}` },
                ]}
              />
            )
          }}
        />
        <Area dataKey="sensBand" type="monotone" stroke="none" fill={C.accent} fillOpacity={0.1} isAnimationActive={false} activeDot={false} legendType="none" tooltipType="none" />
        <Area dataKey="specBand" type="monotone" stroke="none" fill={C.accent} fillOpacity={0.1} isAnimationActive={false} activeDot={false} legendType="none" tooltipType="none" />
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

// ─── Result panel ───────────────────────────────────────────

function ResultPanel({ prediction, positiveLabel }: { prediction: PredictResponse | null; positiveLabel: string }) {
  if (!prediction) {
    return (
      <div className="flex flex-col gap-4" aria-hidden="true">
        <Skeleton width="100%" height="9rem" />
        <Skeleton width="60%" height="3rem" />
        <Skeleton width="80%" />
      </div>
    )
  }
  const t = Math.round(prediction.threshold * 100)
  return (
    <AnimatePresence mode="wait" initial={false}>
      {prediction.decision === 'predict' && prediction.probability !== null && prediction.riskBand ? (
        <motion.div key="predict" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tBase}>
          <div className="mx-auto max-w-[22rem]">
            <Gauge
              value={prediction.probability}
              band={prediction.riskBand}
              threshold={prediction.threshold}
              ticks={BAND_EDGES}
              label={`Estimated probability ${formatPercent(prediction.probability)}, ${RISK_LABEL[prediction.riskBand].toLowerCase()}`}
            />
            <p className="-mt-16 text-center type-metric-xl text-ink">
              <AnimatedNumber value={prediction.probability} format={(v) => formatPercent(v)} />
            </p>
          </div>
          <p className="mt-5 flex items-center justify-center gap-2.5 type-body-lg text-ink">
            <span className={`block h-3 w-3 ${RISK_BG[prediction.riskBand]}`} aria-hidden="true" />
            {RISK_LABEL[prediction.riskBand]}
          </p>
          <dl className="mt-6 border-t border-rule">
            <div className="flex items-baseline justify-between gap-4 border-b border-rule py-3 type-ui">
              <dt className="text-muted">
                Probability of {positiveLabel.toLowerCase()}
              </dt>
              <dd className="num text-ink">{formatPercent(prediction.probability)}</dd>
            </div>
            {prediction.interval && (
              <div className="flex items-baseline justify-between gap-4 border-b border-rule py-3 type-ui">
                <dt className="text-muted">
                  Spread across 5 <Term term="seed">seeds</Term>
                </dt>
                <dd className="num text-ink">
                  {formatPercent(prediction.interval[0])} – {formatPercent(prediction.interval[1])}
                </dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 border-b border-rule py-3 type-ui">
              <dt className="text-muted">
                <Term term="decision threshold">Decision threshold</Term> {t}%
              </dt>
              <dd className="text-ink">{prediction.flagged ? 'Above · flag for follow-up' : 'Below · not flagged'}</dd>
            </div>
          </dl>
        </motion.div>
      ) : (
        <motion.div key="abstain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={tBase}>
          <p className="type-label text-muted">
            Decision · <Term term="abstain">abstain</Term>
          </p>
          <p className="mt-3 type-h2 text-ink">Not enough evidence to decide.</p>
          <p className="measure mt-4 type-body text-muted">The model declines to give a number rather than guess. Here is why:</p>
          <ul className="mt-4 border-t border-rule">
            {prediction.abstainReasons.map((r) => (
              <li key={r} className="border-b border-rule py-3 type-ui text-ink">
                <Glossed text={r} />
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Trust evidence ─────────────────────────────────────────

function TrustEvidence({ prediction }: { prediction: PredictResponse | null }) {
  if (!prediction) return <Skeleton width="100%" height="18rem" />
  const counts = (['strong', 'partial', 'weak'] as TrustLevel[]).map((l) => [l, prediction.trust.filter((s) => s.level === l).length] as const)
  return (
    <>
      <p className="num type-label text-muted">{counts.map(([l, n]) => `${n} ${TRUST_LABEL[l].toLowerCase()}`).join(' · ')}</p>
      <ul className="mt-4 border-t border-rule">
        {prediction.trust.map((s) => (
          <li key={s.id} className="grid grid-cols-12 items-baseline gap-x-6 gap-y-1 border-b border-rule py-4">
            <span className="col-span-12 flex items-center gap-3 type-ui text-ink md:col-span-4">
              <StatusMark level={s.level} />
              <span>
                <Glossed text={s.label} skip={['sensitivity']} />
              </span>
            </span>
            <span className="type-label col-span-12 text-muted md:col-span-2">{TRUST_LABEL[s.level]}</span>
            <span className="col-span-12 type-ui text-ink md:col-span-6">
              <Glossed text={s.reason} />
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

// ─── Page ───────────────────────────────────────────────────

interface Request {
  dataset: DatasetId
  input: Record<string, number | null>
  threshold: number
}

export function Predict({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const trust = useResource((signal) => api.getTrust(datasetId, { signal }), [datasetId, version])
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const config = datasets.data?.find((d) => d.id === datasetId)
  const { patient, setPatient } = useCurrentPatient(datasetId, schema.data)
  const trustData = trust.data?.dataset === datasetId ? trust.data : undefined

  // Threshold: the default operating point until the user moves the slider (per dataset).
  const [picked, setPicked] = useState<{ dataset: DatasetId; value: number } | null>(null)
  const threshold = picked?.dataset === datasetId ? picked.value : trustData?.defaultThreshold

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

  const setValue = (key: string, value: number | null) => patient && setPatient({ input: { ...patient.input, [key]: value }, source: 'entered' })
  const clearAll = () => schema.data && setPatient({ input: Object.fromEntries(schema.data.features.map((f) => [f.key, null])), source: 'entered' })

  // Live operating point at the chosen threshold.
  const point = trustData && threshold !== undefined ? trustData.thresholdCurve.find((p) => p.threshold === threshold) : undefined
  const isDefault = threshold === trustData?.defaultThreshold

  const calColumns: Column<CalibrationBin>[] = [
    { key: 'p', header: 'Predicted', mono: true, render: (b) => formatPercent(b.predicted) },
    { key: 'o', header: 'Observed', align: 'right', mono: true, render: (b) => `${formatPercent(b.observed)} ${pm(b.observedStd)}` },
    { key: 'n', header: 'Test patients', align: 'right', mono: true, render: (b) => String(b.count) },
  ]
  const thrColumns: Column<ThresholdPoint>[] = [
    { key: 't', header: 'Threshold', mono: true, render: (p) => `${Math.round(p.threshold * 100)}%${p.threshold === trustData?.defaultThreshold ? ' · default' : ''}` },
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
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route}>
          <div className="mt-6">{trustData && <ExperimentTag id={trustData.experimentId} detail="QSVM · 5 seeds" />}</div>
        </PageHeader>
      </PageItem>

      {/* 01 — patient + estimate */}
      <PageItem as="section" className="mt-20">
        <SectionHeader
          index="01"
          title="Patient and estimate"
          plain="Type in a patient's test results, or load a demo patient. The estimate updates as you type."
          aside={patient && <span className="type-label text-muted">{PATIENT_SOURCE_LABEL[patient.source]}</span>}
        />
        <div className="grid-12 mt-8 gap-y-12">
          <div className="col-span-12 xl:col-span-7" data-tour="predict-form">
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={() => schema.data && setPatient({ input: schema.data.samplePatient, source: 'sample' })} disabled={!schema.data}>
                Load sample patient
              </Button>
              <Button variant="outline" size="sm" onClick={() => schema.data && setPatient({ input: schema.data.unusualPatient, source: 'unusual' })} disabled={!schema.data}>
                Load unusual patient
              </Button>
              <Button variant="ghost" size="sm" onClick={clearAll} disabled={!schema.data}>
                Clear all
              </Button>
            </div>
            {patient && schema.data?.dataset === datasetId ? (
              groups.map(([group, fs]) => (
                <fieldset key={group} className="mt-10">
                  <legend className="type-label mb-4 text-ink">{group}</legend>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                    {fs.map((f) => (
                      <FeatureField key={f.key} feature={f} value={patient.input[f.key] ?? null} onChange={(v) => setValue(f.key, v)} />
                    ))}
                  </div>
                </fieldset>
              ))
            ) : (
              <div className="mt-10 grid grid-cols-2 gap-8" aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} width="100%" height="3.5rem" />
                ))}
              </div>
            )}
          </div>

          <aside className="col-span-12 xl:col-span-5" aria-live="polite" aria-label="Estimate" data-tour="predict-result">
            <div className="xl:sticky xl:top-8">
              <p className="type-label text-muted">Estimate · {current?.evaluation ?? 'loading'}</p>
              <div className="mt-6">
                {predictError ? (
                  <EmptyState tone="error" title="Couldn't score this patient." body={predictError.message} />
                ) : (
                  <ResultPanel prediction={current} positiveLabel={config?.classBalance.positiveLabel ?? 'disease'} />
                )}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <ButtonLink to="/explain" variant="outline" size="sm">
                  Why this estimate? →
                </ButtonLink>
                <ButtonLink to="/report" variant="outline" size="sm">
                  Patient report →
                </ButtonLink>
              </div>
            </div>
          </aside>
        </div>
      </PageItem>

      {/* 02 — trust evidence */}
      <PageItem as="section" className="mt-24" >
        <SectionHeader
          index="02"
          title="Trust evidence"
          plain="Six checks on this one estimate: would it change with a different random start, with small measurement errors, or on a real quantum chip, and does this patient look like the people the model learned from?"
        />
        <div className="mt-8" data-tour="trust-evidence">
          <TrustEvidence prediction={current} />
          <p className="measure mt-4 type-small text-muted">
            A filled square is strong evidence, half-filled is partial, empty is weak. Outside the training range every check is weak and the model{' '}
            <Term term="abstain">abstains</Term>.
          </p>
        </div>
      </PageItem>

      {/* 03 — model-level trust */}
      <PageItem as="section" className="mt-24">
        <SectionHeader
          index="03"
          title="Is the model trustworthy overall?"
          plain="Checks on the whole test set, not one patient: do its percentages come true, and how many sick patients does it catch at each cut-off?"
        />
        <dl className="mt-8 grid grid-cols-1 border-t border-rule md:grid-cols-3">
          {[
            {
              k: 'a',
              label: (
                <>
                  Test patients <Term term="abstain">abstained</Term> on
                </>
              ),
              value: trustData ? formatPercent(trustData.abstainRate) : null,
              note: trustData ? `${trustData.abstained} of ${trustData.testPatients}` : '',
            },
            { k: 'm', label: 'High-confidence misses', value: trustData ? String(trustData.highConfidenceMisses) : null, note: 'Wrong answers given with high confidence' },
            {
              k: 'e',
              label: <Term term="ece">ECE</Term>,
              value: trustData ? formatPercent(trustData.ece) : null,
              note: 'Average gap between predicted and observed',
            },
          ].map((m) => (
            <div key={m.k} className="border-b border-rule py-5 md:border-b-0 md:border-r md:px-6 md:first:pl-0 md:last:border-r-0">
              <dt className="type-label text-muted">{m.label}</dt>
              <dd className="mt-2 type-metric text-ink">{m.value ?? <Skeleton width="5rem" height="2rem" />}</dd>
              <dd className="mt-1 type-small text-muted">{m.note}</dd>
            </div>
          ))}
        </dl>

        <div className="grid-12 mt-14 gap-y-16">
          <div className="col-span-12 xl:col-span-6" data-tour="calibration">
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
              legend={[
                { key: 'o', label: 'Observed rate · QSVM', color: C.accent, shape: 'line' },
                { key: 'd', label: 'Perfect calibration', color: C.ink, dashed: true },
              ]}
              note={trustData ? `ECE ${formatPercent(trustData.ece)}` : undefined}
              loading={!trustData}
              height="22rem"
              table={{ columns: calColumns, rows: trustData?.calibration, rowKey: (b) => String(b.predicted), caption: 'Calibration bins' }}
            >
              {trustData && <CalibrationChart bins={trustData.calibration} />}
            </ChartFigure>
          </div>

          <div className="col-span-12 xl:col-span-6" data-tour="threshold">
            <ChartFigure<ThresholdPoint>
              label="Fig. 02 — Sensitivity and specificity by decision threshold"
              subtitle={trustData?.evaluation}
              takeaway={trustData && point && threshold !== undefined ? operatingSentence(threshold, point, trustData.safeSensitivity, isDefault) : undefined}
              caption={
                <>
                  Lowering the <Term term="decision threshold">decision threshold</Term> catches more sick patients (
                  <Term>sensitivity</Term>) but clears fewer healthy ones (<Term>specificity</Term>). The dashed line marks the default: the benchmark
                  operating point behind the sensitivity shown on every page. Bands are ±1 std across seeds.
                </>
              }
              legend={[
                { key: 's', label: 'Sensitivity · QSVM', color: C.accent },
                { key: 'p', label: 'Specificity · QSVM', color: C.accent, dashed: true },
                { key: 'f', label: 'Safety threshold', color: C.riskHigh, dashed: true },
              ]}
              note={trustData && thresholdScale(trustData).domain[0] > 0 ? `Axis zoomed · ${Math.round(thresholdScale(trustData).domain[0] * 100)}–100%` : undefined}
              loading={!trustData || threshold === undefined}
              height="22rem"
              table={{ columns: thrColumns, rows: thrRows, rowKey: (p) => String(p.threshold), caption: 'Sensitivity and specificity by threshold' }}
            >
              {trustData && threshold !== undefined && <ThresholdChart trust={trustData} threshold={threshold} />}
            </ChartFigure>

            {trustData && threshold !== undefined && (
              <div className="mt-8">
                <Slider
                  label={<Term term="decision threshold">Decision threshold</Term>}
                  value={threshold}
                  min={0.01}
                  max={0.99}
                  step={0.01}
                  onChange={(v) => setPicked({ dataset: datasetId, value: Math.round(v * 100) / 100 })}
                  format={(v) => `${Math.round(v * 100)}%${v === trustData.defaultThreshold ? ' · default' : ''}`}
                  tone="accent"
                  hint="Moving it also re-scores the patient above."
                />
                {point && (
                  <div className="mt-6 grid grid-cols-3 gap-6 border-t border-rule pt-5">
                    <div>
                      <p className="type-label text-muted">
                        <Term>Sensitivity</Term>
                      </p>
                      <p className="mt-2 type-metric text-ink">
                        <AnimatedNumber value={point.sensitivity} format={(v) => formatPercent(v)} from={point.sensitivity} />
                      </p>
                      <p className="num type-small text-muted">{pm(point.sensitivityStd)}</p>
                    </div>
                    <div>
                      <p className="type-label text-muted">
                        <Term>Specificity</Term>
                      </p>
                      <p className="mt-2 type-metric text-ink">
                        <AnimatedNumber value={point.specificity} format={(v) => formatPercent(v)} from={point.specificity} />
                      </p>
                      <p className="num type-small text-muted">{pm(point.specificityStd)}</p>
                    </div>
                    <div>
                      <p className="type-label text-muted">
                        vs <Term term="threshold">safety</Term>
                      </p>
                      <p className="mt-3 type-ui text-ink">{SAFETY_LABEL[safetyStatus(point.sensitivity, point.sensitivityStd, trustData.safeSensitivity)]}</p>
                    </div>
                  </div>
                )}
                <div className="mt-6">
                  <Button variant="outline" size="sm" onClick={() => setPicked(null)} disabled={isDefault}>
                    Reset to default
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PageItem>

      <PageItem as="footer" className="mt-24 border-t border-rule pt-5">
        <p className="type-label text-muted">Decision support · not a diagnosis</p>
      </PageItem>
    </Page>
  )
}
