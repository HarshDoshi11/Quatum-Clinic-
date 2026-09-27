import { useEffect, useState } from 'react'
import { api, useResource } from '@/api'
import { ChartFigure, type LegendItem } from '@/components/charts/ChartFigure'
import { C } from '@/components/charts/chartTheme'
import { lazyScene, SceneFrame } from '@/components/three/LazyScene'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import type { Column } from '@/components/ui/HairlineTable'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SegmentedToggle, type SegmentOption } from '@/components/ui/SegmentedToggle'
import { Slider } from '@/components/ui/Slider'
import { Term } from '@/components/ui/Term'
import { Heatmap } from '@/features/failure/Heatmap'
import { formatPercent } from '@/lib/format'
import { envelopeCounts, envelopeSentence, safetyStatus, SAFETY_LABEL } from '@/lib/safety'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'

const SurfaceScene = lazyScene(() => import('@/features/failure/SurfaceScene'))

type View = '3d' | '2d'
const VIEW_OPTIONS: readonly SegmentOption<View>[] = [
  { value: '3d', label: '3D surface' },
  { value: '2d', label: '2D map' },
]

interface Row {
  corruption: number
  j: number
}

export function Failure({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const sweep = useResource((signal) => api.getSweep('failure-envelope', datasetId, { signal }), [datasetId])
  const data = sweep.data
  const [view, setView] = useState<View>('3d')
  const [threshold, setThreshold] = useState(0.85)

  // Start from the model's own threshold when data (re)loads.
  useEffect(() => {
    if (data) setThreshold(data.threshold)
  }, [data])

  // Default threshold → the API's sentence; any other value → the same shared rule, computed here.
  const takeaway = data
    ? Math.abs(threshold - data.threshold) < 1e-9
      ? data.takeaway
      : envelopeSentence(data.sensitivity, data.sensitivityStd, threshold, data.current)
    : undefined
  const counts = data ? envelopeCounts(data.sensitivity, data.sensitivityStd, threshold) : null
  const hereStatus = data ? safetyStatus(data.current.sensitivity, data.current.std, threshold) : null

  const legend: LegendItem[] = [
    { key: 's', label: 'Safe beyond seed noise', color: 'var(--risk-low)', shape: 'square' },
    { key: 'b', label: 'Borderline · within noise', color: 'var(--risk-mid)', shape: 'square' },
    { key: 'u', label: 'Unsafe', color: 'var(--risk-high)', shape: 'square' },
    view === '3d'
      ? { key: 'p', label: 'Threshold plane', color: C.accent, shape: 'square' }
      : { key: 'o', label: 'Threshold boundary', color: C.ink },
    { key: 'h', label: 'You are here', color: C.ink, shape: 'ring' },
  ]

  const columns: Column<Row>[] = [
    { key: 'c', header: 'Corruption', mono: true, render: (r) => `${r.corruption}%` },
    ...(data?.noiseAxis.values ?? [])
      .map((x, i) => ({ x, i }))
      .filter(({ i }) => i % 2 === 0)
      .map<Column<Row>>(({ x, i }) => ({
        key: `n${i}`,
        header: `${x}%`,
        align: 'right',
        mono: true,
        render: (r) => (data ? (data.sensitivity[r.j][i] * 100).toFixed(1) : ''),
      })),
  ]

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route}>
          <div className="mt-6">{data && <ExperimentTag id={data.experimentId} detail="noise × corruption grid" />}</div>
        </PageHeader>
      </PageItem>

      <PageItem as="section" className="mt-20">
        <SectionHeader
          index="01"
          title="Safety map"
          plain="Two things can go wrong at once: the quantum chip gets noisier, and the patient data gets messier. The map shows, for every mix of the two, whether the model still catches enough sick patients."
        />

        <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            {sweep.status === 'error' ? (
              <EmptyState tone="error" title="Couldn't load the envelope." body={sweep.error.message} />
            ) : (
              <ChartFigure<Row>
                label="Fig. 01 — Sensitivity across hardware noise and data corruption"
                subtitle={data?.evaluation}
                takeaway={takeaway}
                caption={
                  view === '3d'
                    ? 'Left → right: two-qubit gate error (0–3%). Front → back: share of corrupted patient values (0–30%). Height: sensitivity. Each tile takes the worst status of its four corners, so the map errs on the side of caution. Drag to rotate.'
                    : 'Each cell is one tested condition. The ink outline traces where sensitivity crosses the threshold.'
                }
                legend={legend}
                aside={<SegmentedToggle<View> options={VIEW_OPTIONS} value={view} onChange={setView} layoutId="failure-view" ariaLabel="Envelope view" size="sm" />}
                loading={!data}
                height={view === '3d' ? '30rem' : 'auto'}
                table={{
                  columns,
                  rows: data?.corruptionAxis.values.map((corruption, j) => ({ corruption, j })),
                  rowKey: (r) => String(r.j),
                  caption: 'Sensitivity (%) by data corruption (rows) and two-qubit gate error (columns)',
                }}
              >
                {data &&
                  (view === '3d' ? (
                    <div className="h-full border border-rule">
                      <SceneFrame label="Loading 3D envelope" shape="rect">
                        <SurfaceScene sweep={data} threshold={threshold} />
                      </SceneFrame>
                    </div>
                  ) : (
                    <Heatmap sweep={data} threshold={threshold} />
                  ))}
              </ChartFigure>
            )}
          </div>

          {/* Controls + readout */}
          <aside className="flex flex-col gap-8 xl:pt-24" aria-label="Threshold and summary">
            <Slider
              label={
                <>
                  Safety <Term term="threshold">threshold</Term> · <Term>sensitivity</Term>
                </>
              }
              value={threshold * 100}
              min={75}
              max={95}
              step={0.5}
              onChange={(v) => setThreshold(v / 100)}
              format={(v) => `${v.toFixed(1)}%`}
              valueText={(v) => `${v.toFixed(1)} percent`}
              hint="The lowest share of sick patients the model must catch. Clinics set this; 85% is our default."
            />
            {data && counts && hereStatus && (
              <dl className="border-t border-rule">
                {(['safe', 'borderline', 'unsafe'] as const).map((k) => (
                  <div key={k} className="flex min-h-11 items-center justify-between border-b border-rule py-2">
                    <dt className="flex items-center gap-2.5 type-ui text-ink">
                      <span className={`block h-[10px] w-[10px] ${k === 'safe' ? 'bg-risk-low' : k === 'borderline' ? 'bg-risk-mid' : 'bg-risk-high'}`} aria-hidden="true" />
                      {SAFETY_LABEL[k]}
                    </dt>
                    <dd className="num type-ui text-ink">{formatPercent(counts[k] / counts.total)}</dd>
                  </div>
                ))}
                <div className="flex min-h-11 items-center justify-between border-b border-rule py-2">
                  <dt className="type-ui text-ink">You are here · {data.current.profileName}</dt>
                  <dd className="num type-ui text-ink">
                    {formatPercent(data.current.sensitivity)}
                    <span className="ml-1.5 type-small text-muted">±{(data.current.std * 100).toFixed(1)}</span>
                  </dd>
                </div>
                <div className="flex min-h-11 items-center justify-between py-2">
                  <dt className="type-ui text-muted">Status at this threshold</dt>
                  <dd className="type-ui text-ink">{SAFETY_LABEL[hereStatus]}</dd>
                </div>
              </dl>
            )}
          </aside>
        </div>
      </PageItem>
    </Page>
  )
}

