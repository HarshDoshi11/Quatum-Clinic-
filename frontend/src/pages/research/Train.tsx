import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useResource } from '@/api'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, useChartUnits } from '@/components/charts/chartTheme'
import { endLabel } from '@/components/charts/directLabels'
import { Button } from '@/components/ui/Button'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { SegmentedToggle, type SegmentOption } from '@/components/ui/SegmentedToggle'
import { Skeleton } from '@/components/ui/Skeleton'
import { Slider } from '@/components/ui/Slider'
import { Term } from '@/components/ui/Term'
import { useToast } from '@/components/ui/Toast'
import { BACKENDS, MODEL_ORDER, MODELS } from '@/lib/domain'
import { formatAuc, formatNumber, formatStd } from '@/lib/format'
import { easePrecise } from '@/lib/motion'
import type { RouteMeta } from '@/routes'
import { useDataVersion } from '@/state/dataVersion'
import { useDataset } from '@/state/dataset'
import type { CircuitDepth, Encoding, LossPoint, ModelId, QubitCount, SeedCount, TrainResponse } from '@/types'

const PLAIN_MODEL: Record<ModelId, string> = {
  vqc: 'A trainable quantum circuit, tuned like a small neural network.',
  qsvm: 'Compares patients using a quantum circuit as its similarity measure.',
  logreg: 'The simplest yardstick: a weighted sum of measurements.',
  svm: 'Draws the widest possible boundary between sick and healthy.',
  rf: 'Hundreds of decision trees that vote.',
  xgboost: 'Decision trees built one after another, each fixing the last.',
}

const QUBIT_OPTIONS: readonly SegmentOption<'4' | '6' | '8'>[] = ['4', '6', '8'].map((q) => ({ value: q as '4' | '6' | '8', label: `${q}q`, ariaLabel: `${q} qubits` }))
const DEPTH_OPTIONS: readonly SegmentOption<'1' | '2' | '3' | '4'>[] = ['1', '2', '3', '4'].map((d) => ({ value: d as '1' | '2' | '3' | '4', label: d, ariaLabel: `Depth ${d}` }))
const ENCODING_OPTIONS: readonly SegmentOption<Encoding>[] = [
  { value: 'angle', label: 'Angle' },
  { value: 'amplitude', label: 'Amplitude' },
]

/** Visible training time; the mock returns the whole curve at once and we replay it. */
const EPOCH_MS = 90

type Phase = 'idle' | 'queued' | 'training' | 'done'

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center border ${checked ? 'border-ink bg-ink' : 'border-rule-strong'}`} aria-hidden="true">
      {checked && <span className="block h-[8px] w-[8px] bg-bg" />}
    </span>
  )
}

function LossChart({ points, epochs }: { points: LossPoint[]; epochs: number }) {
  const { labelGutter } = useChartUnits()
  const last = points.length - 1
  const lossMax = Math.max(0.8, ...points.map((p) => Math.max(p.loss, p.valLoss)))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={points} margin={{ top: 16, right: Math.round(labelGutter * 0.6), bottom: 4, left: 4 }}>
        <CartesianGrid vertical={false} stroke={C.rule} />
        <XAxis {...AXIS} dataKey="epoch" type="number" domain={[1, epochs]} ticks={[1, 10, 20, 30, 40, 50].filter((t) => t <= epochs)} height={30} />
        <YAxis {...AXIS} domain={[0.2, Math.ceil(lossMax * 10) / 10]} tickCount={5} tickFormatter={(v: number) => formatNumber(v, 2)} width={52} />
        <Tooltip
          cursor={{ stroke: C.ruleStrong }}
          content={({ active, payload }) => {
            const p = active ? (payload?.[0]?.payload as LossPoint | undefined) : undefined
            if (!p) return null
            return (
              <ChartTooltipCard
                title={`Epoch ${p.epoch}`}
                rows={[
                  { key: 'l', color: C.accent, label: 'Training loss', value: formatNumber(p.loss, 3) },
                  { key: 'v', color: C.accent, dashed: true, label: 'Validation loss', value: formatNumber(p.valLoss, 3) },
                ]}
              />
            )
          }}
        />
        <Line dataKey="loss" type="monotone" stroke={C.accent} strokeWidth={2} dot={false} isAnimationActive={false} label={last >= 0 ? endLabel(last, 'Training') : false} />
        <Line
          dataKey="valLoss"
          type="monotone"
          stroke={C.accent}
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
          label={last >= 0 ? endLabel(last, 'Validation', points[last] && points[last].valLoss - points[last].loss < 0.03 ? -14 : 0) : false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function Train({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { invalidate } = useDataVersion()
  const { toast } = useToast()
  const reduced = useReducedMotion() ?? false
  const compare = useResource((signal) => api.compare(datasetId, { signal }), [datasetId])

  const [selected, setSelected] = useState<Set<ModelId>>(new Set(['vqc', 'qsvm', 'xgboost']))
  const [qubits, setQubits] = useState<'4' | '6' | '8'>('4')
  const [encoding, setEncoding] = useState<Encoding>('angle')
  const [depth, setDepth] = useState<'1' | '2' | '3' | '4'>('2')
  const [seeds, setSeeds] = useState(5)

  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<TrainResponse | null>(null)
  const [epoch, setEpoch] = useState(0)
  const timer = useRef<number | null>(null)

  const quantumSelected = [...selected].some((m) => MODELS[m].family === 'quantum')
  const hasCurve = (result?.lossCurve.length ?? 0) > 0
  const totalEpochs = result?.epochs ?? 50

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current)
  }, [])

  const toggle = (m: ModelId) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(m)) next.delete(m)
      else next.add(m)
      return next
    })

  const finish = (res: TrainResponse) => {
    setPhase('done')
    invalidate()
    const best = res.results.reduce((a, b) => (b.auc.mean > a.auc.mean ? b : a), res.results[0])
    toast(`${res.experimentId} complete · best AUC ${formatAuc(best.auc.mean)} (${MODELS[best.model].name})`, 'accent')
  }

  const start = async () => {
    if (selected.size === 0) return
    if (timer.current) window.clearInterval(timer.current)
    setPhase('queued')
    setResult(null)
    setEpoch(0)
    toast(quantumSelected ? `Training queued · ${qubits}Q · ${encoding} · depth ${depth}` : `Training queued · ${selected.size} classical models`)
    try {
      const res = await api.train({
        dataset: datasetId,
        models: MODEL_ORDER.filter((m) => selected.has(m)),
        qubits: Number(qubits) as QubitCount,
        encoding,
        circuitDepth: Number(depth) as CircuitDepth,
        seeds: seeds as SeedCount,
      })
      setResult(res)
      setPhase('training')
      if (reduced || res.lossCurve.length === 0) {
        setEpoch(res.epochs)
        finish(res)
        return
      }
      let e = 0
      timer.current = window.setInterval(() => {
        e += 1
        setEpoch(e)
        if (e >= res.epochs) {
          if (timer.current) window.clearInterval(timer.current)
          timer.current = null
          finish(res)
        }
      }, EPOCH_MS)
    } catch (error) {
      setPhase('idle')
      toast(error instanceof Error ? error.message : 'Training failed', 'error')
    }
  }

  const benchmarkAuc = (m: ModelId) => compare.data?.rows.find((r) => r.model === m)?.metrics.auc.mean
  const shown = result?.lossCurve.slice(0, epoch) ?? []
  const bestResult = result?.results.reduce((a, b) => (b.auc.mean > a.auc.mean ? b : a), result.results[0])
  const busy = phase === 'queued' || phase === 'training'

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route} source={(result ?? compare.data)?.source}>
          <div className="mt-6">
            {result ? <ExperimentTag id={result.experimentId} detail={`${seeds} seed${seeds > 1 ? 's' : ''} · this run`} /> : compare.data && <ExperimentTag id={compare.data.experimentId} detail="last benchmark" />}
          </div>
        </PageHeader>
      </PageItem>

      <div className="mt-20 grid-12 gap-y-16">
        {/* Left: models + config */}
        <PageItem as="section" className="col-span-12 xl:col-span-7">
          <SectionHeader index="01" title="Models" plain="Tick the models to train. Blue squares are quantum models, grey squares are the classical models they must beat." />
          <ul className="mt-4 border-t border-rule" aria-label="Models to train">
            {MODEL_ORDER.map((m) => {
              const info = MODELS[m]
              const on = selected.has(m)
              const bench = benchmarkAuc(m)
              return (
                <li key={m} className="border-b border-rule">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(m)}
                    disabled={busy}
                    className="grid min-h-14 w-full grid-cols-[18px_10px_minmax(8rem,10rem)_1fr_auto] items-center gap-4 py-2 text-left hover:bg-surface disabled:cursor-not-allowed"
                  >
                    <Checkbox checked={on} />
                    <span className={`block h-[10px] w-[10px] ${info.family === 'quantum' ? 'bg-accent' : 'bg-classical'}`} aria-hidden="true" />
                    <span className="flex flex-col">
                      <span className="type-ui text-ink">{info.name}</span>
                      <span className="type-label text-muted">{info.family}</span>
                    </span>
                    <span className="type-small text-muted">{PLAIN_MODEL[m]}</span>
                    <span className="num type-small text-right text-muted">{bench !== undefined ? `last ${formatAuc(bench)}` : <Skeleton width={8} />}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-16">
            <SectionHeader
              index="02"
              title="Quantum configuration"
              plain="Settings for the quantum models only: how many qubits, how patient data is loaded into them, how many layers the circuit has, and how many repeat runs to average."
            />
            <div className={`mt-6 grid grid-cols-2 gap-x-10 gap-y-8 ${quantumSelected ? '' : 'opacity-40'}`} aria-disabled={!quantumSelected}>
              <div>
                <p className="type-label mb-2 text-muted">
                  <Term term="qubit">Qubits</Term>
                </p>
                <SegmentedToggle options={QUBIT_OPTIONS} value={qubits} onChange={setQubits} layoutId="train-qubits" ariaLabel="Qubits" />
              </div>
              <div>
                <p className="type-label mb-2 text-muted">
                  <Term term="encoding">Encoding</Term>
                </p>
                <SegmentedToggle options={ENCODING_OPTIONS} value={encoding} onChange={setEncoding} layoutId="train-encoding" ariaLabel="Encoding" />
              </div>
              <div>
                <p className="type-label mb-2 text-muted">
                  <Term term="circuit depth">Circuit depth</Term>
                </p>
                <SegmentedToggle options={DEPTH_OPTIONS} value={depth} onChange={setDepth} layoutId="train-depth" ariaLabel="Circuit depth" />
              </div>
              <Slider
                label={<Term term="seed">Seeds</Term>}
                value={seeds}
                min={1}
                max={5}
                step={1}
                onChange={setSeeds}
                format={(v) => `${v} run${v > 1 ? 's' : ''}`}
                hint="More seeds give a more honest average."
              />
            </div>
            <p className="measure mt-6 type-small text-muted">
              Encoding and circuit depth apply to <Term term="vqc">VQC</Term>; <Term term="qsvm">QSVM</Term> keeps its fixed two-repetition ZZ feature
              map. Each model runs on its benchmark backend, so a default run reproduces the Advantage Observatory exactly.
            </p>
            <p className="num mt-4 type-small text-muted">
              config · {selected.size} model{selected.size === 1 ? '' : 's'} · {qubits}q · {encoding} · depth {depth} · {seeds} seed{seeds > 1 ? 's' : ''} ·{' '}
              {datasetId.toUpperCase()}
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Button onClick={start} disabled={busy || selected.size === 0}>
                {phase === 'queued' ? 'Queued…' : phase === 'training' ? 'Training…' : 'Start training →'}
              </Button>
              {selected.size === 0 && <span className="type-small text-muted">Select at least one model.</span>}
            </div>
          </div>
        </PageItem>

        {/* Right: live training */}
        <PageItem as="section" className="col-span-12 xl:col-span-5">
          <SectionHeader index="03" title="Live training" plain="The curve shows the quantum model's error falling as it learns. The solid line is error on training patients, the dashed line on patients it hasn't seen." />
          <div className="mt-6" aria-live="polite">
            <p className="type-label text-muted">{hasCurve ? 'VQC · loss per epoch' : phase === 'idle' ? 'Waiting to start' : 'Classical models · fitting'}</p>
            <p className="mt-3 flex items-baseline gap-3 whitespace-nowrap">
              <span className="type-metric text-muted">EPOCH</span>
              <span className="type-metric-xl text-ink">
                {String(hasCurve ? epoch : phase === 'done' ? totalEpochs : 0).padStart(2, '0')}
                <span className="text-muted">/{totalEpochs}</span>
              </span>
            </p>
            <div className="mt-4 h-px bg-rule" aria-hidden="true">
              <motion.div
                className="h-px bg-accent"
                initial={false}
                animate={{ width: `${(phase === 'done' ? 1 : hasCurve ? epoch / totalEpochs : phase === 'queued' ? 0.04 : 0) * 100}%` }}
                transition={{ duration: 0.12, ease: easePrecise }}
              />
            </div>
          </div>
          <div className="mt-8 h-[18rem]">
            {hasCurve && shown.length > 0 ? (
              <LossChart points={shown} epochs={totalEpochs} />
            ) : (
              <div className="flex h-full items-center justify-center border border-dashed border-rule-strong px-6 text-center">
                <p className="measure type-body text-muted">
                  {phase === 'queued'
                    ? 'Preparing circuits…'
                    : selected.has('vqc')
                      ? 'The VQC loss curve draws here once training starts.'
                      : 'Select VQC to see a live loss curve; the other models train in one step.'}
                </p>
              </div>
            )}
          </div>

          {phase === 'done' && result && (
            <div className="mt-10">
              <p className="type-label text-muted">Results · {result.experimentId}</p>
              <dl className="mt-3 border-t border-rule">
                {result.results.map((r) => (
                  <div key={r.model} className="flex min-h-11 items-center justify-between border-b border-rule py-2">
                    <dt className="flex items-center gap-2.5">
                      <span className={`block h-[8px] w-[8px] shrink-0 ${r.family === 'quantum' ? 'bg-accent' : 'bg-classical'}`} aria-hidden="true" />
                      <span className="flex flex-col">
                        <span className="type-ui text-ink">{MODELS[r.model].name}</span>
                        <span className="num type-small text-muted">
                          {r.qubits ? `${r.qubits}q · ${r.model === 'qsvm' ? `ZZ map · ${r.circuitDepth} reps` : `${r.encoding} · d${r.circuitDepth}`} · ` : ''}
                          {BACKENDS[r.backend].name}
                        </span>
                      </span>
                    </dt>
                    <dd className="num type-ui">
                      <span className={r.model === bestResult?.model ? 'text-accent' : 'text-ink'}>{formatAuc(r.auc.mean)}</span>
                      <span className="ml-2 type-small text-muted">{r.auc.std > 0 ? formatStd(r.auc.std) : 'single seed'}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </PageItem>
      </div>
    </Page>
  )
}
