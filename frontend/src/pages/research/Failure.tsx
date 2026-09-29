import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
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
import { formatAuc, formatPercent, formatPercentStd, formatPoints } from '@/lib/format'
import { envelopeCounts, envelopeSentence, safetyStatus, SAFETY_LABEL } from '@/lib/safety'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import type { HardwareProfileId } from '@/types'

const SurfaceScene = lazyScene(() => import('@/features/failure/SurfaceScene'))

type View = '3d' | '2d'
const VIEW_OPTIONS: readonly SegmentOption<View>[] = [
  { value: '3d', label: '3D surface' },
  { value: '2d', label: '2D map' },
]

type EnvelopeProfileId = Exclude<HardwareProfileId, 'custom'>
const PROFILE_OPTIONS: readonly SegmentOption<EnvelopeProfileId>[] = [
  { value: 'ideal-sim', label: 'Ideal Sim' },
  { value: 'fake-backend-1', label: 'FakeBackend-1' },
  { value: 'fake-backend-2', label: 'FakeBackend-2' },
]
const isEnvelopeProfile = (v: string | null): v is EnvelopeProfileId => PROFILE_OPTIONS.some((o) => o.value === v)

interface Row {
  corruption: number
  j: number
}

export function Failure({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const sweep = useResource((signal) => api.getSweep('failure-envelope', datasetId, { signal }), [datasetId, version])
  const data = sweep.data
  // Backend profile: from ?profile= (so the Hardware Lab can deep-link), else the sweep's default.
  const [params, setParams] = useSearchParams()
  const requested = params.get('profile')
  const fallback = data && isEnvelopeProfile(data.defaultProfileId) ? data.defaultProfileId : 'fake-backend-1'
  const profileId: EnvelopeProfileId = isEnvelopeProfile(requested) ? requested : fallback
  const profile = data?.profiles.find((p) => p.profileId === profileId) ?? data?.profiles[0]
  const setProfile = (id: EnvelopeProfileId) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('profile', id)
        return next
      },
      { replace: true },
    )
  const [view, setView] = useState<View>('3d')
  const [threshold, setThreshold] = useState(0.85)

  // Start from the model's own threshold when data (re)loads.
  useEffect(() => {
    if (data) setThreshold(data.threshold)
  }, [data])

  // Default threshold → the API's sentence; any other value → the same shared rule, computed here.
  const takeaway =
    data && profile
      ? Math.abs(threshold - data.threshold) < 1e-9
        ? profile.takeaway
        : envelopeSentence(profile.sensitivity, profile.sensitivityStd, threshold, profile.current)
      : undefined
  const counts = profile ? envelopeCounts(profile.sensitivity, profile.sensitivityStd, threshold) : null
  const here = profile?.current
  const hereStatus = here ? safetyStatus(here.sensitivity, here.std, threshold) : null

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
        render: (r) => (profile ? formatPoints(profile.sensitivity[r.j][i]) : ''),
      })),
  ]

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route} source={data?.source}>
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
                label={`Fig. 01 — Sensitivity across hardware noise and data corruption${profile ? ` · ${profile.profileName}` : ''}`}
                subtitle={data?.evaluation}
                takeaway={takeaway}
                caption={
                  view === '3d'
                    ? 'Left → right: two-qubit gate error (0–3%). Back → front: share of corrupted patient values (30% → 0%). Height: sensitivity. The stem marks this backend at its real gate error with clean data. Each tile takes the worst status of its four corners, so the map errs on the side of caution. Drag to rotate.'
                    : 'Each cell is one tested condition. The ink outline traces where sensitivity crosses the threshold. The ring marks this backend at its real gate error with clean data.'
                }
                legend={legend}
                aside={<SegmentedToggle<View> options={VIEW_OPTIONS} value={view} onChange={setView} layoutId="failure-view" ariaLabel="Envelope view" size="sm" />}
                loading={!data || !profile}
                height={view === '3d' ? '30rem' : 'auto'}
                table={{
                  columns,
                  rows: data?.corruptionAxis.values.map((corruption, j) => ({ corruption, j })),
                  rowKey: (r) => String(r.j),
                  caption: 'Sensitivity (%) by data corruption (rows) and two-qubit gate error (columns)',
                }}
              >
                {data &&
                  profile &&
                  (view === '3d' ? (
                    <div className="h-full border border-rule select-none">
                      <SceneFrame label="Loading 3D envelope" shape="rect">
                        <SurfaceScene sweep={data} profile={profile} threshold={threshold} />
                      </SceneFrame>
                    </div>
                  ) : (
                    <Heatmap sweep={data} profile={profile} threshold={threshold} />
                  ))}
              </ChartFigure>
            )}
          </div>

          {/* Controls + readout */}
          <aside className="flex flex-col gap-8 xl:pt-24" aria-label="Backend, threshold and summary">
            <div>
              <p className="type-label text-muted">
                <Term term="backend">Backend</Term>
              </p>
              <div role="radiogroup" aria-label="Backend profile" className="mt-3 border-t border-rule">
                {PROFILE_OPTIONS.map((o) => {
                  const on = o.value === profileId
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setProfile(o.value)}
                      className="flex h-11 w-full items-center gap-3 border-b border-rule text-left type-ui text-ink hover:bg-surface"
                    >
                      <span className="flex h-[10px] w-[10px] shrink-0 items-center justify-center border border-ink" aria-hidden="true">
                        {on && <span className="block h-[6px] w-[6px] bg-accent" />}
                      </span>
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </div>
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
            {here && counts && hereStatus && (
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
                <div className="border-b border-rule py-3">
                  <dt className="type-ui text-ink">You are here · {here.profileName}</dt>
                  <dd className="num mt-1 type-small text-muted">
                    {here.noise}% 2Q error · {here.corruption}% corrupted
                  </dd>
                </div>
                <div className="flex min-h-11 items-center justify-between border-b border-rule py-2">
                  <dt className="type-ui text-muted">
                    <Term>Sensitivity</Term>
                  </dt>
                  <dd className="num type-ui text-ink">
                    {formatPercent(here.sensitivity)}
                    <span className="ml-1.5 type-small text-muted">{formatPercentStd(here.std)}</span>
                  </dd>
                </div>
                <div className="flex min-h-11 items-center justify-between border-b border-rule py-2">
                  <dt className="type-ui text-muted">
                    <Term>Specificity</Term>
                  </dt>
                  <dd className="num type-ui text-ink">{formatPercent(here.specificity)}</dd>
                </div>
                <div className="flex min-h-11 items-center justify-between border-b border-rule py-2">
                  <dt className="type-ui text-muted">
                    <Term>AUC</Term>
                  </dt>
                  <dd className="num type-ui text-ink">{formatAuc(here.auc)}</dd>
                </div>
                <div className="flex min-h-11 items-center justify-between py-2">
                  <dt className="type-ui text-muted">Status at this threshold</dt>
                  <dd className="type-ui text-ink">{SAFETY_LABEL[hereStatus]}</dd>
                </div>
              </dl>
            )}
            {here && (
              <Link to={`/hardware?profile=${profileId}`} className="type-label text-ink underline-offset-4 hover:underline">
                Same run in the Hardware Lab →
              </Link>
            )}
          </aside>
        </div>
      </PageItem>
    </Page>
  )
}

