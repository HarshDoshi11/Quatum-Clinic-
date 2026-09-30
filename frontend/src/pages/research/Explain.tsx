import { ChevronDown, Lock } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useId, useMemo, useState } from 'react'
import { api, isAbortError, useResource } from '@/api'
import { BackendNote } from '@/components/ui/BackendNote'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { formatFeatureValue as formatValue } from '@/components/ui/Field'
import { Glossed } from '@/components/ui/Glossed'
import { AnimatedNumber } from '@/components/ui/Metric'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader, PlainHint } from '@/components/ui/SectionHeader'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { Slider } from '@/components/ui/Slider'
import { Tabs } from '@/components/ui/Tabs'
import { Term } from '@/components/ui/Term'
import { Tooltip } from '@/components/ui/Tooltip'
import { InfluenceBars, type InfluenceRow } from '@/features/explain/InfluenceBars'
import { formatDelta, formatNumber, formatPercent } from '@/lib/format'
import { easePrecise, springEstimate } from '@/lib/motion'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useMode } from '@/state/mode'
import { usePageBackend } from '@/state/pageBackend'
import { PATIENT_SOURCE_LABEL, useCurrentPatient } from '@/state/patient'
import type { DatasetId, ExplainResponse, FeatureContribution, FeatureSpec, PatientInput } from '@/types'

/** ≥ 40px between the right column's groups; the SectionHeader draws the one hairline. */
const GROUP = 'mt-10'

// ─── Left: one control per feature ──────────────────────────

function Control({
  feature: f,
  value,
  was,
  used,
  onChange,
}: {
  feature: FeatureSpec
  value: number | null
  was: number | null
  used: FeatureContribution | undefined
  onChange: (v: number) => void
}) {
  const labelId = useId()
  const changed = value !== was
  // Secondary text only when needed: what it was, or what the pipeline did with a missing or out-of-range entry.
  const hint = changed
    ? `Was ${formatValue(f, was)}`
    : used?.adjustment === 'imputed'
      ? 'Not recorded · the model used the training average'
      : used?.adjustment === 'clipped'
        ? `Entered ${formatValue(f, was)} · clipped to the training range`
        : null

  if (f.options) {
    return (
      <div>
        <div className="flex items-baseline justify-between gap-4">
          <span id={labelId} className="type-label text-muted">
            {f.label}
          </span>
          <AnimatePresence>
            {hint && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="type-small text-muted">
                {hint}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-2">
          <SegmentedControl labelledBy={labelId} options={f.options} value={value === null ? null : Math.round(value)} onChange={onChange} changed={changed} />
        </div>
      </div>
    )
  }
  // A missing or out-of-range value starts where the pipeline put it (training average / clipped).
  const position = value ?? used?.used ?? f.min
  return (
    <Slider
      label={f.label}
      value={Math.min(f.max, Math.max(f.min, position))}
      min={f.min}
      max={f.max}
      step={f.step}
      onChange={onChange}
      format={(v) => formatValue(f, v)}
      hint={hint ?? undefined}
      countUp
      changed={changed}
    />
  )
}

/** "FIXED · Age 58 · Male": locked inputs in one line (no sliders), with why. */
function FixedLine({ features, input }: { features: FeatureSpec[]; input: PatientInput }) {
  return (
    <Tooltip content="A patient can’t change these." width={220}>
      <p tabIndex={0} className="flex w-fit cursor-help items-center gap-2 type-label text-muted outline-none" data-tour="explain-fixed">
        <Lock size="0.8125rem" strokeWidth={1.5} aria-label="Locked" />
        <span>Fixed</span>
        {features.map((f) => (
          <span key={f.key}>
            <span aria-hidden="true">· </span>
            <span className="text-ink normal-case">
              {f.options ? formatValue(f, input[f.key] ?? null) : `${f.label} ${formatValue(f, input[f.key] ?? null)}`}
            </span>
          </span>
        ))}
      </p>
    </Tooltip>
  )
}

// ─── Right: abstain ─────────────────────────────────────────

/** Research Mode only, off by default: reveals the raw output, labelled as not reported. */
function RawSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle} className="flex shrink-0 items-center gap-2 type-small text-muted transition-colors duration-150 hover:text-ink">
      <span className={`relative block h-4 w-7 rounded-[2px] border border-ink ${on ? 'bg-ink' : ''}`} aria-hidden="true">
        <span className={`absolute top-[2px] block h-2.5 w-2.5 transition-[left] duration-200 ${on ? 'left-[0.8rem] bg-bg' : 'left-[2px] bg-ink'}`} />
      </span>
      Show raw model estimate
    </button>
  )
}

/** Why the system declined: the notice, then at most two reasons (the rest behind "Show N more"). */
function AbstainNotice({ reasons }: { reasons: string[] }) {
  const [all, setAll] = useState(false)
  const shown = all || reasons.length <= 2 ? reasons : reasons.slice(0, 2)
  return (
    <div className="mt-2" role="note">
      <p className="type-small text-ink">The system declined to answer for this patient. The bars below show what the model looked at, not a result.</p>
      <ul className="mt-1 flex flex-col">
        {shown.map((r) => (
          <li key={r} className="flex gap-2 type-small text-muted">
            <span className="mt-[0.55rem] block h-1 w-1 shrink-0 bg-muted" aria-hidden="true" />
            <span>
              <Glossed text={r} />
            </span>
          </li>
        ))}
      </ul>
      {reasons.length > 2 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="type-label text-ink underline-offset-4 transition-colors duration-150 hover:underline">
          {all ? 'Show fewer' : `Show ${reasons.length - 2} more`}
        </button>
      )}
    </div>
  )
}

// ─── Right: the quantum input strip ─────────────────────────

function EncodingPanel({ now, original }: { now: ExplainResponse | null; original: ExplainResponse | undefined }) {
  const [open, setOpen] = useState(false)
  const reduced = useReducedMotion() ?? false
  const panelId = useId()
  return (
    <div className="border-t border-rule pt-5">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panelId} className="flex w-full items-center justify-between gap-4 text-left">
        <span className="type-label text-muted">
          <span className="text-ink">04</span> — What the quantum circuit receives
        </span>
        <ChevronDown size="0.875rem" strokeWidth={1.5} className={`text-muted transition-transform duration-250 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.25, ease: easePrecise }}
            className="overflow-hidden"
          >
            <p className="measure pt-4 type-small text-muted">
              Your values are cleaned, scaled and compressed (<Term term="pca">PCA</Term>) into four numbers, one per <Term term="qubit">qubit</Term>, exactly like
              training data. The thin line marks where each one started.
            </p>
            <div className="mt-4 flex flex-col gap-4 pb-1">
              {now
                ? now.encoding.map((c, k) => {
                    const was = original?.encoding[k]?.value
                    return (
                      <div key={c.component}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="type-small text-ink">
                            <span className="num text-muted">Q{k}</span> {c.label}
                          </span>
                          <span className="num type-small text-accent">{formatNumber(c.value, 2)}</span>
                        </div>
                        <div className="relative mt-1.5 h-[0.375rem] bg-rule" aria-hidden="true">
                          <motion.div className="absolute inset-y-0 left-0 bg-accent" initial={false} animate={{ width: `${c.value * 100}%` }} transition={reduced ? { duration: 0 } : { duration: 0.3, ease: easePrecise }} />
                          {was !== undefined && Math.abs(was - c.value) > 0.005 && <div className="absolute -inset-y-1 w-px bg-ink" style={{ left: `${was * 100}%` }} />}
                        </div>
                      </div>
                    )
                  })
                : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} width="100%" height="1.75rem" />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
  const { mode } = useMode()
  const originalData = original.data?.dataset === datasetId ? original.data : undefined
  // Same abstain rule as Predict: the explanation says whether this patient gets a reported result.
  const abstains = originalData?.decision === 'abstain'
  // Research Mode only, off by default: the raw output, clearly labelled as not reported.
  const [showRaw, setShowRaw] = useState(false)
  const rawAllowed = mode === 'research'
  usePageBackend(originalData?.backend, originalData?.qubits)
  const usedOriginal = useMemo(() => new Map((originalData?.contributions ?? []).map((c) => [c.feature, c])), [originalData])
  const originalEffects = useMemo(() => new Map((originalData?.contributions ?? []).map((c) => [c.feature, c.effect])), [originalData])

  // What-if draft: always the ORIGINAL features. Every change is sent to /explain,
  // which runs it through the same preprocessing and PCA as training.
  const [draft, setDraft] = useState<Draft | null>(null)
  useEffect(() => {
    if (patient) setDraft({ dataset: datasetId, values: patient })
  }, [patient, datasetId])
  const debounced = useDebouncedValue(draft, 80)
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

  const rows: InfluenceRow[] = useMemo(() => {
    if (!current) return []
    const spec = new Map(features.map((f) => [f.key, f]))
    return current.contributions.map((c) => {
      const f = spec.get(c.feature)
      return { ...c, display: f ? formatValue(f, c.used) : String(c.used) }
    })
  }, [current, features])

  // Locked inputs (from the dataset config) are one line, not controls; the rest are tabs by group.
  const locked = features.filter((f) => f.locked)
  const groups = useMemo(() => {
    const out = new Map<string, FeatureSpec[]>()
    for (const f of features) if (!f.locked) out.set(f.group, [...(out.get(f.group) ?? []), f])
    return [...out.entries()]
  }, [features])
  const [tab, setTab] = useState<{ dataset: DatasetId; group: string } | null>(null)
  const activeGroup = tab?.dataset === datasetId && groups.some(([g]) => g === tab.group) ? tab.group : groups[0]?.[0]

  if (schema.status === 'error' || original.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn't load the explanation." body={(schema.error ?? original.error)?.message} />
      </Page>
    )
  }

  const nowAbstains = current?.decision === 'abstain'
  const before = originalData?.probability ?? null
  const after = current?.probability ?? null
  const isChanged = changed.length > 0

  return (
    <Page label={route.label} className="!pt-6">
      <PageItem as="header">
        <PageHeader route={route} source={originalData?.source} compact>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {originalData && <ExperimentTag id={originalData.experimentId} detail="QSVM · explanation" />}
            {originalData && <BackendNote backend={originalData.backend} model={originalData.model} qubits={originalData.qubits} />}
          </div>
        </PageHeader>
      </PageItem>

      <PageItem className="@container mt-4">
        <div className="grid grid-cols-1 gap-x-16 gap-y-12 [grid-template-areas:'result'_'controls'] @min-[60rem]:grid-cols-[minmax(0,40fr)_minmax(0,60fr)] @min-[60rem]:[grid-template-areas:'controls_result']">
          {/* 01 — controls: the hero is the active group */}
          <section className="[grid-area:controls]" aria-label="What if" data-tour="whatif">
            <SectionHeader
              index="01"
              title="What if?"
              compact
              plain="Change the patient's original results and watch the estimate update. Each change is cleaned and compressed exactly as the training data was before the model sees it."
              aside={
                selected && (
                  <ButtonLink to="/predict" variant="ghost" size="sm" className="!h-auto !px-0 type-label text-muted underline-offset-4 hover:underline">
                    {PATIENT_SOURCE_LABEL[selected.source]} ↗
                  </ButtonLink>
                )
              }
            />
            <div className="mt-4">
              {patient && draft && features.length > 0 ? (
                <>
                  {locked.length > 0 ? (
                    <FixedLine features={locked} input={patient} />
                  ) : (
                    config?.explainCaption && (
                      <p className="measure type-small text-muted" data-tour="explain-caption">
                        <Glossed text={config.explainCaption} />
                      </p>
                    )
                  )}
                  <div className="mt-5">
                    {activeGroup && (
                      <Tabs<string>
                        ariaLabel="Input groups"
                        value={activeGroup}
                        onChange={(g) => setTab({ dataset: datasetId, group: g })}
                        items={groups.map(([g, fs]) => ({
                          value: g,
                          label: g,
                          mark: fs.some((f) => draft.values[f.key] !== patient[f.key]) ? 'changed' : undefined,
                          panel: (
                            <div className="flex flex-col gap-7">
                              {fs.map((f) => (
                                <Control
                                  key={f.key}
                                  feature={f}
                                  value={draft.values[f.key] ?? null}
                                  was={patient[f.key] ?? null}
                                  used={usedOriginal.get(f.key)}
                                  onChange={(v) => set(f.key, v)}
                                />
                              ))}
                            </div>
                          ),
                        }))}
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-6" aria-hidden="true">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} width="100%" height="2.5rem" />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Right: estimate (hero), influence, quantum input — sticky while the controls change */}
          <aside className="self-start [grid-area:result] @min-[60rem]:sticky @min-[60rem]:top-4" aria-label="What-if result">
            <SectionHeader
              index="02"
              title={`Estimate · probability of ${config ? config.classBalance.positiveLabel.toLowerCase() : 'disease'}`}
              compact
              plain="The model's estimate for this patient, and how your changes move it."
            />
            <div className="mt-4" aria-live="polite">
              {current && originalData ? (
                <>
                  <p className="flex items-baseline gap-3 whitespace-nowrap">
                    {nowAbstains || after === null ? (
                      // Still abstained: no reported number, whatever the controls say.
                      <span className="flex w-full items-baseline justify-between gap-4">
                        <span className="type-metric text-ink">No reliable answer</span>
                        {rawAllowed && <RawSwitch on={showRaw} onToggle={() => setShowRaw((v) => !v)} />}
                      </span>
                    ) : (
                      <>
                        <span className={`type-metric transition-colors duration-150 ${isChanged ? 'text-muted' : 'text-ink'}`}>{before === null ? 'No answer' : formatPercent(before)}</span>
                        <AnimatePresence initial={false}>
                          {isChanged && (
                            <motion.span className="flex items-baseline gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                              <span className="type-metric text-muted" aria-hidden="true">
                                →
                              </span>
                              <span className="type-metric text-ink">
                                <AnimatedNumber value={after} from={before ?? after} format={(v) => formatPercent(v)} spring={springEstimate} />
                              </span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </>
                    )}
                  </p>

                  {/* The delta line fades in with the first change and out on reset */}
                  <div className={`mt-1 ${nowAbstains ? '' : 'min-h-[1.5rem]'}`}>
                    <AnimatePresence initial={false}>
                      {isChanged && (
                        <motion.div
                          className="flex items-baseline justify-between gap-4"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <span className={`num type-small ${before !== null && after !== null && after > before + 1e-9 ? 'text-risk-high-text' : 'text-muted'}`}>
                            {nowAbstains
                              ? `Still abstaining · ${changed.length} input${changed.length > 1 ? 's' : ''} changed`
                              : before === null
                                ? `Back within range · ${changed.length} input${changed.length > 1 ? 's' : ''} changed`
                                : `${formatDelta(((after ?? 0) - before) * 100, 1)} pts · ${changed.length} input${changed.length > 1 ? 's' : ''} changed`}
                          </span>
                          <button type="button" onClick={reset} className="type-label shrink-0 text-ink underline-offset-4 transition-colors duration-150 hover:underline">
                            Reset to this patient
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {rawAllowed && nowAbstains && showRaw && (
                    <p className="num mt-1 flex items-baseline gap-2 type-small text-muted">
                      <span className="type-label">Raw estimate · not reported</span>
                      {formatPercent(originalData.rawProbability)}
                      {isChanged && (
                        <>
                          <span aria-hidden="true">→</span>
                          <span className="text-ink">{formatPercent(current.rawProbability)}</span>
                        </>
                      )}
                    </p>
                  )}

                  {abstains && !isChanged && <AbstainNotice reasons={originalData.abstainReasons} />}
                </>
              ) : (
                <div className="flex flex-col gap-3" aria-hidden="true">
                  <Skeleton width="50%" height="2.5rem" />
                  <Skeleton width="40%" />
                </div>
              )}
            </div>

            <div className={GROUP} data-tour="explain-chart">
              <SectionHeader
                index="03"
                title="What moved it"
                compact
                plain="Each bar shows how many percentage points one of the patient's results adds to or takes off the estimate, compared with an average patient."
              />
              <div className="mt-4">
                {liveError ? (
                  <EmptyState tone="error" title="Couldn't explain these values." body={liveError.message} />
                ) : current ? (
                  <InfluenceBars rows={rows} original={originalEffects} takeaway={current.takeaway} evaluation={current.evaluation} baseProbability={current.baseProbability} />
                ) : (
                  <Skeleton width="100%" height="14rem" />
                )}
              </div>
            </div>

            <div className={GROUP}>
              <EncodingPanel now={current} original={originalData} />
            </div>
          </aside>
        </div>
      </PageItem>

      <PageItem as="footer" className="mt-20 border-t border-rule pt-5">
        <p className="flex items-center gap-2 type-label text-muted">
          Model simulation, not medical advice.
          <PlainHint>Changing a value here does not change the patient: it shows how the model responds.</PlainHint>
        </p>
      </PageItem>
    </Page>
  )
}
