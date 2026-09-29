import { useReducedMotion } from 'motion/react'
import type { ReactElement, ReactNode } from 'react'
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, DRAW_MS, TICK, familyColor, niceScale, useChartUnits } from '@/components/charts/chartTheme'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { Glossed } from '@/components/ui/Glossed'
import { HairlineTable, type Column } from '@/components/ui/HairlineTable'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Term } from '@/components/ui/Term'
import { useExperimentDrawer } from '@/features/experiments/ExperimentDrawer'
import { MODEL_ORDER, MODELS } from '@/lib/domain'
import { durationColumn, formatAuc, formatMs, formatPercent, formatStd } from '@/lib/format'
import { useElementSize } from '@/lib/useElementSize'
import { resolveLabelOffsets } from '@/components/charts/directLabels'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import type { CompareResponse, ComparisonRow, MeanStd, MetricKey, ModelId, ResourcePoint, SeedPoint } from '@/types'

// ─── Results table ──────────────────────────────────────────

interface MetricSpec {
  key: MetricKey
  header: ReactNode
  better: 'high' | 'low'
  /** `time` formats a duration with the unit chosen for the whole column. */
  format: (m: MeanStd, time: (s: number) => string) => [string, string]
}

const pct = (m: MeanStd): [string, string] => [formatPercent(m.mean), `±${(m.std * 100).toFixed(1)}`]

const METRICS: MetricSpec[] = [
  { key: 'accuracy', header: 'Accuracy', better: 'high', format: pct },
  { key: 'sensitivity', header: <Term>Sensitivity</Term>, better: 'high', format: pct },
  { key: 'specificity', header: <Term>Specificity</Term>, better: 'high', format: pct },
  { key: 'auc', header: <Term term="auc">ROC-AUC</Term>, better: 'high', format: (m) => [formatAuc(m.mean), formatStd(m.std)] },
  { key: 'trainTimeS', header: 'Train time', better: 'low', format: (m, time) => [time(m.mean), `±${time(m.std)}`] },
  { key: 'inferenceMs', header: 'Inference', better: 'low', format: (m) => [formatMs(m.mean), `±${formatMs(m.std)}`] },
]

function bestByMetric(rows: ComparisonRow[]): Record<MetricKey, number> {
  const out = {} as Record<MetricKey, number>
  for (const m of METRICS) {
    const values = rows.map((r) => r.metrics[m.key].mean)
    out[m.key] = m.better === 'high' ? Math.max(...values) : Math.min(...values)
  }
  return out
}

function ModelCell({ row }: { row: ComparisonRow }) {
  const info = MODELS[row.model]
  return (
    <span className="flex items-center gap-2.5">
      <span className={`block h-[8px] w-[8px] shrink-0 ${row.family === 'quantum' ? 'bg-accent' : 'bg-classical'}`} aria-hidden="true" />
      <span className="text-ink">{row.model === 'vqc' || row.model === 'qsvm' ? <Term term={row.model}>{info.name}</Term> : info.name}</span>
      {row.qubits && <span className="num type-small text-muted">{row.qubits}q</span>}
    </span>
  )
}

function ResultsTable({ data }: { data: CompareResponse | undefined }) {
  const { openExperiment } = useExperimentDrawer()
  const best = data ? bestByMetric(data.rows) : null
  // One unit for the whole train-time column.
  const time = durationColumn(data?.rows.map((r) => r.metrics.trainTimeS.mean) ?? [])
  const columns: Column<ComparisonRow>[] = [
    { key: 'model', header: 'Model', width: '19%', render: (r) => <ModelCell row={r} /> },
    ...METRICS.map<Column<ComparisonRow>>((m) => ({
      key: m.key,
      header: m.header,
      align: 'right',
      mono: true,
      render: (r) => {
        const [mean, std] = m.format(r.metrics[m.key], time)
        const isBest = best !== null && r.metrics[m.key].mean === best[m.key]
        return (
          // Mean and spread sit on one line when there's room and stack when there isn't.
          <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5">
            <span className={`whitespace-nowrap ${isBest ? 'text-accent' : 'text-ink'}`}>{mean}</span>
            <span className="whitespace-nowrap type-small text-muted">{std}</span>
            {isBest && <span className="sr-only"> (best)</span>}
          </span>
        )
      },
    })),
  ]
  return (
    <div className="overflow-x-auto">
      <HairlineTable
        caption="Model comparison, mean ± standard deviation over 5 seeds"
        columns={columns}
        rows={data?.rows}
        loading={!data}
        skeletonRows={6}
        rowKey={(r) => r.model}
        onRowClick={(r) => openExperiment(r.experimentId)}
        rowLabel={(r) => `Open experiment ${r.experimentId} for ${MODELS[r.model].name}`}
      />
    </div>
  )
}

// ─── Performance vs quantum resources ───────────────────────

interface ResourceDatum extends ResourcePoint {
  size: number
}

const shapeSquare = (props: unknown): ReactElement => {
  const { cx, cy } = props as { cx: number; cy: number }
  return <rect x={cx - 5} y={cy - 5} width={10} height={10} fill={C.accent} stroke={C.bg} strokeWidth={2} />
}
const shapeCircle = (props: unknown): ReactElement => {
  const { cx, cy } = props as { cx: number; cy: number }
  return <circle cx={cx} cy={cy} r={5.5} fill={C.accent} stroke={C.bg} strokeWidth={2} />
}

const SCATTER_MARGIN_TOP = 16
const SCATTER_X_AXIS = 44

function ResourceScatter({ data }: { data: CompareResponse }) {
  const reduced = useReducedMotion() ?? false
  const { labelGutter, labelGap } = useChartUnits()
  const [ref, size] = useElementSize<HTMLDivElement>()
  const points: ResourceDatum[] = data.resources.map((p) => ({ ...p, size: p.qubits * p.circuitDepth }))
  const aucs = [...points.map((p) => p.auc), ...data.baselines.map((b) => b.auc)]
  const { domain, ticks } = niceScale(Math.min(...aucs) - 0.002, Math.max(...aucs) + 0.002, 5)
  // Baselines can sit a few thousandths apart (WDBC): space their labels so none overlap.
  const offsets = resolveLabelOffsets(
    data.baselines.map((b) => ({ key: b.model, value: b.auc })),
    domain,
    size.height - SCATTER_MARGIN_TOP - 8 - SCATTER_X_AXIS,
    labelGap,
  )
  const baselineLabel = (model: ModelId, text: string) =>
    function BaselineLabel(raw: unknown): ReactElement {
      const vb = (raw as { viewBox?: { x: number; y: number; width: number } }).viewBox
      if (!vb) return <g />
      return (
        <text x={vb.x + vb.width + 8} y={vb.y + (offsets[model] ?? 0)} dy="0.35em" fill={C.ink} fontFamily="var(--font-mono)" fontSize="0.8125rem">
          {text}
        </text>
      )
    }

  return (
    <div ref={ref} className="h-full w-full">
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: SCATTER_MARGIN_TOP, right: labelGutter + 8, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} stroke={C.rule} />
        <XAxis
          {...AXIS}
          type="number"
          dataKey="size"
          domain={[0, 36]}
          ticks={[4, 8, 12, 16, 20, 24, 28, 32]}
          height={SCATTER_X_AXIS}
          label={{ value: 'Quantum resources · qubits × circuit layers', position: 'insideBottom', offset: -2, fill: C.muted, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
        />
        <YAxis {...AXIS} type="number" dataKey="auc" domain={domain} ticks={ticks} tickFormatter={(v: number) => v.toFixed(3)} width={64} />
        <Tooltip
          cursor={{ stroke: C.ruleStrong, strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as ResourceDatum | undefined) : undefined
            if (!p) return null
            return (
              <ChartTooltipCard
                title={`${MODELS[p.model].name} · ${p.id}`}
                rows={[
                  { key: 'q', label: 'Qubits', value: p.qubits },
                  { key: 'd', label: 'Circuit layers', value: p.circuitDepth },
                  { key: 'a', label: 'AUC', value: formatAuc(p.auc) },
                ]}
              />
            )
          }}
        />
        {data.baselines.map((b) => (
          <ReferenceLine
            key={b.model}
            y={b.auc}
            stroke={C.classical}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            label={baselineLabel(b.model, `${MODELS[b.model].name} ${formatAuc(b.auc)}`)}
          />
        ))}
        <Scatter name="VQC" data={points.filter((p) => p.model === 'vqc')} shape={shapeCircle} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
        <Scatter name="QSVM" data={points.filter((p) => p.model === 'qsvm')} shape={shapeSquare} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
      </ScatterChart>
    </ResponsiveContainer>
    </div>
  )
}

// ─── Seed stability strip plot ──────────────────────────────

interface StripDatum extends SeedPoint {
  /** Row index + a small deterministic jitter so overlapping seeds stay visible. */
  y: number
  family: 'quantum' | 'classical'
}

/** Seeds 1–5 spread symmetrically around the row: −0.2, −0.1, 0, +0.1, +0.2. */
const seedJitter = (seed: number) => (seed - 3) * 0.1

function StabilityStrip({ data }: { data: CompareResponse }) {
  const reduced = useReducedMotion() ?? false
  const rowOf = (m: ModelId) => data.rows.find((r) => r.model === m)
  const label = (m: ModelId) => {
    const r = rowOf(m)
    return r ? `${MODELS[m].name}  ${formatAuc(r.metrics.auc.mean)} ${formatStd(r.metrics.auc.std)}` : MODELS[m].name
  }
  const rowIndex = (m: ModelId) => MODEL_ORDER.indexOf(m)
  const points: StripDatum[] = data.stability.map((s) => ({ ...s, y: rowIndex(s.model) + seedJitter(s.seed), family: MODELS[s.model].family }))
  const means = MODEL_ORDER.map((m) => ({ model: m, y: rowIndex(m), auc: rowOf(m)?.metrics.auc.mean ?? 0 }))
  const aucs = points.map((p) => p.auc)
  const { domain, ticks } = niceScale(Math.min(...aucs) - 0.002, Math.max(...aucs) + 0.002, 6)

  const dot = (fill: string) =>
    function Dot(props: unknown): ReactElement {
      const { cx, cy } = props as { cx: number; cy: number }
      return <circle cx={cx} cy={cy} r={5} fill={fill} stroke={C.bg} strokeWidth={1.5} />
    }
  const meanTick = (props: unknown): ReactElement => {
    const { cx, cy } = props as { cx: number; cy: number }
    return <line x1={cx} x2={cx} y1={cy - 14} y2={cy + 14} stroke={C.ink} strokeWidth={2} />
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid horizontal={false} stroke={C.rule} />
        <XAxis {...AXIS} type="number" dataKey="auc" domain={domain} ticks={ticks} tickFormatter={(v: number) => v.toFixed(3)} height={36} />
        <YAxis
          {...AXIS}
          type="number"
          dataKey="y"
          domain={[-0.5, MODEL_ORDER.length - 0.5]}
          ticks={MODEL_ORDER.map((_, i) => i)}
          reversed
          tickFormatter={(i: number) => label(MODEL_ORDER[i])}
          width={236}
          axisLine={false}
          tick={{ ...TICK, fill: C.ink }}
        />
        <Tooltip
          cursor={false}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as Partial<StripDatum> | undefined) : undefined
            if (!p || p.seed === undefined || !p.model || p.auc === undefined) return null
            return (
              <ChartTooltipCard
                title={`${MODELS[p.model].name} · seed ${p.seed}`}
                rows={[{ key: 'auc', color: familyColor(MODELS[p.model].family), label: 'AUC', value: formatAuc(p.auc) }]}
              />
            )
          }}
        />
        <Scatter data={points.filter((p) => p.family === 'classical')} shape={dot(C.classical)} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
        <Scatter data={points.filter((p) => p.family === 'quantum')} shape={dot(C.accent)} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
        <Scatter data={means} shape={meanTick} isAnimationActive={false} />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

// ─── Page ───────────────────────────────────────────────────

export function Advantage({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const compare = useResource((signal) => api.compare(datasetId, { signal }), [datasetId])
  const data = compare.data

  const resourceColumns: Column<ResourcePoint>[] = [
    { key: 'id', header: 'Config', mono: true, render: (p) => p.id },
    { key: 'model', header: 'Model', render: (p) => MODELS[p.model].name },
    { key: 'q', header: 'Qubits', align: 'right', mono: true, render: (p) => p.qubits },
    { key: 'd', header: 'Layers', align: 'right', mono: true, render: (p) => p.circuitDepth },
    { key: 'auc', header: 'AUC', align: 'right', mono: true, render: (p) => formatAuc(p.auc) },
  ]
  const stripColumns: Column<SeedPoint>[] = [
    { key: 'model', header: 'Model', render: (s) => MODELS[s.model].name },
    { key: 'seed', header: 'Seed', align: 'right', mono: true, render: (s) => s.seed },
    { key: 'auc', header: 'AUC', align: 'right', mono: true, render: (s) => formatAuc(s.auc) },
  ]

  if (compare.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn't load the benchmark." body={compare.error.message} />
      </Page>
    )
  }

  const best = data ? bestByMetric(data.rows) : null

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route} source={data?.source}>
          <div className="mt-6">{data && <ExperimentTag id={data.experimentId} detail={`${data.seeds} seeds`} />}</div>
        </PageHeader>
      </PageItem>

      <PageItem as="section" className="mt-20">
        <SectionHeader
          index="01"
          title="Results · mean ± std over 5 seeds"
          plain="Every model was trained five times with different random starts on the same patients. Each cell is the average, with the typical wobble after it. Blue marks the best in each column."
        />
        <p className="measure mt-5 type-body-lg text-ink">
          {data ? <Glossed text={data.takeaway} /> : ' '}
        </p>
        <div className="mt-6">
          <ResultsTable data={data} />
        </div>
        {best && (
          <p className="measure mt-4 type-small text-muted">
            Times are per training run and per patient prediction. Quantum times are simulated on a CPU; click a row for its full
            experiment record.
          </p>
        )}
      </PageItem>

      <PageItem as="section" className="mt-24">
        <SectionHeader
          index="02"
          title="Performance vs quantum resources"
          plain="Each blue shape is one quantum circuit design. Moving right means a bigger, more expensive circuit. The dashed grey lines are the scores of normal models; a quantum design only helps if it sits above them."
        />
        <div className="mt-8">
          <ChartFigure<ResourcePoint>
            label="Fig. 01 — AUC vs circuit size"
            subtitle={data?.evaluation}
            takeaway={data?.resourcesTakeaway}
            legend={[
              { key: 'vqc', label: 'VQC designs', color: C.accent, shape: 'dot' },
              { key: 'qsvm', label: 'QSVM designs', color: C.accent, shape: 'square' },
              { key: 'base', label: 'Classical baselines', color: C.classical, dashed: true },
            ]}
            loading={!data}
            height="26rem"
            table={{ columns: resourceColumns, rows: data?.resources, rowKey: (p) => p.id, caption: 'Quantum configurations and their AUC' }}
          >
            {data && <ResourceScatter data={data} />}
          </ChartFigure>
        </div>
      </PageItem>

      <PageItem as="section" className="mt-24">
        <SectionHeader
          index="03"
          title="Stability across seeds"
          plain="Each dot is one of the five runs of a model. Dots bunched together mean the result is reliable; spread-out dots mean it depends on luck."
        />
        <div className="mt-8">
          <ChartFigure<SeedPoint>
            label="Fig. 02 — AUC per seed"
            subtitle={data?.evaluation}
            takeaway={data?.stabilityTakeaway}
            caption="Each dot is one seed; dots are nudged up or down so identical scores never hide each other."
            legend={[
              { key: 'q', label: 'Quantum seed', color: C.accent, shape: 'dot' },
              { key: 'c', label: 'Classical seed', color: C.classical, shape: 'dot' },
              { key: 'm', label: 'Mean', color: C.ink },
            ]}
            loading={!data}
            height="24rem"
            table={{ columns: stripColumns, rows: data?.stability, rowKey: (s) => `${s.model}-${s.seed}`, caption: 'AUC for each model and seed' }}
          >
            {data && <StabilityStrip data={data} />}
          </ChartFigure>
        </div>
      </PageItem>
    </Page>
  )
}
