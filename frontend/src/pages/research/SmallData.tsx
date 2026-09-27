import { useReducedMotion } from 'motion/react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useResource } from '@/api'
import { ChartFigure, type LegendItem } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, DRAW_MS, familyColor, niceScale, useChartUnits } from '@/components/charts/chartTheme'
import { endLabel, resolveLabelOffsets } from '@/components/charts/directLabels'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import type { Column } from '@/components/ui/HairlineTable'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Term } from '@/components/ui/Term'
import { MODELS } from '@/lib/domain'
import { formatAuc, formatStd } from '@/lib/format'
import { useElementSize } from '@/lib/useElementSize'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import type { ModelId, SmallDataSweep } from '@/types'

/** Second model of each family is dashed, so identity never relies on colour alone. */
const DASHED: Partial<Record<ModelId, boolean>> = { vqc: true, logreg: true, rf: true }

const X_AXIS_H = 40

type Row = { trainSize: number; label: string } & Partial<Record<ModelId, number>> & Partial<Record<`${ModelId}Band`, [number, number]>>

function toRows(sweep: SmallDataSweep): Row[] {
  return sweep.sizes.map((size, i) => {
    const row: Row = { trainSize: size, label: sweep.series[0]?.points[i]?.label ?? String(size) }
    for (const s of sweep.series) {
      const p = s.points[i]
      if (!p) continue
      row[s.model] = p.auc.mean
      // ±1 std across the 5 seeds, drawn as a shaded band.
      row[`${s.model}Band`] = [p.auc.mean - p.auc.std, p.auc.mean + p.auc.std]
    }
    return row
  })
}

function LearningCurves({ sweep }: { sweep: SmallDataSweep }) {
  const reduced = useReducedMotion() ?? false
  const units = useChartUnits()
  const MARGIN = { top: 16, right: units.labelGutter, bottom: 8, left: 8 }
  const [ref, size] = useElementSize<HTMLDivElement>()
  const rows = toRows(sweep)
  const lows = sweep.series.flatMap((s) => s.points.map((p) => p.auc.mean - p.auc.std))
  const highs = sweep.series.flatMap((s) => s.points.map((p) => Math.min(1, p.auc.mean + p.auc.std)))
  const { domain, ticks } = niceScale(Math.min(...lows), Math.max(...highs), 6)
  const last = rows.length - 1
  const offsets = resolveLabelOffsets(
    sweep.series.map((s) => ({ key: s.model, value: s.points[last]?.auc.mean ?? 0 })),
    domain,
    size.height - MARGIN.top - MARGIN.bottom - X_AXIS_H,
    units.labelGap,
  )
  const cross = sweep.crossover
  const closes = sweep.gapClosesAt

  return (
    <div ref={ref} className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke={C.rule} />
          <XAxis
            {...AXIS}
            dataKey="trainSize"
            type="number"
            scale="log"
            domain={[sweep.sizes[0] * 0.85, sweep.sizes[last] * 1.1]}
            ticks={sweep.sizes}
            tickFormatter={(v: number) => String(v)}
            height={X_AXIS_H}
            label={{ value: 'Training patients (log scale)', position: 'insideBottom', offset: -2, fill: C.muted, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
          />
          <YAxis {...AXIS} domain={domain} ticks={ticks} tickFormatter={(v: number) => v.toFixed(2)} width={56} />
          <Tooltip
            cursor={{ stroke: C.ruleStrong, strokeWidth: 1 }}
            content={({ active, payload }) => {
              const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined
              if (!row) return null
              return (
                <ChartTooltipCard
                  title={`${row.label} training patients`}
                  rows={sweep.series.map((s) => ({
                    key: s.model,
                    color: familyColor(s.family),
                    dashed: DASHED[s.model],
                    label: MODELS[s.model].name,
                    value: (() => {
                      const p = s.points.find((x) => x.trainSize === row.trainSize)
                      return p ? `${formatAuc(p.auc.mean)} ${formatStd(p.auc.std)}` : '—'
                    })(),
                  }))}
                />
              )
            }}
          />
          {cross && (
            <ReferenceLine
              x={cross.trainSize}
              stroke={C.ink}
              strokeDasharray="4 4"
              label={{ value: `Crossover · ~${cross.trainSize}`, position: 'insideTopRight', fill: C.ink, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
            />
          )}
          {sweep.series.map((s) => (
            <Area
              key={`${s.model}-band`}
              dataKey={`${s.model}Band`}
              type="monotone"
              stroke="none"
              fill={familyColor(s.family)}
              fillOpacity={s.family === 'quantum' ? 0.1 : 0.14}
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
              tooltipType="none"
            />
          ))}
          {closes && !cross && (
            <ReferenceLine
              x={closes}
              stroke={C.ink}
              strokeDasharray="4 4"
              label={{ value: `Gap within noise · ~${closes}`, position: 'insideTopRight', fill: C.ink, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
            />
          )}
          {sweep.series.map((s) => (
            <Line
              key={s.model}
              dataKey={s.model}
              name={MODELS[s.model].name}
              type="monotone"
              stroke={familyColor(s.family)}
              strokeWidth={2}
              strokeDasharray={DASHED[s.model] ? '6 4' : undefined}
              dot={{ r: 4, strokeWidth: 2, fill: C.bg, strokeDasharray: '0' }}
              activeDot={{ r: 5, strokeWidth: 2, fill: C.bg, strokeDasharray: '0' }}
              isAnimationActive={!reduced}
              animationDuration={DRAW_MS}
              animationEasing="ease-out"
              label={endLabel(last, `${MODELS[s.model].name} ${formatAuc(s.points[last]?.auc.mean ?? 0)}`, offsets[s.model] ?? 0)}
            />
          ))}
          {cross && <ReferenceDot x={cross.trainSize} y={cross.auc} r={6} fill="none" stroke={C.ink} strokeWidth={1.5} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SmallData({ route }: { route: RouteMeta }) {
  const { datasetId, dataset } = useDataset()
  const sweep = useResource((signal) => api.getSweep('small-data', datasetId, { signal }), [datasetId])
  const data = sweep.data

  const legend: LegendItem[] = (data?.series ?? []).map((s) => ({
    key: s.model,
    label: `${MODELS[s.model].name} · ${s.family}`,
    color: familyColor(s.family),
    dashed: DASHED[s.model],
  }))
  const heading = data ? `Learning curves · ${data.series.map((s) => MODELS[s.model].name).join(', ')}` : 'Learning curves'

  const columns: Column<Row>[] = [
    { key: 'size', header: 'Training patients', mono: true, render: (r) => r.label },
    ...(data?.series ?? []).map<Column<Row>>((s) => ({
      key: s.model,
      header: MODELS[s.model].name,
      align: 'right',
      mono: true,
      render: (r) => {
        const point = s.points.find((p) => p.trainSize === r.trainSize)
        return point ? `${formatAuc(point.auc.mean)} ${formatStd(point.auc.std)}` : '—'
      },
    })),
  ]

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route}>
          <div className="mt-6">{data && <ExperimentTag id={data.experimentId} detail="5 seeds per size" />}</div>
        </PageHeader>
      </PageItem>

      <PageItem as="section" className="mt-20">
        <SectionHeader
          index="01"
          title={heading}
          plain="Each line shows how good a model gets as we give it more patients to learn from. Lines further left and higher learn more from less."
        />
        <div className="mt-8">
          {sweep.status === 'error' ? (
            <EmptyState tone="error" title="Couldn't load the sweep." body={sweep.error.message} />
          ) : (
            <ChartFigure<Row>
              label={`Fig. 01 — Quantum vs classical · ${dataset.code}`}
              subtitle={data?.evaluation}
              takeaway={data?.takeaway}
              caption="Shaded bands show ±1 standard deviation across the 5 seeds; where bands overlap, the difference is within seed noise."
              legend={legend}
              loading={!data}
              height="26rem"
              table={{ columns, rows: data ? toRows(data) : undefined, rowKey: (r) => String(r.trainSize), caption: 'AUC by training-set size' }}
            >
              {data && <LearningCurves sweep={data} />}
            </ChartFigure>
          )}
        </div>
        <p className="measure mt-6 type-small text-muted">
          <Term>AUC</Term> averaged over 5 <Term term="seed">seeds</Term> at every training size; the test set is identical
          for all points. Blue lines are quantum models, grey lines classical <Term term="baseline">baselines</Term>.
        </p>
      </PageItem>
    </Page>
  )
}
