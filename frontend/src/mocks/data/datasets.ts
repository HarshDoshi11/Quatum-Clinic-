/** Dataset profiles, previews and the preprocessing report. */
import { DATASETS } from '../../lib/domain'
import type {
  ColumnInfo,
  ColumnType,
  DataRow,
  DatasetDetail,
  DatasetId,
  DatasetSummary,
  PcaComponent,
  PreprocessStep,
  UploadResponse,
} from '../../types'
import { SELECTED_FEATURES } from './experiments'
import { EXPERIMENT_IDS } from './ids'
import { MODEL_FEATURES, SAMPLE_PATIENTS } from './features'
import { PCA_DIMS, PCA_MEANING, preprocess } from './pipeline'
import { gaussian, hashSeed, rng, round } from './math'

/** Explained-variance ratios of the first 8 components (standardised, selected features). */
const PCA_EXPLAINED: Record<DatasetId, number[]> = {
  wdbc: [0.443, 0.19, 0.094, 0.066, 0.055, 0.04, 0.023, 0.016],
  heart: [0.216, 0.121, 0.096, 0.088, 0.078, 0.072, 0.065, 0.059],
}

const MISSING: Record<DatasetId, Record<string, number>> = {
  wdbc: {},
  heart: { ca: 4, thal: 2 },
}

const OUTLIERS_CLIPPED: Record<DatasetId, number> = { wdbc: 142, heart: 21 }

// ─── Columns ────────────────────────────────────────────────

const WDBC_BASES = ['radius', 'texture', 'perimeter', 'area', 'smoothness', 'compactness', 'concavity', 'concave_points', 'symmetry', 'fractal_dimension']
const WDBC_SUFFIX: Record<string, string> = { mean: 'mean', se: 'SE', worst: 'worst' }
const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

function columns(dataset: DatasetId): ColumnInfo[] {
  const meta = DATASETS[dataset]
  if (dataset === 'wdbc') {
    const unitFor = (base: string) => (base === 'radius' || base === 'perimeter' ? 'µm' : base === 'area' ? 'µm²' : null)
    const features = (['mean', 'se', 'worst'] as const).flatMap((suffix) =>
      WDBC_BASES.map<ColumnInfo>((base) => ({
        name: `${base}_${suffix}`,
        label: `${titleCase(base)} (${WDBC_SUFFIX[suffix]})`,
        type: 'numeric',
        isTarget: false,
        missing: 0,
        unit: unitFor(base),
      })),
    )
    return [
      { name: 'diagnosis', label: `Diagnosis (${meta.positiveLabel[0]}/${meta.negativeLabel[0]})`, type: 'binary', isTarget: true, missing: 0, unit: null },
      ...features,
    ]
  }
  const typeOf = (kind: string): ColumnType => (kind === 'binary' ? 'binary' : kind === 'categorical' ? 'categorical' : 'numeric')
  return [
    ...MODEL_FEATURES.heart.map<ColumnInfo>((f) => ({
      name: f.key,
      label: f.label,
      type: typeOf(f.kind),
      isTarget: false,
      missing: MISSING.heart[f.key] ?? 0,
      unit: f.unit,
    })),
    { name: 'target', label: 'Heart disease (1/0)', type: 'binary', isTarget: true, missing: 0, unit: null },
  ]
}

// ─── Preview rows ───────────────────────────────────────────

function preview(dataset: DatasetId): DataRow[] {
  const next = rng(hashSeed(`preview-${dataset}`))
  const rows: DataRow[] = []
  for (let r = 0; r < 8; r++) {
    const positive = r % 3 === 0
    const shift = positive ? 0.9 : -0.5
    if (dataset === 'wdbc') {
      const row: DataRow = { diagnosis: positive ? 'M' : 'B' }
      const size = shift + 0.4 * gaussian(next)
      for (const f of MODEL_FEATURES.wdbc) {
        const z = size + 0.5 * gaussian(next)
        const base = f.key.replace(/_mean$/, '')
        const mean = Math.min(f.max, Math.max(f.min, f.mean + z * f.sd))
        const dp = f.step >= 1 ? 1 : 4
        row[`${base}_mean`] = round(mean, dp)
        row[`${base}_se`] = round(mean * (0.06 + 0.03 * next()), dp)
        row[`${base}_worst`] = round(Math.min(f.max * 1.4, mean * (1.15 + 0.15 * next())), dp)
      }
      rows.push(row)
    } else {
      const row: DataRow = {}
      for (const f of MODEL_FEATURES.heart) {
        const z = shift * Math.sign(f.weight) + 0.8 * gaussian(next)
        let v = Math.min(f.max, Math.max(f.min, f.mean + z * f.sd))
        v = f.kind === 'continuous' ? round(v, 1) : Math.round(v)
        row[f.key] = v
      }
      if (r === 5) row.ca = null // one of the 4 missing `ca` values
      row.target = positive ? 1 : 0
      rows.push(row)
    }
  }
  return rows
}

// ─── Preprocessing ──────────────────────────────────────────

function pca(dataset: DatasetId): PcaComponent[] {
  let cumulative = 0
  return PCA_EXPLAINED[dataset].map((explained, i) => {
    cumulative += explained
    return { component: i + 1, explained, cumulative: round(cumulative), ...PCA_MEANING[dataset][i] }
  })
}

function steps(dataset: DatasetId): PreprocessStep[] {
  const meta = DATASETS[dataset]
  const n = meta.samples
  const f = meta.features
  const missing = Object.values(MISSING[dataset]).reduce((s, x) => s + x, 0)
  const selected = SELECTED_FEATURES[dataset]
  const variance = pca(dataset)[PCA_DIMS - 1].cumulative
  return [
    { id: 'raw', label: 'Raw', detail: `${n} rows × ${f + (dataset === 'wdbc' ? 2 : 1)} columns`, rowsAfter: n, featuresAfter: f },
    { id: 'clean', label: 'Clean', detail: dataset === 'wdbc' ? 'Dropped ID column; encoded M/B → 1/0' : 'Binarised target (0 vs 1–4)', rowsAfter: n, featuresAfter: f },
    { id: 'missing', label: 'Missing values', detail: missing === 0 ? 'None found' : `${missing} imputed (median / mode)`, rowsAfter: n, featuresAfter: f },
    { id: 'outliers', label: 'Outliers', detail: `${OUTLIERS_CLIPPED[dataset]} values clipped at ±3σ`, rowsAfter: n, featuresAfter: f },
    { id: 'normalize', label: 'Normalize', detail: 'z-score on training split', rowsAfter: n, featuresAfter: f },
    { id: 'select', label: 'Feature selection', detail: selected === f ? `All ${f} kept` : `${f} → ${selected} by mutual information`, rowsAfter: n, featuresAfter: selected },
    { id: 'pca', label: 'PCA', detail: `${selected} → ${PCA_DIMS} dims, ${Math.round(variance * 100)}% variance`, rowsAfter: n, featuresAfter: PCA_DIMS },
    { id: 'ready', label: 'Model-ready', detail: `${n} × ${PCA_DIMS}, angles scaled to [0, π]`, rowsAfter: n, featuresAfter: PCA_DIMS },
  ]
}

const SELECTED_NAMES: Record<DatasetId, string[]> = {
  wdbc: [
    'concave_points_worst', 'perimeter_worst', 'concave_points_mean', 'radius_worst', 'perimeter_mean', 'area_worst',
    'radius_mean', 'area_mean', 'concavity_mean', 'concavity_worst', 'compactness_mean', 'compactness_worst',
    'radius_se', 'perimeter_se', 'area_se', 'texture_worst',
  ],
  heart: MODEL_FEATURES.heart.map((f) => f.key),
}

// ─── Public ─────────────────────────────────────────────────

export function datasetSummary(dataset: DatasetId): DatasetSummary {
  const meta = DATASETS[dataset]
  return {
    id: dataset,
    name: meta.name,
    code: meta.code,
    source: meta.source,
    samples: meta.samples,
    features: meta.features,
    target: dataset === 'wdbc' ? 'diagnosis' : 'target',
    missingValues: Object.values(MISSING[dataset]).reduce((s, x) => s + x, 0),
    classBalance: {
      positiveLabel: meta.positiveLabel,
      negativeLabel: meta.negativeLabel,
      positive: meta.positive,
      negative: meta.negative,
    },
    lockedFeatures: meta.lockedFeatures,
    explainCaption: meta.explainCaption,
    modalities: meta.modalities,
  }
}

export function datasetDetail(dataset: DatasetId): DatasetDetail {
  const summary = datasetSummary(dataset)
  return {
    ...summary,
    columns: columns(dataset),
    preview: preview(dataset),
    preprocessing: {
      steps: steps(dataset),
      missingBefore: summary.missingValues,
      missingAfter: 0,
      outliersClipped: OUTLIERS_CLIPPED[dataset],
      selectedFeatures: SELECTED_NAMES[dataset],
      pcaDims: PCA_DIMS,
      pca: pca(dataset),
      sampleEncoding: preprocess(dataset, SAMPLE_PATIENTS[dataset]).encoding,
      experimentId: EXPERIMENT_IDS[dataset].benchmark,
    },
  }
}

/** Profile an uploaded CSV client-side (mock only — the backend will do this for real). */
export function profileCsv(fileName: string, text: string): UploadResponse {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) throw new Error('The file needs a header row and at least one data row.')
  const split = (line: string) => line.split(',').map((cell) => cell.trim().replace(/^"(.*)"$/, '$1'))
  const header = split(lines[0])
  const body = lines.slice(1).map(split)

  const parsed: DataRow[] = body.map((cells) => {
    const row: DataRow = {}
    header.forEach((h, i) => {
      const raw = cells[i] ?? ''
      if (raw === '' || raw.toLowerCase() === 'na' || raw === '?') row[h] = null
      else row[h] = Number.isFinite(Number(raw)) ? Number(raw) : raw
    })
    return row
  })

  const targetGuess = header.find((h) => /^(target|diagnosis|label|class|outcome|y)$/i.test(h)) ?? header[header.length - 1]
  const cols: ColumnInfo[] = header.map((name) => {
    const values = parsed.map((r) => r[name])
    const present = values.filter((v) => v !== null)
    const distinct = new Set(present.map(String))
    const numeric = present.every((v) => typeof v === 'number')
    const type: ColumnType = distinct.size <= 2 ? 'binary' : numeric && distinct.size > 10 ? 'numeric' : 'categorical'
    return { name, label: titleCase(name), type, isTarget: name === targetGuess, missing: values.length - present.length, unit: null }
  })

  const target = cols.find((c) => c.isTarget)
  const targetValues = parsed.map((r) => (target ? r[target.name] : null)).filter((v) => v !== null).map(String)
  const labels = [...new Set(targetValues)].sort()
  const positiveLabel = labels.find((l) => /^(1|m|yes|true|positive)$/i.test(l)) ?? labels[labels.length - 1] ?? '1'
  const negativeLabel = labels.find((l) => l !== positiveLabel) ?? '0'

  return {
    fileName,
    detail: {
      id: `upload-${hashSeed(fileName + text.length).toString(16)}`,
      name: fileName.replace(/\.csv$/i, ''),
      code: 'CSV',
      source: `Uploaded file · ${fileName}`,
      samples: parsed.length,
      features: header.length - 1,
      target: target?.name ?? '',
      missingValues: cols.reduce((s, c) => s + c.missing, 0),
      // An uploaded dataset has no config yet: nothing locked, no caption, no modalities.
      lockedFeatures: [],
      explainCaption: null,
      modalities: [],
      classBalance: {
        positiveLabel,
        negativeLabel,
        positive: targetValues.filter((v) => v === positiveLabel).length,
        negative: targetValues.filter((v) => v !== positiveLabel).length,
      },
      columns: cols,
      preview: parsed.slice(0, 8),
      preprocessing: null,
    },
  }
}
