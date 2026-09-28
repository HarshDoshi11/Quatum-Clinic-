import { useReducedMotion } from 'motion/react'
import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, TICK, niceScale, useChartUnits } from '@/components/charts/chartTheme'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { Glossed } from '@/components/ui/Glossed'
import { HairlineTable, type Column } from '@/components/ui/HairlineTable'
import { AnimatedNumber } from '@/components/ui/Metric'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Term } from '@/components/ui/Term'
import { useAppActions } from '@/features/actions'
import { formatAuc, formatDelta, formatStd } from '@/lib/format'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import type { CombinedVerdict, CrossModalityAvailable, CrossModalityUnavailable, DatasetSummary } from '@/types'

const VERDICT_LABEL: Record<CombinedVerdict, string> = {
  gain: 'Beyond seed noise',
  'within-noise': 'Within seed noise',
  loss: 'Combining loses · beyond seed noise',
}

interface BarRow {
  key: string
  label: string
  auc: number
  std: number
  combined: boolean
  best: boolean
}

function toRows(data: CrossModalityAvailable): BarRow[] {
  return [
    ...data.modalities.map((m) => ({ key: m.id, label: m.label, auc: m.auc.mean, std: m.auc.std, combined: false, best: m.id === data.bestSingle })),
    { key: 'combined', label: data.combined.label, auc: data.combined.auc.mean, std: data.combined.auc.std, combined: true, best: false },
  ]
}

/** Y range covering every ±std whisker; zoomed (with a note) since AUCs never approach 0. */
function aucScale(rows: BarRow[]) {
  return niceScale(Math.min(...rows.map((r) => r.auc - r.std)), Math.min(1, Math.max(...rows.map((r) => r.auc + r.std))), 5)
}

// ─── Fig. 01 — single vs combined ───────────────────────────

function ComparisonChart({ data }: { data: CrossModalityAvailable }) {
  const reduced = useReducedMotion() ?? false
  const units = useChartUnits()
  const rows = toRows(data)
  const { domain, ticks } = aucScale(rows)
  const best = data.modalities.find((m) => m.id === data.bestSingle)
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: units.rem * 1.75, right: units.rem, bottom: 8, left: 8 }} barCategoryGap="32%">
        <CartesianGrid vertical={false} stroke={C.rule} />
        <XAxis
          {...AXIS}
          dataKey="label"
          interval={0}
          height={units.rem * 3.25}
          tick={(props: unknown) => {
            // One word per line, so long names ("Exercise Test") never run into their neighbours.
            const { x, y, payload } = props as { x: number; y: number; payload: { value: string } }
            return (
              <text x={x} y={y} textAnchor="middle" {...TICK}>
                {payload.value.split(' ').map((w, i) => (
                  <tspan key={i} x={x} dy={i === 0 ? '1em' : '1.15em'}>
                    {w}
                  </tspan>
                ))}
              </text>
            )
          }}
        />
        <YAxis {...AXIS} domain={domain} ticks={ticks} tickFormatter={(v: number) => v.toFixed(2)} width={units.rem * 3.25} />
        {best && (
          <ReferenceLine
            y={best.auc.mean}
            stroke={C.ink}
            strokeDasharray="4 4"
            label={{ value: `Best single ${formatAuc(best.auc.mean)}`, position: 'insideBottomLeft', ...TICK, fill: C.ink }}
          />
        )}
        <Tooltip
          cursor={{ fill: 'var(--surface)' }}
          content={({ active, payload }) => {
            const r = active ? (payload?.[0]?.payload as BarRow | undefined) : undefined
            if (!r) return null
            return (
              <ChartTooltipCard
                title={r.combined ? 'All kinds of test together' : `${r.label} alone`}
                rows={[{ key: 'a', color: C.accent, label: 'AUC · QSVM', value: `${formatAuc(r.auc)} ${formatStd(r.std)}` }]}
              />
            )
          }}
        />
        <Bar dataKey="auc" isAnimationActive={!reduced} animationDuration={400}>
          {rows.map((r) => (
            // All bars are the same quantum model: singles hollow, combined solid.
            <Cell key={r.key} fill={r.combined ? C.accent : C.bg} stroke={C.accent} strokeWidth={1.5} />
          ))}
          <ErrorBar dataKey="std" width={units.rem * 0.5} stroke={C.ink} strokeWidth={1.5} />
          <LabelList
            dataKey="auc"
            content={({ x, y, width, height, index }) => {
              const r = typeof index === 'number' ? rows[index] : undefined
              if (!r) return null
              const cx = Number(x) + Number(width) / 2
              // Above the whisker (bar height ↔ auc − axis floor gives px per AUC unit), so the value never sits on the error bar.
              const whisker = (r.std * Number(height)) / (r.auc - domain[0])
              const top = Number(y) - whisker - units.rem * 0.5
              return (
                <text x={cx} y={top} textAnchor="middle" {...TICK} fill={C.ink}>
                  {formatAuc(r.auc)}
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Unavailable (dataset config declares < 2 modalities) ──

function Unavailable({ data, datasets }: { data: CrossModalityUnavailable; datasets: DatasetSummary[] | undefined }) {
  const { switchDataset } = useAppActions()
  return (
    <EmptyState
      className="mt-16"
      title={data.reason}
      body={data.detail}
      action={
        <div className="flex flex-wrap gap-3">
          {data.supportedDatasets.map((id) => {
            const d = datasets?.find((x) => x.id === id)
            return (
              <Button key={id} onClick={() => switchDataset(id)}>
                Switch to {d ? `${d.name} (${d.code})` : id} →
              </Button>
            )
          })}
        </div>
      }
    />
  )
}

// ─── Page ───────────────────────────────────────────────────

export function CrossModality({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const res = useResource((signal) => api.getCrossModality(datasetId, { signal }), [datasetId, version])
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const data = res.data?.dataset === datasetId ? res.data : undefined
  const available = data?.available ? data : undefined

  if (res.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn't load the cross-modality study." body={res.error.message} />
      </Page>
    )
  }

  const labelOf = (key: string) => schema.data?.features.find((f) => f.key === key)?.label ?? key
  const rows = available ? toRows(available) : undefined
  const scale = rows ? aucScale(rows) : undefined
  const tableRows = available ? [...available.modalities, { ...available.combined, id: 'combined' as const }] : undefined
  type TableRow = NonNullable<typeof tableRows>[number]
  const columns: Column<TableRow>[] = [
    { key: 'm', header: 'Kind of test', render: (r) => (r.id === 'combined' ? <span className="text-ink">{r.label}</span> : r.label), width: '18%' },
    { key: 'f', header: 'Features used', render: (r) => (r.id === 'combined' ? `All ${r.features.length}` : r.features.map(labelOf).join(', ')) },
    { key: 'a', header: 'AUC ± std', align: 'right', mono: true, render: (r) => `${formatAuc(r.auc.mean)} ${formatStd(r.auc.std)}`, width: '16%' },
  ]

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route}>
          <div className="mt-6">{available && <ExperimentTag id={available.experimentId} detail={`${available.modalities.length} signals · 5 seeds`} />}</div>
        </PageHeader>
      </PageItem>

      {data && !data.available ? (
        <PageItem>
          <Unavailable data={data} datasets={datasets.data} />
        </PageItem>
      ) : (
        <>
          {/* 01 — each kind of test alone */}
          <PageItem as="section" className="mt-20">
            <SectionHeader
              index="01"
              title="Each kind of test on its own"
              plain="We trained the same quantum model on one kind of test at a time, to see how much each tells us by itself."
            />
            <div className="mt-8 grid grid-cols-2 border-t border-rule md:grid-cols-3 xl:grid-cols-5" data-tour="modalities">
              {available
                ? available.modalities.map((m) => (
                    <div key={m.id} className="border-b border-rule py-5 pr-4 xl:border-r xl:pl-5 xl:first:pl-0 xl:last:border-r-0">
                      <p className="type-label text-muted">{m.label}</p>
                      <p className="mt-3 type-metric text-ink">
                        <AnimatedNumber value={m.auc.mean} format={formatAuc} />
                      </p>
                      <p className="num mt-1 type-small text-muted">
                        <Term>AUC</Term> {formatStd(m.auc.std)} · {m.features.length} feature{m.features.length > 1 ? 's' : ''}
                      </p>
                      {m.id === available.bestSingle && <p className="type-label mt-2 text-ink">Best single signal</p>}
                    </div>
                  ))
                : Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="border-b border-rule py-5 pr-4">
                      <Skeleton width="60%" />
                      <Skeleton width="5rem" height="2rem" className="mt-3" />
                    </div>
                  ))}
            </div>
          </PageItem>

          {/* 02 — together vs alone */}
          <PageItem as="section" className="mt-24">
            <SectionHeader
              index="02"
              title="Together vs alone"
              plain="The last bar is the same model given every kind of test at once. If it clearly beats the best single test, combining tests is worth it."
            />
            {/* Side by side only when the content column is wide in rem (so projector mode stacks them). */}
            <div className="@container mt-8">
              <div className="grid-12 gap-y-12">
                <div className="col-span-12 @min-[64rem]:col-span-8" data-tour="cross-chart">
                  <ChartFigure<BarRow>
                    label="Fig. 01 — AUC by kind of test, alone and combined"
                    subtitle={available?.evaluation}
                    takeaway={available?.takeaway}
                    caption={
                      <>
                        Each bar is the <Term term="qsvm">QSVM</Term> trained on that kind of test only; whiskers are ±1 std across 5{' '}
                        <Term term="seed">seeds</Term>. The dashed line marks the best single test, the bar to beat.
                      </>
                    }
                    legend={[
                      { key: 's', label: 'One kind of test · QSVM', color: C.accent, shape: 'square-outline' },
                      { key: 'c', label: 'All combined · QSVM', color: C.accent, shape: 'square' },
                      { key: 'b', label: 'Best single', color: C.ink, dashed: true },
                    ]}
                    note={scale && scale.domain[0] > 0 ? `Axis zoomed · ${scale.domain[0].toFixed(2)}–${scale.domain[1].toFixed(2)}` : undefined}
                    loading={!available}
                    height="24rem"
                    table={{
                      columns: [
                        { key: 'l', header: 'Kind of test', render: (r) => r.label },
                        { key: 'a', header: 'AUC ± std', align: 'right', mono: true, render: (r) => `${formatAuc(r.auc)} ${formatStd(r.std)}` },
                      ],
                      rows,
                      rowKey: (r) => r.key,
                      caption: 'AUC by kind of test',
                    }}
                  >
                    {available && <ComparisonChart data={available} />}
                  </ChartFigure>
                </div>

                {/* Callout */}
                <aside className="col-span-12 @min-[64rem]:col-span-4" aria-label="Gain from combining" data-tour="cross-callout">
                  <div className="border-t border-ink pt-5 @min-[64rem]:sticky @min-[64rem]:top-8">
                    <p className="type-label text-muted">Together vs best single</p>
                    {available ? (
                      <>
                        <p className="mt-3 type-metric-xl text-accent">
                          <AnimatedNumber value={available.gainPct} format={(v) => `${formatDelta(v, 1)}%`} />
                        </p>
                        <p className="measure mt-4 type-body-lg text-ink">
                          <Glossed text={available.takeaway} />
                        </p>
                        <dl className="mt-6 border-t border-rule">
                          {[
                            ['All combined', `${formatAuc(available.combined.auc.mean)} ${formatStd(available.combined.auc.std)}`],
                            [
                              `Best single · ${available.modalities.find((m) => m.id === available.bestSingle)?.label ?? ''}`,
                              (() => {
                                const b = available.modalities.find((m) => m.id === available.bestSingle)
                                return b ? `${formatAuc(b.auc.mean)} ${formatStd(b.auc.std)}` : ''
                              })(),
                            ],
                            ['Difference', formatDelta(available.difference)],
                            ['Combined seed std √(σ₁² + σ₂²)', formatAuc(available.noise)],
                          ].map(([k, v]) => (
                            <div key={k} className="flex items-baseline justify-between gap-4 border-b border-rule py-3 type-ui">
                              <dt className="text-muted">{k}</dt>
                              <dd className="num whitespace-nowrap text-ink">{v}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="type-label mt-4 text-ink">{VERDICT_LABEL[available.verdict]}</p>
                        <p className="measure mt-2 type-small text-muted">
                          The gain only counts when the difference is larger than the combined spread across seeds.
                        </p>
                      </>
                    ) : (
                      <div className="mt-3 flex flex-col gap-3" aria-hidden="true">
                        <Skeleton width="10rem" height="4rem" />
                        <Skeleton width="100%" />
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </PageItem>

          {/* 03 — what each kind of test contains */}
          <PageItem as="section" className="mt-24">
            <SectionHeader
              index="03"
              title="What each kind of test contains"
              plain="Which of the patient's results belong to each kind of test. Together they are every input the model uses."
            />
            <div className="mt-8">
              <HairlineTable<TableRow> columns={columns} rows={tableRows} rowKey={(r) => r.id} caption="Features in each kind of test" loading={!available} />
            </div>
          </PageItem>
        </>
      )}
    </Page>
  )
}
