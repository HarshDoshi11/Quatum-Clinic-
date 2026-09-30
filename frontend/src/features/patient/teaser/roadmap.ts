/**
 * Patient Mode's build log: one array drives the build counter, the table and how much of the particle heart
 * has settled. The words for each entry live in the patient i18n file (`teaser.items`), keyed by id.
 */
export type RoadmapStatus = 'ready' | 'progress' | 'planned'

export type RoadmapId = 'safety' | 'oneQuestion' | 'honest' | 'finder' | 'people' | 'visit' | 'family' | 'languages'

export const ROADMAP: readonly { id: RoadmapId; status: RoadmapStatus }[] = [
  { id: 'safety', status: 'ready' },
  { id: 'oneQuestion', status: 'ready' },
  { id: 'honest', status: 'ready' },
  { id: 'finder', status: 'progress' },
  { id: 'people', status: 'progress' },
  { id: 'visit', status: 'planned' },
  { id: 'family', status: 'planned' },
  { id: 'languages', status: 'planned' },
]

export const ROADMAP_TOTAL = ROADMAP.length
export const ROADMAP_READY = ROADMAP.filter((r) => r.status === 'ready').length
/** Share of the heart that has settled into shape. */
export const READY_FRACTION = ROADMAP_READY / ROADMAP_TOTAL
/** Share of the ECG line drawn solid: what is ready or being built; the rest is still dashed. */
export const STARTED_FRACTION = ROADMAP.filter((r) => r.status !== 'planned').length / ROADMAP_TOTAL
