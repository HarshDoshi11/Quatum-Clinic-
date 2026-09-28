import { Lock } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, isAbortError, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, TICK, niceScale, useChartUnits } from '@/components/charts/chartTheme'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { formatFeatureValue as formatValue } from '@/components/ui/Field'
import { Glossed } from '@/components/ui/Glossed'
import type { Column } from '@/components/ui/HairlineTable'
import { AnimatedNumber } from '@/components/ui/Metric'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Slider } from '@/components/ui/Slider'
import { Term } from '@/components/ui/Term'
import { formatDelta, formatPercent } from '@/lib/format'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { PATIENT_SOURCE_LABEL, useCurrentPatient } from '@/state/patient'
import type { DatasetId, ExplainResponse, FeatureContribution, FeatureSpec, PatientInput } from '@/types'

const ROW_REM = 2.25

// ─── Fig. 01 — contributions ────────────────────────────────

type ContributionRow = FeatureContribution & { display: string }

function ContributionChart({ rows, floor }: { rows: ContributionRow[]; floor: number }) {
  const reduced = useReducedMotion() ?? false
  const units = useChartUnits()
  // The axis never shrinks below the original patient's range, so bars stay comparable while you drag.
  const m = Math.max(0.05, floor, ...rows.map((r) => Math.abs(r.contribution)))
  const { domain, ticks } = niceScale(-m, m, 4)
  const lockedLabels = new Set(rows.filter((r) => r.locked).map((r) => r.label))
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 8, right: units.rem * 4, bottom: 8, left: 8 }} barCategoryGap="28%">
        <CartesianGrid horizontal={false} stroke={C.rule} />
        <XAxis
          {...AXIS}
          type="number"
          domain={domain}
          ticks={ticks}
          tickFormatter={(v: number) => (v === 0 ? '0' : formatDelta(v, 1))}
          height={units.rem * 2.75}
          label={{ value: 'Push on the estimate (log-odds)', position: 'insideBottom', offset: 0, fill: C.muted, fontSize: '0.8125rem', fontFamily: 'var(--font-mono)' }}
        />
        <YAxis
          {...AXIS}
          type="category"
          dataKey="label"
          width={units.rem * 12}
          tickFormatter={(v: string) => (lockedLabels.has(v) ? `${v} · locked` : v)}
        />
        <ReferenceLine x={0} stroke={C.ink} />
        <Tooltip
          cursor={{ fill: 'var(--surface)' }}
          content={({ active, payload }) => {
            const r = active ? (payload?.[0]?.payload as ContributionRow | undefined) : undefined
            if (!r) return null
            return (
              <ChartTooltipCard
                title={`${r.label}${r.locked ? ' · locked' : ''}`}
                rows={[
                  { key: 'v', label: 'Value used', value: r.display },
                  { key: 'c', color: r.contribution >= 0 ? C.riskHigh : C.riskLow, label: r.contribution >= 0 ? 'Raises risk' : 'Lowers risk', value: formatDelta(r.contribution, 2) },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="contribution" isAnimationActive={!reduced} animationDuration={300}>
          {rows.map((r) => (
            <Cell key={r.feature} fill={r.contribution >= 0 ? C.riskHigh : C.riskLow} />
          ))}
          <LabelList
            dataKey="contribution"
            content={({ x, y, width, height, value }) => {
              const v = Number(value)
              const [bx, by, bw, bh] = [Number(x), Number(y), Number(width), Number(height)]
              const end = bx + bw
              const gap = units.rem * 0.375
              return (
                <text x={v >= 0 ? end + gap : end - gap} y={by + bh / 2} dy="0.35em" textAnchor={v >= 0 ? 'start' : 'end'} {...TICK} fill={C.ink}>
                  {formatDelta(v, 2)}
                </text>
              )
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── What the circuit receives ──────────────────────────────

function EncodingStrip({ now, original }: { now: ExplainResponse; original: ExplainResponse | undefined }) {
  return (
    <div className="border-t border-rule">
      {now.encoding.map((c, k) => {
        const was = original?.encoding[k]?.value
        return (
          <div key={c.component} className="border-b border-rule py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="type-small text-ink">
                <span className="num text-muted">Q{k} · PC{c.component}</span> · {c.label}
              </span>
              <span className="num type-small text-ink">{c.value.toFixed(2)}</span>
            </div>
            <div className="relative mt-2 h-[0.375rem] bg-rule" aria-hidden="true">
              <div className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-300" style={{ width: `${c.value * 100}%` }} />
              {was !== undefined && was !== c.value && <div className="absolute -inset-y-1 w-px bg-ink" style={{ left: `${was * 100}%` }} title="Before your changes" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────

interface Draft {
  dataset: DatasetId
  values: PatientInput
}

export function Explain({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const datasets = useResource((signal) => api.listDatasets({ signal }), [version])
  const config = datasets.data?.find((d) => d.id === datasetId)
  const { patient: selected } = useCurrentPatient(datasetId, schema.data)
  const patient = selected?.input
  const original = useResource(
    (signal) => (patient ? api.explain({ dataset: datasetId, input: patient }, { signal }) : new Promise<never>(() => {})),
    [datasetId, version, patient],
  )
  // Would Predict give a number for this patient? If it abstains, the bars explain an estimate the system withholds.
  const decision = useResource(
    (signal) => (patient ? api.predict({ dataset: datasetId, input: patient }, { signal }) : new Promise<never>(() => {})),
    [datasetId, version, patient],
  )
  const abstains = decision.data?.dataset === datasetId && decision.data.decision === 'abstain'
  const usedOriginal = useMemo(() => new Map((original.data?.contributions ?? []).map((c) => [c.feature, c])), [original.data])

  // What-if draft: always the ORIGINAL features. Every change is sent to /explain,
  // which runs it through the same preprocessing and PCA as training.
  const [draft, setDraft] = useState<Draft | null>(null)
  useEffect(() => {
    if (patient) setDraft({ dataset: datasetId, values: patient })
  }, [patient, datasetId])
  const debounced = useDebouncedValue(draft, 120)
  const [live, setLive] = useState<ExplainResponse | null>(null)
  const [liveError, setLiveError] = useState<Error | null>(null)
  useEffect(() => {
    if (!debounced || debounced.dataset !== datasetId) return
    const controller = new AbortController()
    api.explain({ dataset: debounced.dataset, input: debounced.values }, { signal: controller.signal }).then(
      (res) => {
        setLive(res)
        setLiveError(null)
      },
      (error: unknown) => {
        if (!controller.signal.aborted && !isAbortError(error)) setLiveError(error instanceof Error ? error : new Error(String(error)))
      },
    )
    return () => controller.abort()
  }, [debounced, datasetId, version])

  const features = useMemo(() => schema.data?.features ?? [], [schema.data])
  const current = live && live.dataset === datasetId ? live : null
  const changed = draft && patient ? features.filter((f) => draft.values[f.key] !== patient[f.key]) : []
  const set = (key: string, value: number) => setDraft((d) => (d ? { ...d, values: { ...d.values, [key]: value } } : d))
  const reset = () => patient && setDraft({ dataset: datasetId, values: patient })

  // Rows keep the original patient's order, so bars don't jump around while you drag.
  const rows: ContributionRow[] = useMemo(() => {
    if (!current) return []
    const order = new Map((original.data?.contributions ?? current.contributions).map((c, i) => [c.feature, i]))
    const spec = new Map(features.map((f) => [f.key, f]))
    return [...current.contributions]
      .sort((a, b) => (order.get(a.feature) ?? 0) - (order.get(b.feature) ?? 0))
      .map((c) => {
        const f = spec.get(c.feature)
        return { ...c, display: f ? formatValue(f, c.used) : String(c.used) }
      })
  }, [current, original.data, features])

  const columns: Column<ContributionRow>[] = [
    { key: 'f', header: 'Input', render: (r) => `${r.label}${r.locked ? ' · locked' : ''}` },
    { key: 'v', header: 'Value used', mono: true, render: (r) => `${r.display}${r.adjustment ? ` (${r.adjustment})` : ''}` },
    { key: 'c', header: 'Push (log-odds)', align: 'right', mono: true, render: (r) => formatDelta(r.contribution, 2) },
  ]

  const groups = useMemo(() => {
    const out = new Map<string, FeatureSpec[]>()
    for (const f of features) out.set(f.group, [...(out.get(f.group) ?? []), f])
    return [...out.entries()]
  }, [features])

  if (schema.status === 'error' || original.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn't load the explanation." body={(schema.error ?? original.error)?.message} />
      </Page>
    )
  }

  const before = original.data?.probability
  const now = current?.probability

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route}>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {original.data && <ExperimentTag id={original.data.experimentId} detail="QSVM · explanation" />}
            {selected && (
              <span className="type-label text-muted">
                {PATIENT_SOURCE_LABEL[selected.source]} · set on{' '}
                <ButtonLink to="/predict" variant="ghost" size="sm" className="!h-auto !px-0 underline-offset-4 hover:underline">
                  Predict &amp; Trust
                </ButtonLink>
              </span>
            )}
          </div>
        </PageHeader>
      </PageItem>

      <PageItem as="section" className="mt-20">
        <SectionHeader
          index="01"
          title="What moved this estimate"
          plain="Each bar shows how much one of the patient's results pushed the estimate up or down, compared with an average patient."
        />
        {abstains && decision.data && (
          <div className="measure mt-8 border-l-2 border-ink pl-4">
            <p className="type-ui text-ink">
              For this patient the system <Term term="abstain">abstains</Term>: it would not give an estimate.
            </p>
            <p className="mt-1 type-small text-muted">
              <Glossed text={decision.data.abstainReasons.join(' ')} /> The bars below show what the model would lean on after cleaning (missing values
              filled with the training average, out-of-range values clipped), not a result to act on.
            </p>
          </div>
        )}
        <div className="mt-8" data-tour="explain-chart">
          {liveError ? (
            <EmptyState tone="error" title="Couldn't explain these values." body={liveError.message} />
          ) : (
            <ChartFigure<ContributionRow>
              label={`Fig. 01 — Push of each input on the estimate · ${selected ? PATIENT_SOURCE_LABEL[selected.source].toLowerCase() : 'patient'}`}
              subtitle={current?.evaluation}
              takeaway={current?.takeaway}
              caption={
                <>
                  Bars to the right raise the risk estimate, bars to the left lower it. The model only sees the{' '}
                  <Term term="pca">PCA</Term> components; each component’s effect is traced back to the original inputs, so the bars add up exactly to
                  the gap between this patient and an average one, measured in <Term term="log-odds">log-odds</Term>.
                </>
              }
              legend={[
                { key: 'u', label: 'Raises risk', color: C.riskHigh, shape: 'square' },
                { key: 'd', label: 'Lowers risk', color: C.riskLow, shape: 'square' },
              ]}
              loading={!current}
              height={`${Math.max(features.length, 6) * ROW_REM + 4}rem`}
              table={{ columns, rows, rowKey: (r) => r.feature, caption: 'Push of each input on the estimate, in log-odds' }}
            >
              {current && <ContributionChart rows={rows} floor={Math.max(0, ...(original.data?.contributions ?? []).map((c) => Math.abs(c.contribution)))} />}
            </ChartFigure>
          )}
        </div>
      </PageItem>

      <PageItem as="section" className="mt-24">
        <SectionHeader
          index="02"
          title="What if?"
          plain="Change the patient's original results and watch the estimate update. Each change is cleaned and compressed exactly as the training data was before the model sees it."
        />
        {config?.explainCaption && (
          <p className="measure mt-6 type-body-lg text-ink" data-tour="explain-caption">
            <Glossed text={config.explainCaption} />
          </p>
        )}

        <div className="grid-12 mt-8 gap-y-12">
          {/* Sliders over the original features */}
          <div className="col-span-12 xl:col-span-7" data-tour="whatif">
            {draft && patient ? (
              groups.map(([group, fs]) => (
                <fieldset key={group} className="mb-10">
                  <legend className="type-label mb-4 text-muted">{group}</legend>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
                    {fs.map((f) => {
                      const was = patient[f.key] ?? null
                      const used = usedOriginal.get(f.key)
                      // A missing or out-of-range value starts where the pipeline put it (training average / clipped).
                      const value = draft.values[f.key] ?? used?.used ?? f.min
                      const isChanged = draft.values[f.key] !== was
                      const hint = f.locked
                        ? 'A patient can’t change this.'
                        : isChanged
                          ? `Was ${formatValue(f, was)}`
                          : used?.adjustment === 'imputed'
                            ? 'Missing · the model used the training average'
                            : used?.adjustment === 'clipped'
                              ? `Entered ${formatValue(f, was)} · clipped to the training range`
                              : undefined
                      return (
                        <Slider
                          key={f.key}
                          label={
                            <span className="inline-flex items-baseline gap-2">
                              {f.label}
                              {f.locked && <Lock size="0.8125rem" strokeWidth={1.5} className="text-muted" aria-label="Locked" />}
                            </span>
                          }
                          value={value}
                          min={f.min}
                          max={f.max}
                          step={f.step}
                          disabled={f.locked}
                          onChange={(v) => set(f.key, v)}
                          format={(v) => formatValue(f, v)}
                          hint={hint}
                        />
                      )
                    })}
                  </div>
                </fieldset>
              ))
            ) : (
              <div className="flex flex-col gap-6" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} width="100%" height="2.5rem" />
                ))}
              </div>
            )}
          </div>

          {/* Live readout */}
          <aside className="col-span-12 xl:col-span-5" aria-live="polite" aria-label="What-if result">
            <div className="xl:sticky xl:top-8">
              <p className="type-label text-muted">
                Estimate · probability of {config ? config.classBalance.positiveLabel.toLowerCase() : 'disease'}
                {abstains && ' · withheld on Predict'}
              </p>
              {before !== undefined && now !== undefined ? (
                <>
                  <p className="mt-3 flex items-baseline gap-3 whitespace-nowrap">
                    <span className="type-metric text-muted">{formatPercent(before)}</span>
                    <span className="type-metric text-muted" aria-hidden="true">
                      →
                    </span>
                    <span className="type-metric text-ink">
                      <AnimatedNumber value={now} from={before} format={(v) => formatPercent(v)} />
                    </span>
                  </p>
                  <p className={`num mt-1 type-small ${now > before + 1e-9 ? 'text-risk-high' : 'text-muted'}`}>
                    {changed.length === 0 ? 'No changes yet' : `${formatDelta((now - before) * 100, 1)} pts vs this patient · ${changed.length} input${changed.length > 1 ? 's' : ''} changed`}
                  </p>
                  <p className="mt-3 type-small text-muted">
                    An average patient scores <span className="num">{formatPercent(current?.baseProbability ?? 0)}</span>.
                  </p>
                  <div className="mt-4">
                    <Button variant="outline" size="sm" onClick={reset} disabled={changed.length === 0}>
                      Reset to this patient
                    </Button>
                  </div>
                </>
              ) : (
                <div className="mt-3 flex flex-col gap-3" aria-hidden="true">
                  <Skeleton width="70%" height="2.5rem" />
                  <Skeleton width="50%" />
                </div>
              )}

              <p className="type-label mt-10 mb-3 text-muted">
                What the quantum circuit receives · <Term term="pca">PCA</Term> → <Term term="encoding">angle encoding</Term>
              </p>
              {current ? <EncodingStrip now={current} original={original.data} /> : <Skeleton width="100%" height="8rem" />}
              <p className="measure mt-3 type-small text-muted">
                Your changes are cleaned, scaled and compressed into four numbers, one per <Term term="qubit">qubit</Term>, exactly like training data. The
                thin line marks where each one started.
              </p>
              <p className="type-label mt-6 text-muted">Model simulation, not medical advice.</p>
            </div>
          </aside>
        </div>
      </PageItem>
    </Page>
  )
}
