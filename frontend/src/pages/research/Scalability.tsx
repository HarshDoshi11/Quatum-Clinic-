import { useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, DRAW_MS, TICK, niceScale, niceTimeScale } from '@/components/charts/chartTheme'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { Glossed } from '@/components/ui/Glossed'
import type { Column } from '@/components/ui/HairlineTable'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Term } from '@/components/ui/Term'
import { MODELS } from '@/lib/domain'
import { durationColumn, formatAuc, formatDuration, formatStd } from '@/lib/format'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import type { ScalabilityPoint, ScalabilitySweep } from '@/types'

interface Panel {
  key: keyof Pick<ScalabilityPoint, 'circuitDepth' | 'gateCount' | 'runtimeS' | 'auc'>
  title: ReactNode
  unit: string
  format: (v: number) => string
  /** true for the one panel where higher is better. */
  benefit?: boolean
}

const PANELS: Panel[] = [
  { key: 'circuitDepth', title: <Term term="circuit depth">Circuit depth</Term>, unit: 'layers after transpiling', format: (v) => String(Math.round(v)) },
  { key: 'gateCount', title: 'Gate count', unit: 'total operations', format: (v) => String(Math.round(v)) },
  { key: 'runtimeS', title: 'Training runtime', unit: 'mm:ss', format: formatDuration },
  { key: 'auc', title: <Term>AUC</Term>, unit: 'test set', format: formatAuc, benefit: true },
]

function SmallMultiple({ sweep, panel }: { sweep: ScalabilitySweep; panel: Panel }) {
  const reduced = useReducedMotion() ?? false
  const values = sweep.points.map((p) => p[panel.key])
  // The AUC panel shows a ±1 std band, so its axis must contain the band.
  const data = sweep.points.map((p) => ({ ...p, band: [p.auc - p.aucStd, p.auc + p.aucStd] as [number, number] }))
  const { domain, ticks } =
    panel.key === 'runtimeS'
      ? niceTimeScale(Math.max(...values), 4)
      : panel.benefit
        ? niceScale(Math.min(...data.map((d) => d.band[0])), Math.min(1, Math.max(...data.map((d) => d.band[1]))), 4)
        : niceScale(0, Math.max(...values), 4, true)
  const last = sweep.points[sweep.points.length - 1]
  const first = sweep.points[0]

  return (
    <div className="border-t border-rule pt-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="type-ui text-ink">{panel.title}</p>
        <p className="num type-small text-muted">
          {panel.format(first[panel.key])} → <span className="text-ink">{panel.format(last[panel.key])}</span>
        </p>
      </div>
      <p className="type-label mt-1 text-muted">{panel.unit}</p>
      <div className="mt-3 h-[13rem]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={C.rule} />
            <XAxis {...AXIS} dataKey="qubits" type="number" domain={[4, 12]} ticks={[4, 6, 8, 10, 12]} tickFormatter={(v: number) => `${v}q`} height={30} />
            <YAxis
              {...AXIS}
              domain={domain}
              ticks={ticks}
              width={panel.key === 'runtimeS' ? 64 : 56}
              tickFormatter={(v: number) =>
                panel.key === 'auc' ? v.toFixed(3) : panel.key === 'runtimeS' ? (v === 0 ? '00:00' : formatDuration(v)) : String(Math.round(v))
              }
            />
            <Tooltip
              cursor={{ stroke: C.ruleStrong }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as ScalabilityPoint | undefined) : undefined
                if (!p) return null
                return (
                  <ChartTooltipCard
                    title={`${p.qubits} qubits`}
                    rows={[{ key: 'v', color: C.accent, label: panel.unit, value: panel.benefit ? `${formatAuc(p.auc)} ${formatStd(p.aucStd)}` : panel.format(p[panel.key]) }]}
                  />
                )
              }}
            />
            {sweep.bottleneck && (
              <ReferenceLine
                x={sweep.bottleneck.qubits}
                stroke={C.riskHigh}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                label={{ value: 'Bottleneck', position: 'top', ...TICK, fill: C.ink }}
              />
            )}
            {panel.benefit && (
              <Area dataKey="band" type="monotone" stroke="none" fill={C.accent} fillOpacity={0.12} isAnimationActive={false} activeDot={false} tooltipType="none" />
            )}
            <Line
              dataKey={panel.key}
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
      </div>
    </div>
  )
}

export function Scalability({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const sweep = useResource((signal) => api.getSweep('scalability', datasetId, { signal }), [datasetId])
  const data = sweep.data
  const runtimeFmt = durationColumn(data?.points.map((p) => p.runtimeS) ?? [])

  const columns: Column<ScalabilityPoint>[] = [
    { key: 'q', header: 'Qubits', mono: true, render: (p) => p.qubits },
    { key: 'd', header: 'Depth', align: 'right', mono: true, render: (p) => p.circuitDepth },
    { key: 'g', header: 'Gates', align: 'right', mono: true, render: (p) => p.gateCount },
    { key: 'g2', header: '2-qubit gates', align: 'right', mono: true, render: (p) => p.twoQubitGates },
    { key: 'r', header: 'Runtime', align: 'right', mono: true, render: (p) => runtimeFmt(p.runtimeS) },
    { key: 'a', header: 'AUC', align: 'right', mono: true, render: (p) => `${formatAuc(p.auc)} ${formatStd(p.aucStd)}` },
  ]

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route}>
          <div className="mt-6">{data && <ExperimentTag id={data.experimentId} detail={`${MODELS[data.model].name} · 4→12 qubits`} />}</div>
        </PageHeader>
      </PageItem>

      <PageItem as="section" className="mt-20">
        <SectionHeader
          index="01"
          title="Cost and accuracy vs qubits"
          plain="We gave the same quantum model more and more qubits. Three charts show what it costs (circuit size and time); the last shows what it gains (accuracy)."
        />
        <div className="mt-8">
          {sweep.status === 'error' ? (
            <EmptyState tone="error" title="Couldn't load the sweep." body={sweep.error.message} />
          ) : (
            <ChartFigure<ScalabilityPoint>
              label={`Fig. 01 — ${data ? MODELS[data.model].name : 'VQC'} from 4 to 12 qubits`}
              subtitle={data?.evaluation}
              takeaway={data?.takeaway}
              caption="The shaded band on the AUC panel is ±1 standard deviation across the 5 seeds."
              note={data?.rule.text}
              loading={!data}
              height="auto"
              table={{ columns, rows: data?.points, rowKey: (p) => String(p.qubits), caption: 'Scalability sweep by qubit count' }}
            >
              {data && (
                <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                  {PANELS.map((panel) => (
                    <SmallMultiple key={panel.key} sweep={data} panel={panel} />
                  ))}
                </div>
              )}
            </ChartFigure>
          )}
        </div>

        {data?.bottleneck && (
          <div className="mt-10 flex gap-4 border-t border-rule pt-6">
            <span className="mt-1.5 block h-3 w-3 shrink-0 bg-risk-high" aria-hidden="true" />
            <div>
              <p className="type-label text-ink">Bottleneck · {data.bottleneck.qubits} qubits</p>
              <p className="measure mt-2 type-body text-ink">
                <Glossed text={data.bottleneck.explanation} />
              </p>
            </div>
          </div>
        )}
      </PageItem>
    </Page>
  )
}
