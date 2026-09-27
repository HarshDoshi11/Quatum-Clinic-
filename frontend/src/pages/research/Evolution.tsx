import { useReducedMotion } from 'motion/react'
import type { ReactElement } from 'react'
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, DRAW_MS, niceScale } from '@/components/charts/chartTheme'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { HairlineTable, type Column } from '@/components/ui/HairlineTable'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Term } from '@/components/ui/Term'
import { useExperimentDrawer } from '@/features/experiments/ExperimentDrawer'
import { MODELS } from '@/lib/domain'
import { durationColumn, formatAuc, formatStd } from '@/lib/format'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import type { Ansatz, CircuitConfig, EvolutionSweep } from '@/types'

const ANSATZ_LABEL: Record<Ansatz, string> = {
  'strongly-entangling': 'StronglyEntangling',
  'real-amplitudes': 'RealAmplitudes',
  'zz-kernel': 'ZZ kernel',
}
const ENTANGLEMENT_LABEL: Record<CircuitConfig['entanglement'], string> = { linear: 'Linear', circular: 'Circular', full: 'Full' }

/** Maximum horizontal offset from a depth tick, in depth units. */
const JITTER = 0.12

interface Datum extends CircuitConfig {
  x: number
}

/**
 * Deterministic, symmetric jitter: designs sharing a depth are spread evenly
 * across [−0.12, +0.12] around the tick, in a fixed order (qubits, encoding, ID).
 */
function withJitter(configs: CircuitConfig[]): Datum[] {
  const groups = new Map<number, CircuitConfig[]>()
  for (const c of configs) groups.set(c.circuitDepth, [...(groups.get(c.circuitDepth) ?? []), c])
  const out: Datum[] = []
  for (const [depth, group] of groups) {
    const ordered = [...group].sort((a, b) => a.qubits - b.qubits || a.encoding.localeCompare(b.encoding) || a.id.localeCompare(b.id))
    ordered.forEach((c, i) => {
      const offset = ordered.length === 1 ? 0 : -JITTER + (2 * JITTER * i) / (ordered.length - 1)
      out.push({ ...c, x: depth + offset })
    })
  }
  return out
}

function DesignScatter({ sweep }: { sweep: EvolutionSweep }) {
  const reduced = useReducedMotion() ?? false
  const { openExperiment } = useExperimentDrawer()
  const data = withJitter(sweep.configs)
  const front = data.filter((d) => d.pareto).sort((a, b) => a.x - b.x)
  const rec = data.find((d) => d.id === sweep.recommendedId)
  const { ticks } = niceScale(sweep.aucRange[0], sweep.aucRange[1], 4)
  const domain: [number, number] = [sweep.aucRange[0], sweep.aucRange[1]]

  const dominated = (props: unknown): ReactElement => {
    const { cx, cy } = props as { cx: number; cy: number }
    return <circle cx={cx} cy={cy} r={5} fill={C.bg} stroke={C.muted} strokeWidth={1.5} style={{ cursor: 'pointer' }} />
  }
  const optimal = (props: unknown): ReactElement => {
    const { cx, cy } = props as { cx: number; cy: number }
    return <circle cx={cx} cy={cy} r={6} fill={C.accent} stroke={C.bg} strokeWidth={2} style={{ cursor: 'pointer' }} />
  }
  const recommended = (props: unknown): ReactElement => {
    const { cx, cy, payload } = props as { cx: number; cy: number; payload: Datum }
    return (
      <g style={{ cursor: 'pointer' }}>
        <circle cx={cx} cy={cy} r={12} fill="none" stroke={C.ink} strokeWidth={1.5} />
        <text x={cx} y={cy - 40} textAnchor="middle" fill={C.ink} fontFamily="var(--font-mono)" fontSize="0.8125rem">
          {payload.id} · RECOMMENDED
        </text>
        <text x={cx} y={cy - 22} textAnchor="middle" fill={C.muted} fontFamily="var(--font-mono)" fontSize="0.8125rem">
          KNEE POINT: BEST AUC PER LAYER
        </text>
      </g>
    )
  }
  const open = (raw: unknown) => {
    const d = (raw as { payload?: Datum }).payload
    if (d?.experimentId) openExperiment(d.experimentId)
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart margin={{ top: 56, right: 32, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} stroke={C.rule} />
        <XAxis
          {...AXIS}
          type="number"
          dataKey="x"
          domain={[0.6, 4.4]}
          ticks={[1, 2, 3, 4]}
          tickFormatter={(v: number) => `depth ${v}`}
          height={44}
          label={{ value: 'Circuit depth (layers) · more layers = more complex', position: 'insideBottom', offset: -2, fill: C.muted, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
        />
        <YAxis {...AXIS} type="number" dataKey="auc" domain={domain} ticks={ticks} tickFormatter={(v: number) => v.toFixed(3)} width={64} allowDataOverflow />
        <Tooltip
          cursor={false}
          content={({ active, payload }) => {
            const d = active ? (payload?.[0]?.payload as Datum | undefined) : undefined
            if (!d || d.id === undefined) return null
            return (
              <ChartTooltipCard
                title={`${d.id}${d.id === sweep.recommendedId ? ' · recommended' : d.pareto ? ' · Pareto-optimal' : ' · dominated'}`}
                rows={[
                  { key: 'q', label: 'Qubits', value: d.qubits },
                  { key: 'e', label: 'Encoding', value: d.encoding === 'angle' ? 'Angle' : 'Amplitude' },
                  { key: 'n', label: 'Entanglement', value: `${ENTANGLEMENT_LABEL[d.entanglement]} · ${ANSATZ_LABEL[d.ansatz]}` },
                  { key: 'd', label: 'Depth', value: d.circuitDepth },
                  { key: 'p', label: 'Parameters', value: d.parameters },
                  { key: 'a', label: 'AUC', value: `${formatAuc(d.auc)} ${formatStd(d.aucStd)}` },
                  { key: 'c', label: 'Click', value: 'open experiment' },
                ]}
              />
            )
          }}
        />
        {/* Depth is discrete, so the front is a step line. */}
        <Line data={front} dataKey="auc" type="stepAfter" stroke={C.accent} strokeWidth={2} dot={false} activeDot={false} isAnimationActive={!reduced} animationDuration={DRAW_MS} legendType="none" />
        <Scatter data={data.filter((d) => !d.pareto)} shape={dominated} onClick={open} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
        <Scatter data={front} shape={optimal} onClick={open} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
        {rec && <Scatter data={[rec]} shape={recommended} onClick={open} isAnimationActive={false} />}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function Evolution({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { openExperiment } = useExperimentDrawer()
  const sweep = useResource((signal) => api.getSweep('evolution', datasetId, { signal }), [datasetId])
  const data = sweep.data
  const sorted = data ? [...data.configs].sort((a, b) => b.auc - a.auc) : undefined
  const trainFmt = durationColumn(data?.configs.map((c) => c.trainTimeS) ?? [])

  const columns: Column<CircuitConfig>[] = [
    {
      key: 'id',
      header: 'Design',
      mono: true,
      render: (c) => (
        <span className="flex items-center gap-2">
          <span className={`block h-[9px] w-[9px] rounded-full ${c.pareto ? 'bg-accent' : 'border-[1.5px] border-muted'}`} aria-hidden="true" />
          <span className="text-ink">{c.id}</span>
          {c.id === data?.recommendedId && <span className="type-label rounded-[2px] border border-ink px-1.5 text-ink">Recommended</span>}
        </span>
      ),
    },
    { key: 'enc', header: <Term term="encoding">Encoding</Term>, render: (c) => (c.encoding === 'angle' ? 'Angle' : 'Amplitude') },
    { key: 'q', header: <Term term="qubit">Qubits</Term>, align: 'right', mono: true, render: (c) => c.qubits },
    { key: 'd', header: <Term term="circuit depth">Depth</Term>, align: 'right', mono: true, render: (c) => c.circuitDepth },
    { key: 'ent', header: 'Entanglement · ansatz', render: (c) => `${ENTANGLEMENT_LABEL[c.entanglement]} · ${ANSATZ_LABEL[c.ansatz]}` },
    { key: 'p', header: 'Parameters', align: 'right', mono: true, render: (c) => c.parameters },
    { key: 't', header: 'Train time', align: 'right', mono: true, render: (c) => trainFmt(c.trainTimeS) },
    {
      key: 'auc',
      header: <Term>AUC</Term>,
      align: 'right',
      mono: true,
      render: (c) => (
        <span className="whitespace-nowrap">
          <span className={c.id === sorted?.[0]?.id ? 'text-accent' : 'text-ink'}>{formatAuc(c.auc)}</span>
          <span className="ml-1.5 type-small text-muted">{formatStd(c.aucStd)}</span>
        </span>
      ),
    },
    { key: 'pf', header: <Term term="pareto front">Pareto</Term>, align: 'right', render: (c) => (c.pareto ? <span className="type-label text-ink">Yes</span> : <span className="text-muted">—</span>) },
  ]

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route}>
          <div className="mt-6">{data && <ExperimentTag id={data.experimentId} detail={`${data.configs.length} designs · ${MODELS[data.model].name}`} />}</div>
        </PageHeader>
      </PageItem>

      <PageItem as="section" className="mt-20">
        <SectionHeader
          index="01"
          title="Accuracy vs circuit depth"
          plain="Each dot is one circuit design. Higher is more accurate, further right is more complex. The line connects designs you can't beat without adding complexity."
        />
        <div className="mt-8">
          {sweep.status === 'error' ? (
            <EmptyState tone="error" title="Couldn't load the circuit search." body={sweep.error.message} />
          ) : (
            <ChartFigure<CircuitConfig>
              label="Fig. 01 — Circuit designs and the Pareto front"
              subtitle={data?.evaluation}
              takeaway={data?.takeaway}
              caption="Each dot is one circuit design. Higher is more accurate, further right is more complex. The line connects designs you can't beat without adding complexity. Click a dot to open its experiment."
              legend={[
                { key: 'p', label: 'Pareto-optimal design', color: C.accent, shape: 'dot' },
                { key: 'o', label: 'Dominated design', color: C.muted, shape: 'ring' },
                { key: 'l', label: 'Pareto front', color: C.accent },
                { key: 'r', label: 'Recommended (knee point)', color: C.ink, shape: 'ring' },
              ]}
              note={data ? `Axis zoomed · ${data.aucRange[0].toFixed(2)}–${data.aucRange[1].toFixed(2)}` : undefined}
              loading={!data}
              height="30rem"
              table={{ columns, rows: sorted, rowKey: (c) => c.id, caption: 'Tested circuit designs' }}
            >
              {data && <DesignScatter sweep={data} />}
            </ChartFigure>
          )}
        </div>
      </PageItem>

      <PageItem as="section" className="mt-24">
        <SectionHeader
          index="02"
          title="All tested designs"
          plain="The same designs as a list, most accurate first. Parameters are the knobs training adjusts; fewer is simpler and faster. Click a row to open that design's experiment."
        />
        <div className="mt-6 overflow-x-auto">
          <HairlineTable
            columns={columns}
            rows={sorted}
            loading={!data}
            skeletonRows={8}
            rowKey={(c) => c.id}
            onRowClick={(c) => openExperiment(c.experimentId)}
            rowLabel={(c) => `Open experiment ${c.experimentId}`}
            caption="Tested circuit designs, most accurate first"
          />
        </div>
        <p className="measure mt-4 type-small text-muted">
          Parameters follow each ansatz: StronglyEntanglingLayers use 3 × qubits × depth; RealAmplitudes use qubits × (depth + 1).
        </p>
      </PageItem>
    </Page>
  )
}
