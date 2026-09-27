import { useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, DRAW_MS, TICK, niceScale } from '@/components/charts/chartTheme'
import { lazyScene, SceneFrame } from '@/components/three/LazyScene'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { Glossed } from '@/components/ui/Glossed'
import type { Column } from '@/components/ui/HairlineTable'
import { AnimatedNumber } from '@/components/ui/Metric'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Slider } from '@/components/ui/Slider'
import { Term } from '@/components/ui/Term'
import { useToast } from '@/components/ui/Toast'
import { formatAuc, formatPercent } from '@/lib/format'
import { SAFETY_LABEL } from '@/lib/safety'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import type { HardwareProfile, HardwareProfileId, NoiseParams, NoiseRunResponse, SafetyStatus } from '@/types'

const CircuitScene = lazyScene(() => import('@/features/hardware/CircuitScene'))

const SHOTS = [256, 512, 1024, 2048, 4096, 8192, 16384]
const T_MAX = 400
const DEFAULT_PROFILE: HardwareProfileId = 'fake-backend-1'

const STATUS_MARK: Record<SafetyStatus, string> = { safe: 'bg-risk-low', borderline: 'bg-risk-mid', unsafe: 'bg-risk-high' }

/** Non-breaking space keeps the number and its unit together. */
const us = (v: number | null) => (v === null ? '∞' : `${v}\u00a0µs`)

function ProfileSpecs({ p }: { p: HardwareProfile }) {
  const n = p.noise
  return (
    <span className="num mt-1 block type-small text-muted">
      <span className="block">{p.qubits} qubits</span>
      <span className="block">
        T1 {us(n.t1Us)} · T2 {us(n.t2Us)}
      </span>
      <span className="block">
        1Q {n.gateError1q}% · 2Q {n.gateError2q}%
      </span>
      <span className="block">Readout {n.readoutError}%</span>
    </span>
  )
}

// ─── Before → after metrics ─────────────────────────────────

function DeltaMetric({ label, before, after, kind }: { label: ReactNode; before: number; after: number; kind: 'pct' | 'auc' }) {
  const fmt = (v: number) => (kind === 'pct' ? (v * 100).toFixed(1) : formatAuc(v))
  // The delta is computed from the displayed values, so "95.6 → 82.6" always reads −13.0.
  // Both displays round to 3 decimals of the fraction (1 decimal of a percentage).
  const shown = (v: number) => Math.round(v * 1000) / 1000
  const delta = shown(after) - shown(before)
  const deltaText = kind === 'pct' ? `${delta < 0 ? '−' : '+'}${Math.abs(delta * 100).toFixed(1)} pts` : `${delta < 0 ? '−' : '+'}${Math.abs(delta).toFixed(3)}`
  return (
    <div className="border-t border-rule py-4">
      <p className="type-label text-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-3 whitespace-nowrap">
        <span className="type-metric text-muted">{fmt(before)}</span>
        <span className="type-metric text-muted" aria-hidden="true">
          →
        </span>
        <span className="type-metric text-ink">
          <AnimatedNumber value={after} format={fmt} from={before} />
        </span>
      </p>
      <p className={`num mt-1 type-small ${delta < -1e-9 ? 'text-risk-high' : 'text-muted'}`}>
        {Math.abs(delta) < 1e-9 ? 'no change' : deltaText} vs Ideal Sim
      </p>
    </div>
  )
}

// ─── Sensitivity vs T2 ──────────────────────────────────────

type T2Row = NoiseRunResponse['sensitivityVsT2'][number] & { band: [number, number] }

function T2Chart({ run, currentT2 }: { run: NoiseRunResponse; currentT2: number | null }) {
  const reduced = useReducedMotion() ?? false
  const rows: T2Row[] = run.sensitivityVsT2.map((p) => ({ ...p, band: [p.sensitivity - p.std, p.sensitivity + p.std] }))
  const { domain, ticks } = niceScale(
    Math.min(run.threshold, ...rows.map((r) => r.band[0])) - 0.01,
    Math.min(1, Math.max(run.threshold, ...rows.map((r) => r.band[1])) + 0.01),
    5,
  )
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 24, right: 32, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} stroke={C.rule} />
        <XAxis
          {...AXIS}
          dataKey="t2Us"
          type="number"
          scale="log"
          domain={[18, 560]}
          ticks={rows.map((r) => r.t2Us)}
          tickFormatter={(v: number) => String(v)}
          height={44}
          label={{ value: 'T2 coherence time (µs, log scale)', position: 'insideBottom', offset: -2, fill: C.muted, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
        />
        <YAxis {...AXIS} domain={domain} ticks={ticks} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} width={52} />
        <Tooltip
          cursor={{ stroke: C.ruleStrong }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as T2Row | undefined) : undefined
            if (!p) return null
            return <ChartTooltipCard title={<>T2 = {p.t2Us} <span className="normal-case">µs</span></>} rows={[{ key: 's', color: C.accent, label: 'Sensitivity', value: `${formatPercent(p.sensitivity)} ±${(p.std * 100).toFixed(1)}` }]} />
          }}
        />
        <ReferenceLine
          y={run.threshold}
          stroke={C.riskHigh}
          strokeDasharray="6 4"
          label={{ value: `${Math.round(run.threshold * 100)}% safety threshold`, position: 'insideBottomRight', ...TICK, fill: C.ink }}
        />
        {currentT2 !== null && (
          <ReferenceLine x={currentT2} stroke={C.ink} strokeDasharray="3 3" label={{ value: `Current T2 · ${currentT2} µs`, position: 'insideTopLeft', ...TICK, fill: C.ink }} />
        )}
        <Area dataKey="band" type="monotone" stroke="none" fill={C.accent} fillOpacity={0.12} isAnimationActive={false} activeDot={false} tooltipType="none" />
        <Line dataKey="sensitivity" type="monotone" stroke={C.accent} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: C.bg }} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Page ───────────────────────────────────────────────────

export function Hardware({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { toast } = useToast()
  const profiles = useResource((signal) => api.getHardwareProfiles({ signal }), [])
  const [profileId, setProfileId] = useState<HardwareProfileId>(DEFAULT_PROFILE)
  const [noise, setNoise] = useState<NoiseParams | null>(null)
  const [run, setRun] = useState<NoiseRunResponse | null>(null)
  const [ranWith, setRanWith] = useState<string>('')
  const [running, setRunning] = useState(false)
  const firstRun = useRef(true)

  const list = profiles.data
  const selected = list?.find((p) => p.id === profileId)

  const simulate = async (id: HardwareProfileId, params: NoiseParams, quiet = false) => {
    setRunning(true)
    try {
      const res = await api.runNoise({ dataset: datasetId, profileId: id, noise: params })
      setRun(res)
      setRanWith(JSON.stringify([datasetId, id, params]))
      if (!quiet) toast(`Simulation complete · sensitivity ${formatPercent(res.result.sensitivity)} · ${SAFETY_LABEL[res.status]}`, res.status === 'unsafe' ? 'error' : 'accent')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Simulation failed', 'error')
    } finally {
      setRunning(false)
    }
  }

  // Load the default profile's noise and show its result straight away (and again on dataset change).
  useEffect(() => {
    if (!list) return
    const p = list.find((x) => x.id === (firstRun.current ? DEFAULT_PROFILE : profileId)) ?? list[0]
    firstRun.current = false
    setProfileId(p.id)
    setNoise(p.noise)
    void simulate(p.id, p.noise, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, datasetId])

  const choose = (p: HardwareProfile) => {
    setProfileId(p.id)
    setNoise(p.noise)
  }

  /** Any slider move makes the settings "Custom", keeping the other values. */
  const edit = (patch: Partial<NoiseParams>) => {
    if (!noise) return
    const next = { ...noise, ...patch }
    if (next.t1Us !== null && next.t2Us !== null && next.t2Us > 2 * next.t1Us) next.t2Us = 2 * next.t1Us // physics: T2 ≤ 2·T1
    setNoise(next)
    setProfileId('custom')
  }

  const dirty = noise !== null && JSON.stringify([datasetId, profileId, noise]) !== ranWith
  const shotsIndex = noise?.shots ? Math.max(0, SHOTS.indexOf(noise.shots)) : SHOTS.length - 1

  const t2Columns: Column<NoiseRunResponse['sensitivityVsT2'][number]>[] = [
    { key: 't', header: 'T2', mono: true, render: (p) => `${p.t2Us} µs` },
    { key: 's', header: 'Sensitivity', align: 'right', mono: true, render: (p) => formatPercent(p.sensitivity) },
    { key: 'd', header: '± std', align: 'right', mono: true, render: (p) => `±${(p.std * 100).toFixed(1)}` },
  ]

  if (profiles.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn't load hardware profiles." body={profiles.error.message} />
      </Page>
    )
  }

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route}>
          <div className="mt-6">{run && <ExperimentTag id={run.experimentId} detail="QSVM · noise sweep" />}</div>
        </PageHeader>
      </PageItem>

      <PageItem as="section" className="mt-20">
        <SectionHeader
          index="01"
          title="Run the model on noisy hardware"
          plain="Pick a real or simulated quantum machine, or set the noise yourself, then run the patient model on it and compare it with a perfect machine."
        />
        <div className="grid-12 mt-8 gap-y-12">
          {/* Profiles */}
          <div className="col-span-12 lg:col-span-4 xl:col-span-3">
            <p className="type-label mb-3 text-muted">
              <Term term="backend">Backend</Term> profiles
            </p>
            <div role="radiogroup" aria-label="Hardware profile" className="border-t border-rule">
              {list
                ? list.map((p) => {
                    const on = p.id === profileId
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => choose(p)}
                        className="flex w-full gap-3 border-b border-rule py-3 text-left hover:bg-surface"
                      >
                        <span className="mt-2 flex h-[10px] w-[10px] shrink-0 items-center justify-center border border-ink" aria-hidden="true">
                          {on && <span className="block h-[6px] w-[6px] bg-accent" />}
                        </span>
                        <span className="min-w-0">
                          <span className="type-ui text-ink">{p.name}</span>
                          {p.id === 'custom' ? <span className="mt-1 block type-small text-muted">Your slider settings</span> : <ProfileSpecs p={p} />}
                        </span>
                      </button>
                    )
                  })
                : Array.from({ length: 4 }, (_, i) => (
                    <div key={i} className="border-b border-rule py-4">
                      <Skeleton width={12} />
                    </div>
                  ))}
            </div>
            {selected && selected.id !== 'custom' && <p className="measure mt-3 type-small text-muted">{selected.description}</p>}
          </div>

          {/* Circuit + sliders */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-5">
            <p className="type-label mb-3 text-muted">Fig. 01 — QSVM circuit · ZZ feature map · 4 qubits · 2 reps</p>
            <div className="h-[18rem] border border-rule" data-tour="circuit">
              {noise ? (
                <SceneFrame label="Loading circuit" shape="rect">
                  <CircuitScene noise={noise} />
                </SceneFrame>
              ) : (
                <Skeleton width="100%" height="100%" />
              )}
            </div>
            <p className="mt-2 type-small text-muted">
              Drag to rotate. Blocks are single-qubit gates, dot-and-ring pairs are two-qubit gates, outlined boxes are{' '}
              <Term term="measurement">measurements</Term>. More <Term term="noise">noise</Term> makes gates shake and fade.
            </p>

            {noise && (
              <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6">
                <Slider label={<Term term="gate error">1Q gate error</Term>} value={noise.gateError1q} min={0} max={0.2} step={0.005} onChange={(v) => edit({ gateError1q: v })} format={(v) => `${v.toFixed(3)}%`} tone="accent" />
                <Slider label={<Term term="gate error">2Q gate error</Term>} value={noise.gateError2q} min={0} max={3} step={0.05} onChange={(v) => edit({ gateError2q: v })} format={(v) => `${v.toFixed(2)}%`} tone="accent" />
                <Slider
                  label={<Term term="t1">T1</Term>}
                  value={noise.t1Us ?? T_MAX}
                  min={20}
                  max={T_MAX}
                  step={5}
                  onChange={(v) => edit({ t1Us: v })}
                  format={(v) => (noise.t1Us === null ? '∞ (ideal)' : `${v} µs`)}
                  tone="accent"
                />
                <Slider
                  label={<Term term="t2">T2</Term>}
                  value={noise.t2Us ?? T_MAX}
                  min={10}
                  max={T_MAX}
                  step={5}
                  onChange={(v) => edit({ t2Us: v })}
                  format={(v) => (noise.t2Us === null ? '∞ (ideal)' : `${v} µs`)}
                  hint="Physics caps T2 at 2 × T1."
                  tone="accent"
                />
                <Slider label={<Term term="readout error">Readout error</Term>} value={noise.readoutError} min={0} max={5} step={0.1} onChange={(v) => edit({ readoutError: v })} format={(v) => `${v.toFixed(1)}%`} tone="accent" />
                <Slider
                  label={<Term term="shots">Shots</Term>}
                  value={shotsIndex}
                  min={0}
                  max={SHOTS.length - 1}
                  step={1}
                  onChange={(i) => edit({ shots: SHOTS[i] })}
                  format={(i) => (noise.shots === null ? 'exact (statevector)' : SHOTS[i].toLocaleString('en-US'))}
                  tone="accent"
                />
              </div>
            )}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button onClick={() => noise && simulate(profileId, noise)} disabled={!noise || running}>
                {running ? 'Simulating…' : 'Run simulation'}
              </Button>
              {dirty && !running && <span className="type-label text-muted">Settings changed · run to update</span>}
            </div>
          </div>

          {/* Metrics */}
          <div className={`col-span-12 xl:col-span-4 ${dirty ? 'opacity-60' : ''}`} aria-live="polite" aria-busy={running}>
            <p className="type-label text-muted">
              Result · <Term term="qsvm">QSVM</Term> · {datasetId.toUpperCase()}
            </p>
            {run ? (
              <>
                <p className="mt-3 flex items-center gap-2.5 type-ui text-ink">
                  <span className={`block h-[10px] w-[10px] shrink-0 ${STATUS_MARK[run.status]}`} aria-hidden="true" />
                  {SAFETY_LABEL[run.status]}
                  <span className="num type-small text-muted">
                    vs {Math.round(run.threshold * 100)}% · ±{(run.sensitivityStd * 100).toFixed(1)} std
                  </span>
                </p>
                <p className="measure mt-3 type-body text-ink">
                  <Glossed text={run.takeaway} />
                </p>
                <div className="mt-5">
                  <DeltaMetric label={<Term>Sensitivity</Term>} before={run.reference.sensitivity} after={run.result.sensitivity} kind="pct" />
                  <DeltaMetric label={<Term>Specificity</Term>} before={run.reference.specificity} after={run.result.specificity} kind="pct" />
                  <DeltaMetric label={<Term>AUC</Term>} before={run.reference.auc} after={run.result.auc} kind="auc" />
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-col gap-4" aria-hidden="true">
                <Skeleton width="80%" />
                <Skeleton width="100%" height="3rem" />
                <Skeleton width="100%" height="3rem" />
              </div>
            )}
          </div>
        </div>
      </PageItem>

      <PageItem as="section" className="mt-24">
        <SectionHeader
          index="02"
          title="Sensitivity vs T2"
          plain="T2 is how long a qubit keeps its quantum state. This chart holds every other setting fixed and shows how many sick patients the model still catches as T2 gets shorter or longer."
        />
        <div className="mt-8">
          <ChartFigure<NoiseRunResponse['sensitivityVsT2'][number]>
            label="Fig. 02 — Sensitivity as T2 varies"
            subtitle={run?.evaluation}
            takeaway={run?.t2Takeaway}
            caption="The shaded band is ±1 standard deviation across seeds and shots. The dashed red line is the 85% safety threshold."
            legend={[
              { key: 's', label: 'Sensitivity (QSVM)', color: C.accent },
              { key: 't', label: 'Safety threshold', color: C.riskHigh, dashed: true },
            ]}
            loading={!run}
            height="22rem"
            table={{ columns: t2Columns, rows: run?.sensitivityVsT2, rowKey: (p) => String(p.t2Us), caption: 'Sensitivity by T2' }}
          >
            {run && <T2Chart run={run} currentT2={noise?.t2Us ?? null} />}
          </ChartFigure>
        </div>
      </PageItem>
    </Page>
  )
}

