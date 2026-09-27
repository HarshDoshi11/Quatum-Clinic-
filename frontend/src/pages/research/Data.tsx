import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useResource } from '@/api'
import { ChartFigure } from '@/components/charts/ChartFigure'
import { ChartTooltipCard } from '@/components/charts/ChartTooltip'
import { AXIS, C, DRAW_MS, TICK } from '@/components/charts/chartTheme'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import type { Column } from '@/components/ui/HairlineTable'
import { Metric } from '@/components/ui/Metric'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Term } from '@/components/ui/Term'
import { useToast } from '@/components/ui/Toast'
import { PREPROCESS_STEP_MS, PreprocessRail } from '@/features/data/PreprocessRail'
import { formatPercent } from '@/lib/format'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import type { ColumnInfo, ColumnType, DataRow, PcaComponent, UploadResponse } from '@/types'

type Profile = Pick<UploadResponse['detail'], 'name' | 'samples' | 'features' | 'missingValues' | 'classBalance' | 'columns' | 'preview' | 'source'>

// ─── Upload ─────────────────────────────────────────────────

function UploadZone({ onFile, busy }: { onFile: (file: File) => void; busy: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setOver(false)
    take(e.dataTransfer.files)
  }
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a CSV file"
      aria-busy={busy}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`flex cursor-pointer flex-col items-start gap-3 border border-dashed px-8 py-10 transition-colors ${
        over ? 'border-accent bg-surface' : 'border-rule-strong hover:border-ink'
      }`}
    >
      <p className="type-label text-muted">{busy ? 'Reading file…' : 'CSV · drag and drop, or click to choose'}</p>
      <p className="type-h2 text-ink">Drop patient records here.</p>
      <p className="measure type-body text-muted">
        One row per patient, one column per measurement, plus a target column (e.g. <span className="num">diagnosis</span> or{' '}
        <span className="num">target</span>). Files stay in your browser in mock mode.
      </p>
      <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} onChange={(e) => take(e.target.files)} />
    </div>
  )
}

// ─── Profile ────────────────────────────────────────────────

const TYPE_BADGE: Record<ColumnType, string> = { numeric: 'Num', categorical: 'Cat', binary: 'Bin' }

function PreviewTable({ columns, rows }: { columns: ColumnInfo[]; rows: DataRow[] }) {
  const fmt = (v: DataRow[string]) => (v === null || v === undefined ? '—' : typeof v === 'number' ? String(Number(v.toFixed(4))) : v)
  return (
    <div className="overflow-x-auto border-b border-rule" tabIndex={0} role="region" aria-label="Data preview, scrolls horizontally">
      <table className="type-ui w-max min-w-full border-collapse tabular-nums">
        <caption className="sr-only">First {rows.length} rows of the dataset</caption>
        <thead>
          <tr className="border-b border-rule-strong">
            {columns.map((c) => (
              <th key={c.name} scope="col" className="py-3 pr-6 text-left align-bottom font-normal">
                <span className={`type-label block whitespace-nowrap ${c.isTarget ? 'text-accent' : 'text-muted'}`}>{c.name}</span>
                <span className="mt-1.5 flex gap-1.5">
                  <span className={`type-label rounded-[2px] border px-1 ${c.isTarget ? 'border-accent text-accent' : 'border-rule-strong text-muted'}`}>
                    {TYPE_BADGE[c.type]}
                  </span>
                  {c.isTarget && <span className="type-label rounded-[2px] bg-accent px-1 text-accent-ink">Target</span>}
                  {c.missing > 0 && <span className="type-label rounded-[2px] border border-risk-mid px-1 text-ink">{c.missing} missing</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="h-11 border-b border-rule last:border-b-0">
              {columns.map((c) => (
                <td key={c.name} className={`num py-2 pr-6 whitespace-nowrap ${c.isTarget ? 'text-accent' : r[c.name] === null ? 'text-muted' : 'text-ink'}`}>
                  {fmt(r[c.name])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Stat({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="border-t border-rule pt-4">
      <p className="type-label text-muted">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function ProfileView({ profile }: { profile: Profile }) {
  const { positive, negative, positiveLabel, negativeLabel } = profile.classBalance
  const share = positive + negative > 0 ? positive / (positive + negative) : 0
  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-10 xl:grid-cols-4">
        <Stat label="Patients (samples)">
          <Metric size="xl" value={profile.samples} format={(n) => String(Math.round(n))} />
        </Stat>
        <Stat label="Features">
          <Metric size="xl" value={profile.features} format={(n) => String(Math.round(n))} />
        </Stat>
        <Stat label="Missing values">
          <Metric size="xl" value={profile.missingValues} format={(n) => String(Math.round(n))} />
        </Stat>
        <Stat label={`Class balance · ${positiveLabel}`}>
          <Metric size="xl" value={share} format={(n) => formatPercent(n)} />
          <p className="num mt-2 type-small text-muted">
            {positive} {positiveLabel.toLowerCase()} · {negative} {negativeLabel.toLowerCase()}
          </p>
        </Stat>
      </div>
      <div className="mt-12">
        <p className="type-label mb-3 text-muted">Preview · first {profile.preview.length} rows · scroll sideways for all columns</p>
        <PreviewTable columns={profile.columns} rows={profile.preview} />
      </div>
    </>
  )
}

// ─── PCA chart ──────────────────────────────────────────────

function PcaChart({ pca, kept }: { pca: PcaComponent[]; kept: number }) {
  const reduced = useReducedMotion() ?? false
  const data = pca.map((c) => ({ ...c, name: `PC${c.component}` }))
  const at = data[kept - 1]
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 28, right: 24, bottom: 8, left: 8 }}>
        <CartesianGrid vertical={false} stroke={C.rule} />
        <XAxis {...AXIS} dataKey="name" height={32} />
        <YAxis {...AXIS} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} width={52} />
        <Tooltip
          cursor={{ fill: 'var(--surface)' }}
          content={({ active, payload }) => {
            const c = active ? (payload?.[0]?.payload as (PcaComponent & { name: string }) | undefined) : undefined
            if (!c) return null
            return (
              <ChartTooltipCard
                title={`${c.name} · ${c.label}`}
                rows={[
                  { key: 'e', color: c.component <= kept ? C.accent : C.classical, label: 'Explains', value: formatPercent(c.explained) },
                  { key: 'c', color: C.ink, label: 'Cumulative', value: formatPercent(c.cumulative) },
                ]}
              />
            )
          }}
        />
        <Bar dataKey="explained" maxBarSize={44} isAnimationActive={!reduced} animationDuration={DRAW_MS}>
          {data.map((c) => (
            <Cell key={c.component} fill={c.component <= kept ? C.accent : C.classical} />
          ))}
        </Bar>
        <Line dataKey="cumulative" type="monotone" stroke={C.ink} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: C.bg }} isAnimationActive={!reduced} animationDuration={DRAW_MS} />
        {at && (
          <ReferenceLine
            x={at.name}
            stroke={C.ink}
            strokeDasharray="4 4"
            label={{ value: `${kept} qubits keep ${formatPercent(at.cumulative, 0)}`, position: 'top', ...TICK, fill: C.ink }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Page ───────────────────────────────────────────────────

export function Data({ route }: { route: RouteMeta }) {
  const { datasetId, dataset } = useDataset()
  const { toast } = useToast()
  const reduced = useReducedMotion() ?? false
  const detail = useResource((signal) => api.getDataset(datasetId, { signal }), [datasetId])
  const d = detail.data
  const [upload, setUpload] = useState<UploadResponse | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(-1)
  const [running, setRunning] = useState(false)
  const steps = useMemo(() => d?.preprocessing.steps ?? [], [d])

  // New dataset → reset the pipeline and any uploaded preview.
  useEffect(() => {
    setProgress(-1)
    setRunning(false)
    setUpload(null)
  }, [datasetId])

  // Pipeline timer: one step every PREPROCESS_STEP_MS.
  useEffect(() => {
    if (!running) return
    if (progress >= steps.length - 1) {
      setRunning(false)
      const last = steps[steps.length - 1]
      if (last) toast(`Preprocessing complete · ${last.rowsAfter} × ${last.featuresAfter} model-ready`, 'accent')
      return
    }
    const t = window.setTimeout(() => setProgress((p) => p + 1), reduced ? 0 : PREPROCESS_STEP_MS)
    return () => window.clearTimeout(t)
  }, [running, progress, steps, reduced, toast])

  const runPipeline = () => {
    setProgress(-1)
    setRunning(true)
  }

  const onFile = useCallback(
    async (file: File) => {
      setUploading(true)
      try {
        const res = await api.uploadDataset(file)
        setUpload(res)
        toast(`${res.fileName} · ${res.detail.samples} rows · ${res.detail.columns.length} columns`, 'accent')
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Upload failed', 'error')
      } finally {
        setUploading(false)
      }
    },
    [toast],
  )

  const profile: Profile | undefined = upload ? upload.detail : d
  const pp = d?.preprocessing
  const kept = pp?.pcaDims ?? 4
  const pcaColumns: Column<PcaComponent>[] = [
    { key: 'c', header: 'Component', mono: true, render: (c) => `PC${c.component}` },
    { key: 'l', header: 'Mostly captures', render: (c) => c.label },
    { key: 'e', header: 'Explains', align: 'right', mono: true, render: (c) => formatPercent(c.explained) },
    { key: 'cu', header: 'Cumulative', align: 'right', mono: true, render: (c) => formatPercent(c.cumulative) },
  ]

  if (detail.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn't load the dataset." body={detail.error.message} action={<Button variant="outline" size="sm" onClick={detail.reload}>Try again</Button>} />
      </Page>
    )
  }

  return (
    <Page label={route.label}>
      <PageItem as="header">
        <PageHeader route={route}>
          <div className="mt-6">{pp && <ExperimentTag id={pp.experimentId} detail="uses this pipeline" />}</div>
        </PageHeader>
      </PageItem>

      {/* 01 — Upload */}
      <PageItem as="section" className="mt-20">
        <SectionHeader index="01" title="Upload" plain="Bring your own patient records as a spreadsheet file (CSV). We check each column and show what we found before anything is trained." />
        <div className="mt-6">
          <UploadZone onFile={onFile} busy={uploading} />
        </div>
      </PageItem>

      {/* 02 — Profile */}
      <PageItem as="section" className="mt-24">
        <SectionHeader
          index="02"
          title={upload ? `Profile · ${upload.fileName}` : `Profile · ${dataset.name} (${dataset.code})`}
          plain="How many patients and measurements there are, how many values are missing, and how many patients have the disease. The column we try to predict is in blue."
          aside={
            upload ? (
              <Button size="sm" variant="outline" onClick={() => setUpload(null)}>
                Back to {dataset.code}
              </Button>
            ) : (
              <span className="type-label text-muted">{profile?.source}</span>
            )
          }
        />
        {profile ? (
          <ProfileView profile={profile} />
        ) : (
          <div className="mt-8 grid grid-cols-4 gap-6" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton width={12} />
                <Skeleton width="60%" height="4.5rem" />
              </div>
            ))}
          </div>
        )}
        {upload && (
          <p className="measure mt-4 type-small text-muted">
            Uploaded files are profiled only. Training on them arrives when the backend pipeline is connected.
          </p>
        )}
      </PageItem>

      {/* 03 — Preprocessing */}
      <PageItem as="section" className="mt-24">
        <SectionHeader
          index="03"
          title="Preprocessing pipeline"
          plain="The steps that turn raw records into a few clean numbers per patient: fix gaps, tame extreme values, put everything on one scale, keep the useful measurements, then compress them for the qubits."
          aside={
            <Button size="sm" onClick={runPipeline} disabled={!d || running}>
              {running ? 'Running…' : progress >= steps.length - 1 ? 'Run again' : 'Run preprocessing'}
            </Button>
          }
        />
        <div className="mt-10">{d ? <PreprocessRail steps={steps} progress={progress} running={running} /> : <Skeleton width="100%" height="6rem" />}</div>
      </PageItem>

      {/* 04 — Before / after */}
      <PageItem as="section" className="mt-24">
        <SectionHeader
          index="04"
          title="Before and after"
          plain="What cleaning changed, and how much of the original information survives when many measurements are squeezed into one number per qubit."
        />
        {pp && d ? (
          <>
            <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-8 xl:grid-cols-3">
              <Stat label="Missing values">
                <p className="type-metric text-ink">
                  {pp.missingBefore} <span className="text-muted">→</span> <span className="text-accent">{pp.missingAfter}</span>
                </p>
              </Stat>
              <Stat label={<>Outliers clipped (±3<span className="normal-case">σ</span>)</>}>
                <p className="type-metric text-ink">{pp.outliersClipped}</p>
              </Stat>
              <Stat label={<>Features → <Term term="pca">PCA</Term> dims</>}>
                <p className="type-metric text-ink">
                  {d.features} <span className="text-muted">→</span> {pp.selectedFeatures.length} <span className="text-muted">→</span>{' '}
                  <span className="text-accent">{pp.pcaDims}</span>
                </p>
              </Stat>
            </div>
            <div className="mt-14">
              <ChartFigure<PcaComponent>
                label={`Fig. 01 — PCA explained variance · ${dataset.code}`}
                takeaway={`The first ${kept} components keep ${formatPercent(pp.pca[kept - 1]?.cumulative ?? 0)} of the information; they become the ${kept} qubits (blue).`}
                legend={[
                  { key: 'k', label: `Kept → ${kept} qubits`, color: C.accent, shape: 'square' },
                  { key: 'd', label: 'Dropped', color: C.classical, shape: 'square' },
                  { key: 'c', label: 'Cumulative', color: C.ink },
                ]}
                height="22rem"
                table={{ columns: pcaColumns, rows: pp.pca, rowKey: (c) => String(c.component), caption: 'Explained variance by principal component' }}
              >
                <PcaChart pca={pp.pca} kept={kept} />
              </ChartFigure>
            </div>
          </>
        ) : (
          <Skeleton width="100%" height="10rem" className="mt-8" />
        )}
      </PageItem>
    </Page>
  )
}
