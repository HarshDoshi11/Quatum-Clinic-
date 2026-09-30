/**
 * Static domain facts (names, dataset sizes). Not results — every metric
 * comes through the API / mock layer. Imported by both UI and mocks.
 */
import type { BackendId, BackendInfo, DatasetId, ModelId, ModelInfo } from '../types/common'
import type { ModalityInfo } from '../types/crossModality'
import type { PatientIcon } from '../types/predict'

export const MODELS: Record<ModelId, ModelInfo> = {
  vqc: { id: 'vqc', name: 'VQC', longName: 'Variational Quantum Classifier', family: 'quantum' },
  qsvm: { id: 'qsvm', name: 'QSVM', longName: 'Quantum Support Vector Machine', family: 'quantum' },
  logreg: { id: 'logreg', name: 'LogReg', longName: 'Logistic Regression', family: 'classical' },
  svm: { id: 'svm', name: 'SVM', longName: 'Support Vector Machine (RBF)', family: 'classical' },
  rf: { id: 'rf', name: 'Random Forest', longName: 'Random Forest', family: 'classical' },
  xgboost: { id: 'xgboost', name: 'XGBoost', longName: 'Gradient-Boosted Trees', family: 'classical' },
}

export const MODEL_ORDER: readonly ModelId[] = ['vqc', 'qsvm', 'logreg', 'svm', 'rf', 'xgboost']

export const BACKENDS: Record<BackendId, BackendInfo> = {
  'ideal-sim': { id: 'ideal-sim', name: 'Ideal Sim' },
  'noisy-sim': { id: 'noisy-sim', name: 'Noisy Sim' },
  'fake-backend-1': { id: 'fake-backend-1', name: 'FakeBackend-1' },
  'fake-backend-2': { id: 'fake-backend-2', name: 'FakeBackend-2' },
  'ibm-qpu': { id: 'ibm-qpu', name: 'IBM QPU' },
  cpu: { id: 'cpu', name: 'CPU' },
}

/** How Patient Mode presents one input: an icon, and the question in plain words ("Your age"). */
export interface PatientFeatureInfo {
  icon: PatientIcon
  question: string
}

/** One step of the "What to do next" journey. */
export interface PatientStep {
  icon: PatientIcon
  text: string
}

/** The outcome a journey follows: the risk band, or no reliable result. */
export type PatientOutcome = 'low' | 'moderate' | 'high' | 'abstain'

/** A zone of a reference range: healthy (sage), borderline (amber) or outside (coral). */
export type RangeZoneKind = 'healthy' | 'borderline' | 'outside'

/**
 * A general health reference range for one measured value ("Your numbers"). These are public
 * health ranges, not what the model uses to decide.
 */
export interface ReferenceRange {
  /** Plain name for the line, e.g. "Blood pressure". */
  name: string
  /** The span the bar shows. */
  scale: [number, number]
  /** Zones across the scale, left to right, covering it without gaps. */
  zones: { from: number; to: number; kind: RangeZoneKind }[]
  /** "healthy is under 120" */
  healthy: string
  /** Short source note. */
  source: string
}

/** A "Learn" card: general education about one input. No numbers, no advice. */
export interface LearnCard {
  title: string
  /** 2–3 short sentences. */
  body: string
}

/** The Home hero: which form the 3D hero draws (its words live in the patient i18n files). */
export interface PatientHome {
  /** 'heart' draws the beating heart with a live ECG line; 'cells' a slow cluster of cells, no ECG. */
  hero: 'heart' | 'cells'
}

/** One step of the assessment conversation: the inputs it asks, in order. */
export interface AssessmentStep {
  id: string
  /** Asked only when the patient has their report with them. */
  fromReport: boolean
  features: string[]
}

/**
 * The shape of the assessment (its words live in the patient i18n files): the steps in order (every
 * input exactly once, asserted by check:mocks), and the sections of the illustrated sample report that
 * "Where do I find this?" highlights (every report input in exactly one section).
 */
export interface PatientAssessment {
  steps: AssessmentStep[]
  report: { id: string; features: string[] }[]
}

/** Everything Patient Mode needs from a dataset. */
export interface PatientConfig {
  home: PatientHome
  /** Some symptoms of this condition need care now: Home shows "Is this urgent?" and the check opens with a safety question. */
  safetyCheck: boolean
  assessment: PatientAssessment
  /** What the check is about, in patient copy ("heart disease"). */
  name: string
  /** One entry per input. check:mocks asserts every model input has one. */
  features: Record<string, PatientFeatureInfo>
  /** "What to do next", per outcome; the report's next steps come from here. */
  guidance: Record<PatientOutcome, PatientStep[]>
  /** Reference ranges for measured values that have patient-meaningful ones (may be empty). */
  ranges: Record<string, ReferenceRange>
  /** Shown in "Your numbers" instead of ranges when there are none; null when there are. */
  rangesNote: string | null
  /** One card per input. check:mocks asserts full coverage. */
  learn: Record<string, LearnCard>
  /** Suggested questions for the doctor ("Plan your visit"; the report uses the first four). */
  questions: string[]
}

export interface DatasetMeta {
  id: DatasetId
  name: string
  code: string
  /** Condition name used in patient-facing copy. */
  condition: string
  samples: number
  features: number
  positive: number
  negative: number
  positiveLabel: string
  negativeLabel: string
  source: string
  /** Feature keys a patient can't change (e.g. age, sex); locked in what-if analysis. */
  lockedFeatures: string[]
  /** Caption above the what-if sliders on Explain; null for none. */
  explainCaption: string | null
  /**
   * Kinds of test the features come from. Cross-modality analysis runs when
   * there are two or more; with one, every feature belongs to it.
   */
  modalities: ModalityInfo[]
  /** How the patient report refers to the inputs: "Your" values, or "Your sample’s" when they measure a tissue sample. */
  reportSubject: string
  /** Probability where the risk band turns moderate, then high: [moderate, high]. The band depends only on the probability. */
  riskBandEdges: [number, number]
  /** Patient Mode: name, per-input icon and question, guidance. */
  patient: PatientConfig
}

export const DATASETS: Record<DatasetId, DatasetMeta> = {
  wdbc: {
    id: 'wdbc',
    name: 'Breast Cancer',
    code: 'WDBC',
    condition: 'breast cancer',
    samples: 569,
    features: 30,
    positive: 212,
    negative: 357,
    positiveLabel: 'Malignant',
    negativeLabel: 'Benign',
    source: 'Wisconsin Diagnostic Breast Cancer, UCI ML Repository',
    lockedFeatures: [],
    explainCaption: 'These are measurements of the tumor sample, not things a patient can change. Use this to see what the model pays attention to.',
    modalities: [{ id: 'cytology', label: 'Tumor cytology' }],
    reportSubject: 'Your sample’s',
    riskBandEdges: [0.3, 0.6],
    patient: {
      home: { hero: 'cells' },
      safetyCheck: false,
      assessment: {
        steps: [
          { id: 'size', fromReport: true, features: ['radius_mean', 'perimeter_mean', 'area_mean'] },
          {
            id: 'shape',
            fromReport: true,
            features: ['texture_mean', 'smoothness_mean', 'compactness_mean', 'concavity_mean', 'concave_points_mean', 'symmetry_mean', 'fractal_dimension_mean'],
          },
        ],
        report: [
          { id: 'size', features: ['radius_mean', 'perimeter_mean', 'area_mean'] },
          { id: 'shape', features: ['texture_mean', 'smoothness_mean', 'compactness_mean', 'concavity_mean', 'concave_points_mean', 'symmetry_mean', 'fractal_dimension_mean'] },
        ],
      },
      name: 'breast cancer',
      features: {
        radius_mean: { icon: 'circle-dot', question: 'Cell size (radius)' },
        texture_mean: { icon: 'grip', question: 'Texture variation' },
        perimeter_mean: { icon: 'circle-dashed', question: 'Cell outline length' },
        area_mean: { icon: 'square', question: 'Cell area' },
        smoothness_mean: { icon: 'spline', question: 'Edge smoothness' },
        compactness_mean: { icon: 'shrink', question: 'Compactness' },
        concavity_mean: { icon: 'orbit', question: 'Depth of indentations' },
        concave_points_mean: { icon: 'sparkles', question: 'Number of indentations' },
        symmetry_mean: { icon: 'scale', question: 'Symmetry' },
        fractal_dimension_mean: { icon: 'hexagon', question: 'Edge complexity' },
      },
      guidance: {
        high: [
          { icon: 'calendar-days', text: 'Book an appointment with your doctor soon.' },
          { icon: 'file-text', text: 'Bring this report and your biopsy or cytology report.' },
          { icon: 'test-tube', text: 'Ask which follow-up tests or imaging you need.' },
          { icon: 'notebook-pen', text: 'Write down any changes you notice before your visit.' },
        ],
        moderate: [
          { icon: 'calendar-days', text: 'Discuss this result at your next appointment.' },
          { icon: 'file-text', text: 'Bring this report and your biopsy or cytology report.' },
          { icon: 'test-tube', text: 'Ask whether follow-up tests are needed.' },
        ],
        low: [
          { icon: 'calendar-check', text: 'Keep your routine check-ups and screenings.' },
          { icon: 'file-text', text: 'Share this report at your next appointment.' },
          { icon: 'stethoscope', text: 'See a doctor sooner if you notice any changes.' },
        ],
        abstain: [
          { icon: 'calendar-days', text: 'Book an appointment with your doctor.' },
          { icon: 'file-text', text: 'Bring this report and your biopsy or cytology report.' },
          { icon: 'refresh-cw', text: 'Ask whether any measurements should be repeated.' },
        ],
      },
      ranges: {},
      rangesNote:
        'These are measurements of cells from your tissue sample, made in a laboratory. There are no everyday “healthy ranges” for them: your doctor, or the specialist who examined your sample, is the best person to explain what they mean for you.',
      learn: {
        radius_mean: { title: 'What is cell size?', body: 'Under the microscope, the lab measures the size of the cell centres (nuclei) in your sample. Abnormal cells often have larger nuclei than healthy ones.' },
        texture_mean: { title: 'What is texture variation?', body: 'This measures how much the shading varies inside each cell centre in the image. Uneven texture can be one sign that cells are growing abnormally.' },
        perimeter_mean: { title: 'What is the cell outline length?', body: 'This is the length of the outline around each cell centre. Like size, a longer outline can go with larger, abnormal cells.' },
        area_mean: { title: 'What is cell area?', body: 'This is the area each cell centre covers in the image. It goes together with size and outline length.' },
        smoothness_mean: { title: 'What is edge smoothness?', body: 'This describes how smooth or bumpy the edge of each cell centre is. Healthy cells tend to have smooth, regular edges.' },
        compactness_mean: { title: 'What is compactness?', body: 'This compares the outline of each cell centre with the space it covers. Irregular shapes score differently from neat, round ones.' },
        concavity_mean: { title: 'What is the depth of indentations?', body: 'This measures how deep the dips in each cell centre’s edge are. Deeper dips are more common in abnormal cells.' },
        concave_points_mean: { title: 'What is the number of indentations?', body: 'This counts the dips along each cell centre’s edge. More dips can be a sign of irregular, abnormal cells.' },
        symmetry_mean: { title: 'What is symmetry?', body: 'This compares the two halves of each cell centre. Healthy cells tend to be more even.' },
        fractal_dimension_mean: { title: 'What is edge complexity?', body: 'This describes how complicated the edge of each cell centre is, a bit like measuring a coastline. More complex edges can go with abnormal growth.' },
      },
      questions: [
        'What do these results mean for me?',
        'What did the specialist see in my sample?',
        'Do I need any more tests, like imaging or another biopsy?',
        'What are the next steps, and how soon should they happen?',
        'Who can I talk to about how I’m feeling?',
        'How does this screening tool compare with the tests you usually use?',
      ],
    },
  },
  heart: {
    id: 'heart',
    name: 'Heart Disease',
    code: 'UCI',
    condition: 'heart disease',
    samples: 303,
    features: 13,
    positive: 139,
    negative: 164,
    positiveLabel: 'Disease',
    negativeLabel: 'No disease',
    source: 'Cleveland Heart Disease, UCI ML Repository',
    lockedFeatures: ['age', 'sex'],
    explainCaption: 'Age and sex are locked because they can’t be changed. Move the other sliders to see which factors shift the estimate. This is a simulation, not medical advice.',
    modalities: [
      { id: 'demographics', label: 'Demographics' },
      { id: 'symptoms', label: 'Symptoms' },
      { id: 'ecg', label: 'ECG' },
      { id: 'exercise', label: 'Exercise Test' },
      { id: 'labs', label: 'Blood Labs' },
    ],
    reportSubject: 'Your',
    riskBandEdges: [0.3, 0.6],
    patient: {
      home: { hero: 'heart' },
      safetyCheck: true,
      assessment: {
        steps: [
          { id: 'about', fromReport: false, features: ['age', 'sex'] },
          { id: 'feeling', fromReport: false, features: ['cp', 'exang'] },
          { id: 'report', fromReport: true, features: ['trestbps', 'chol', 'fbs', 'thalach', 'restecg', 'oldpeak', 'slope', 'thal', 'ca'] },
        ],
        report: [
          { id: 'vitals', features: ['trestbps'] },
          { id: 'blood', features: ['chol', 'fbs'] },
          { id: 'ecg', features: ['restecg'] },
          { id: 'stress', features: ['thalach', 'oldpeak', 'slope'] },
          { id: 'scan', features: ['thal'] },
          { id: 'angio', features: ['ca'] },
        ],
      },
      name: 'heart disease',
      features: {
        age: { icon: 'cake', question: 'Your age' },
        sex: { icon: 'user', question: 'Your sex' },
        trestbps: { icon: 'gauge', question: 'Your blood pressure at rest' },
        cp: { icon: 'heart-crack', question: 'What kind of chest pain you have' },
        restecg: { icon: 'activity', question: 'Your resting heart tracing (ECG)' },
        oldpeak: { icon: 'trending-down', question: 'ECG change during exercise' },
        slope: { icon: 'trending-up', question: 'ECG slope at peak exercise' },
        thalach: { icon: 'heart-pulse', question: 'Your highest heart rate in the exercise test' },
        exang: { icon: 'footprints', question: 'Chest pain when you exercise' },
        thal: { icon: 'scan-line', question: 'Your heart scan result' },
        ca: { icon: 'waypoints', question: 'Narrowed vessels seen on your scan' },
        chol: { icon: 'droplet', question: 'Your cholesterol' },
        fbs: { icon: 'candy', question: 'High fasting blood sugar' },
      },
      guidance: {
        high: [
          { icon: 'calendar-days', text: 'Book an appointment with your doctor soon.' },
          { icon: 'file-text', text: 'Bring this report and your original test results.' },
          { icon: 'test-tube', text: 'Ask about follow-up heart tests.' },
          { icon: 'notebook-pen', text: 'Note any new symptoms, like chest pain or breathlessness, before your visit.' },
        ],
        moderate: [
          { icon: 'calendar-days', text: 'Discuss this result at your next appointment.' },
          { icon: 'file-text', text: 'Bring this report and your original test results.' },
          { icon: 'test-tube', text: 'Ask whether follow-up tests are needed.' },
        ],
        low: [
          { icon: 'calendar-check', text: 'Keep your routine check-ups.' },
          { icon: 'file-text', text: 'Share this report at your next appointment.' },
          { icon: 'stethoscope', text: 'Seek care sooner if symptoms appear.' },
        ],
        abstain: [
          { icon: 'calendar-days', text: 'Book an appointment with your doctor.' },
          { icon: 'file-text', text: 'Bring this report and your original test results.' },
          { icon: 'refresh-cw', text: 'Ask whether any tests should be repeated.' },
        ],
      },
      ranges: {
        trestbps: {
          name: 'Blood pressure',
          scale: [80, 200],
          zones: [
            { from: 80, to: 90, kind: 'borderline' },
            { from: 90, to: 120, kind: 'healthy' },
            { from: 120, to: 140, kind: 'borderline' },
            { from: 140, to: 200, kind: 'outside' },
          ],
          healthy: 'healthy is under 120',
          source: 'Top number at rest; American Heart Association blood pressure categories.',
        },
        chol: {
          name: 'Cholesterol',
          scale: [100, 400],
          zones: [
            { from: 100, to: 200, kind: 'healthy' },
            { from: 200, to: 240, kind: 'borderline' },
            { from: 240, to: 400, kind: 'outside' },
          ],
          healthy: 'healthy is under 200',
          source: 'Total cholesterol; US National Cholesterol Education Program categories.',
        },
      },
      rangesNote: null,
      learn: {
        age: { title: 'Why does age matter?', body: 'The chance of heart disease rises gradually with age, as blood vessels stiffen and narrow over time. Age can’t be changed, which is why your other results matter too.' },
        sex: { title: 'Why does sex matter?', body: 'Men tend to develop heart disease earlier than women, though women’s risk rises after menopause. Symptoms can also look different in women, so mention any that feel unusual.' },
        trestbps: { title: 'What is blood pressure?', body: 'Blood pressure is the force of blood pushing on the walls of your arteries. The top number, measured at rest, is used here. Over time, high blood pressure strains the heart and blood vessels.' },
        cp: { title: 'Why does the type of chest pain matter?', body: 'Doctors group chest pain by how it feels and when it happens. Pain that comes with effort and eases with rest is more typical of the heart; other kinds often have other causes. Some people with heart disease have no chest pain at all.' },
        restecg: { title: 'What is a resting ECG?', body: 'An ECG records your heart’s electrical activity through small stickers on your skin. At rest, it can show signs of strain, thickened heart muscle or earlier damage.' },
        oldpeak: { title: 'What is an ECG change during exercise?', body: 'During an exercise test, part of the ECG trace can dip below its usual level. A bigger dip can mean the heart muscle isn’t getting enough blood when it works harder.' },
        slope: { title: 'What does the ECG slope mean?', body: 'This describes the shape of that same part of the ECG trace at the peak of exercise. Rising is usually reassuring; flat or falling can point to less blood reaching the heart.' },
        thalach: { title: 'Why does your highest heart rate matter?', body: 'This is the fastest your heart beat during the exercise test. A heart that speeds up well with effort is usually a good sign; a lower peak can mean exercise is harder for the heart.' },
        exang: { title: 'Why does chest pain during exercise matter?', body: 'Chest pain that comes on with effort can mean the heart muscle needs more blood than narrowed arteries can deliver. It is one of the symptoms doctors pay most attention to.' },
        thal: { title: 'What is a heart scan?', body: 'A small amount of a tracer is injected, and a camera shows how blood reaches the heart muscle at rest and during exercise. A “reversible defect” means an area gets less blood only during effort.' },
        ca: { title: 'What does “narrowed vessels” mean?', body: 'This counts how many of the heart’s main blood vessels looked narrowed on a special X-ray. Narrowed vessels carry less blood to the heart muscle.' },
        chol: { title: 'What is cholesterol?', body: 'Cholesterol is a fatty substance carried in your blood. Too much of it can build up in artery walls and narrow them over time. Food, activity, genes and medicines all affect it.' },
        fbs: { title: 'Why does fasting blood sugar matter?', body: 'This checks your blood sugar after several hours without eating. A high result can be a sign of diabetes, which raises the risk of heart and blood-vessel problems.' },
      },
      questions: [
        'What do these results mean for me?',
        'Do I need any more tests, like an exercise test or a heart scan?',
        'Is my blood pressure or cholesterol something we should treat?',
        'Which symptoms should make me seek care straight away?',
        'What changes to my daily life would help my heart the most?',
        'How does this screening tool compare with the tests you usually use?',
      ],
    },
  },
}

export const DATASET_IDS: readonly DatasetId[] = ['wdbc', 'heart']

/** 70/30 stratified split used by every experiment. */
export const TEST_FRACTION = 0.3

export function testSize(dataset: DatasetId): number {
  return Math.round(DATASETS[dataset].samples * TEST_FRACTION)
}

export function trainSize(dataset: DatasetId): number {
  return DATASETS[dataset].samples - testSize(dataset)
}
