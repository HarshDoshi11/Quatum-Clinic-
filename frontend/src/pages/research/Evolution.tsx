import { useReducedMotion } from 'motion/react'
import type { ReactElement } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, DRAW_MS, TICK, niceScale } from '@/components/charts/chartTheme'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { HairlineTable, type Column } from '@/components/ui/HairlineTable'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Term } from '@/components/ui/Term'
import { MODELS } from '@/lib/domain'
import { formatAuc, formatDuration } from '@/lib/format'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import type { CircuitConfig, EvolutionSweep } from '@/types'

/** Designs at the same depth are spread horizontally by qubit count so none hide behind another. */
const jitterX = (c: CircuitConfig) => c.circuitDepth + (c.qubits - 6) * 0.07 + (c.encoding === 'amplitude' ? 0.035 : 0)

interface Datum extends CircuitConfig {
  x: number
}

const ENTANGLEMENT_LABEL: Record<CircuitConfig['entanglement'], string> = { linear: 'Linear', circular: 'Circular', full: 'Full' }

function DesignScatter({ sweep }: { sweep: EvolutionSweep }) {
  const reduced = useReducedMotion() ?? false
  const data: Datum[] = sweep.configs.map((c) => ({ ...c, x: jitterX(c) }))
  const front = data.filter((d) => d.pareto).sort((a, b) => a.x - b.x)
  const rec = data.find((d) => d.id === sweep.recommendedId)
  const aucs = data.map((d) => d.auc)
  const { domain, ticks } = niceScale(Math.min(...aucs) - 0.002, Math.max(...aucs) + 0.004, 5)

  const hollow = (props: unknown): ReactElement => {
    const { cx, cy } = props as { cx: number; cy: number }
    return <circle cx={cx} cy={cy} r={5} fill={C.bg} stroke={C.accent} strokeWidth={1.5} />
  }
  const filled = (props: unknown): ReactElement => {
    const { cx, cy } = props as { cx: number; cy: number }
    return <circle cx={cx} cy={cy} r={5.5} fill={C.accent} stroke={C.bg} strokeWidth={2} />
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart margin={{ top: 28, right: 32, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} stroke={C.rule} />
        <XAxis
          {...AXIS}
          type="number"
          dataKey="x"
          domain={[0.6, 4.4]}
          ticks={[1, 2, 3, 4]}
          tickFormatter={(v: number) => `depth ${v}`}
          height={44}
          label={{ value: 'Circuit depth (layers) · deeper = more noise-prone', position: 'insideBottom', offset: -2, fill: C.muted, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
        />
        <YAxis {...AXIS} type="number" dataKey="auc" domain={domain} ticks={ticks} tickFormatter={(v: number) => v.toFixed(3)} width={64} />
        <Tooltip
          cursor={false}
          content={({ active, payload }) => {
            const d = active ? (payload?.[0]?.payload as Datum | undefined) : undefined
            if (!d || d.id === undefined) return null
            return (
              <ChartTooltipCard
                title={`${d.id}${d.id === sweep.recommendedId ? ' · recommended' : d.pareto ? ' · Pareto' : ''}`}
                rows={[
                  { key: 'e', label: 'Encoding', value: d.encoding },
                  { key: 'q', label: 'Qubits', value: d.qubits },
                  { key: 'd', label: 'Depth', value: d.circuitDepth },
                  { key: 'n', label: 'Entanglement', value: ENTANGLEMENT_LABEL[d.entanglement] },
                  { key: 'a', label: 'AUC', value: formatAuc(d.auc) },
                ]}
              />
            )
          }}
        />
        <Line
          data={front}
          dataKey="auc"
          type="linear"
          stroke={C.accent}
          strokeWidth={2}
          dot={false}
          activeDot={false}
          isAnimationActive={!reduced}
          animationDuration={DRAW_MS}
          legendType="none"
        />
        <Scatter data={data.filter((d) => !d.pareto)} shape={hollow} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
        <Scatter data={front} shape={filled} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
        {rec && (
          <ReferenceDot
            x={rec.x}
            y={rec.auc}
            r={11}
            fill="none"
            stroke={C.ink}
            strokeWidth={1.5}
            label={{ value: `${rec.id} · recommended`, position: 'top', offset: 14, ...TICK, fill: C.ink }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

export function Evolution({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const sweep = useResource((signal) => api.getSweep('evolution', datasetId, { signal }), [datasetId])
  const data = sweep.data
  const sorted = data ? [...data.configs].sort((a, b) => b.auc - a.auc) : undefined

  const columns: Column<CircuitConfig>[] = [
    {
      key: 'id',
      header: 'Design',
      mono: true,
      render: (c) => (
        <span className="flex items-center gap-2">
          <span className={`block h-[8px] w-[8px] rounded-full ${c.pareto ? 'bg-accent' : 'border border-accent'}`} aria-hidden="true" />
          <span className="text-ink">{c.id}</span>
          {c.id === data?.recommendedId && <span className="type-label rounded-[2px] border border-ink px-1.5 text-ink">Recommended</span>}
        </span>
      ),
    },
    { key: 'enc', header: <Term term="encoding">Encoding</Term>, render: (c) => (c.encoding === 'angle' ? 'Angle' : 'Amplitude') },
    { key: 'q', header: <Term term="qubit">Qubits</Term>, align: 'right', mono: true, render: (c) => c.qubits },
    { key: 'd', header: <Term term="circuit depth">Depth</Term>, align: 'right', mono: true, render: (c) => c.circuitDepth },
    { key: 'ent', header: 'Entanglement', render: (c) => ENTANGLEMENT_LABEL[c.entanglement] },
    { key: 'p', header: 'Parameters', align: 'right', mono: true, render: (c) => c.parameters },
    { key: 't', header: 'Train time', align: 'right', mono: true, render: (c) => formatDuration(c.trainTimeS) },
    {
      key: 'auc',
      header: <Term>AUC</Term>,
      align: 'right',
      mono: true,
      render: (c) => <span className={c.id === sorted?.[0]?.id ? 'text-accent' : 'text-ink'}>{formatAuc(c.auc)}</span>,
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
          plain="Each dot is one quantum circuit we tried. Higher is more accurate; further right is deeper and more fragile on real hardware. The line links the designs you can't beat without going deeper."
        />
        <div className="mt-8">
          {sweep.status === 'error' ? (
            <EmptyState tone="error" title="Couldn't load the circuit search." body={sweep.error.message} />
          ) : (
            <ChartFigure<CircuitConfig>
              label="Fig. 01 — Circuit designs and the Pareto front"
              takeaway={data?.takeaway}
              legend={[
                { key: 'p', label: 'Pareto-optimal design', color: C.accent, shape: 'dot' },
                { key: 'o', label: 'Other design', color: C.accent, shape: 'ring' },
                { key: 'l', label: 'Pareto front', color: C.accent },
              ]}
              loading={!data}
              height="28rem"
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
          plain="The same designs as a list, most accurate first. Parameters are the knobs the training adjusts; fewer is simpler and faster."
        />
        <div className="mt-6 overflow-x-auto">
          <HairlineTable columns={columns} rows={sorted} loading={!data} skeletonRows={8} rowKey={(c) => c.id} caption="Tested circuit designs, most accurate first" />
        </div>
      </PageItem>
    </Page>
  )
}
