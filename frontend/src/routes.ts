/**
 * Single source of truth for navigation. The sidebar, router and command
 * palette all read from here, so they can never drift apart.
 */

export const PATIENT_BASE = '/patient'

export type ResearchRouteId =
  | 'overview'
  | 'data'
  | 'train'
  | 'advantage'
  | 'small-data'
  | 'scalability'
  | 'evolution'
  | 'hardware'
  | 'failure'
  | 'predict'
  | 'explain'
  | 'cross-modality'
  | 'report'

export type PatientRouteId = 'patient-home' | 'patient-assessment' | 'patient-report' | 'patient-soon'

export interface RouteMeta<Id extends string = string> {
  id: Id
  path: string
  /** Sidebar / palette label. */
  label: string
  /** Uppercase mono section label shown above the headline. */
  section: string
  /** Instrument Serif headline. Array = forced line breaks. */
  headline: string | readonly string[]
  /** The phase in which the real page is built (placeholder note until then). */
  phase: number
}

export interface NavGroup {
  numeral: string
  title: string
  routes: readonly RouteMeta<ResearchRouteId>[]
}

export const RESEARCH_GROUPS: readonly NavGroup[] = [
  {
    numeral: '00',
    title: 'Setup',
    routes: [
      {
        id: 'overview',
        path: '/',
        label: 'Overview',
        section: '00 — Overview',
        headline: ['Measure quantum advantage.', 'Test it against reality.', 'Earn patient trust.'],
        phase: 3,
      },
      {
        id: 'data',
        path: '/data',
        label: 'Data',
        section: '00.1 — Data',
        headline: 'What is the model learning from?',
        phase: 4,
      },
      {
        id: 'train',
        path: '/train',
        label: 'Train',
        section: '00.2 — Train',
        headline: 'Which models should we compare?',
        phase: 4,
      },
    ],
  },
  {
    numeral: 'I',
    title: 'Does quantum help?',
    routes: [
      {
        id: 'advantage',
        path: '/advantage',
        label: 'Advantage Observatory',
        section: 'I.1 — Advantage Observatory',
        headline: 'Does quantum actually help?',
        phase: 4,
      },
      {
        id: 'small-data',
        path: '/small-data',
        label: 'Small-Data Explorer',
        section: 'I.2 — Small-Data Explorer',
        headline: 'Does quantum help when data is scarce?',
        phase: 4,
      },
      {
        id: 'scalability',
        path: '/scalability',
        label: 'Scalability Lab',
        section: 'I.3 — Scalability Lab',
        headline: 'What happens as the problem grows?',
        phase: 4,
      },
      {
        id: 'evolution',
        path: '/evolution',
        label: 'Model Evolution Engine',
        section: 'I.4 — Model Evolution Engine',
        headline: 'Which circuit design fits this disease?',
        phase: 4,
      },
    ],
  },
  {
    numeral: 'II',
    title: 'Does it survive reality?',
    routes: [
      {
        id: 'hardware',
        path: '/hardware',
        label: 'Hardware Reality Lab',
        section: 'II.1 — Hardware Reality Lab',
        headline: 'Does it survive real hardware?',
        phase: 5,
      },
      {
        id: 'failure',
        path: '/failure',
        label: 'Failure Envelope',
        section: 'II.2 — Failure Envelope',
        headline: 'When does it become unsafe?',
        phase: 5,
      },
    ],
  },
  {
    numeral: 'III',
    title: 'Can a patient trust it?',
    routes: [
      {
        id: 'predict',
        path: '/predict',
        label: 'Predict & Trust',
        section: 'III.1 — Predict & Trust',
        headline: 'Should we trust this prediction?',
        phase: 6,
      },
      {
        id: 'explain',
        path: '/explain',
        label: 'Explain',
        section: 'III.2 — Explain',
        headline: 'Why this prediction?',
        phase: 6,
      },
      {
        id: 'cross-modality',
        path: '/cross-modality',
        label: 'Cross-Modality',
        section: 'III.3 — Cross-Modality',
        headline: 'Do signals reveal more together?',
        phase: 6,
      },
      {
        id: 'report',
        path: '/report',
        label: 'Patient Report',
        section: 'III.4 — Patient Report',
        headline: 'What should the patient take away?',
        phase: 6,
      },
    ],
  },
]

export const RESEARCH_ROUTES: readonly RouteMeta<ResearchRouteId>[] = RESEARCH_GROUPS.flatMap((g) => g.routes)

/**
 * Patient Mode is a "Coming soon" teaser until the Grand Finale. Its full pages (Home, Assessment, My Report)
 * stay in the code; set this to true to bring them back (the teaser route then goes away).
 */
export const PATIENT_MODE_ENABLED = false

/** The teaser: the one Patient Mode page while PATIENT_MODE_ENABLED is false. */
export const PATIENT_TEASER_ROUTE: RouteMeta<PatientRouteId> = {
  id: 'patient-soon',
  path: PATIENT_BASE,
  label: 'Patient Mode',
  section: 'Coming soon',
  headline: 'The same model, explained for the person it’s about.',
  phase: 7,
}

export const PATIENT_ROUTES: readonly RouteMeta<PatientRouteId>[] = [
  {
    id: 'patient-home',
    path: PATIENT_BASE,
    label: 'Home',
    section: 'Welcome',
    headline: 'Understand your result, clearly.',
    phase: 7,
  },
  {
    id: 'patient-assessment',
    path: `${PATIENT_BASE}/assessment`,
    label: 'Check',
    section: 'Assessment',
    headline: 'A few questions, one step at a time.',
    phase: 7,
  },
  {
    id: 'patient-report',
    path: `${PATIENT_BASE}/report`,
    label: 'My result',
    section: 'My report',
    headline: 'Your report, in plain words.',
    phase: 7,
  },
]

/** The Patient Mode routes the app serves: the full pages, or only the teaser. */
export const LIVE_PATIENT_ROUTES: readonly RouteMeta<PatientRouteId>[] = PATIENT_MODE_ENABLED ? PATIENT_ROUTES : [PATIENT_TEASER_ROUTE]
