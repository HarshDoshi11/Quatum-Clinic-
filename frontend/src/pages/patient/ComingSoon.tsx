import { useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { Headline } from '@/components/ui/Headline'
import { Page, PageItem } from '@/components/ui/Page'
import { PatientFooter } from '@/features/patient/PatientFooter'
import { BuildLog } from '@/features/patient/teaser/BuildLog'
import { ParticleHeart } from '@/features/patient/teaser/ParticleHeart'
import { ROADMAP, ROADMAP_READY, ROADMAP_TOTAL, type RoadmapStatus } from '@/features/patient/teaser/roadmap'
import { SneakPeek } from '@/features/patient/teaser/SneakPeek'
import { fill, usePatientStrings } from '@/i18n/patient'
import type { RouteMeta } from '@/routes'
import { useMode } from '@/state/mode'

const SEGMENT: Record<RoadmapStatus, string> = {
  ready: 'bg-accent',
  progress: 'border border-amber',
  planned: 'bg-rule',
}

/**
 * Patient Mode · Coming soon (while PATIENT_MODE_ENABLED is false): what is being built and how far along it is.
 * The build counter, the heart and the build log all read the one roadmap array. Words from the patient i18n
 * file, used as agreed; no icons on this page.
 */
export function ComingSoon({ route }: { route: RouteMeta }) {
  const t = usePatientStrings().teaser
  const { setMode } = useMode()
  const reduced = useReducedMotion() ?? false
  const toLog = () => document.getElementById('build-log')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })

  return (
    <Page label={route.label} className="!pt-0">
      <div className="mx-auto max-w-[84rem]">
        <section
          aria-label={t.welcome}
          className="grid min-h-[min(calc(100svh-var(--topbar-h)),56rem)] grid-cols-1 items-center gap-x-12 gap-y-10 py-10 lg:grid-cols-2"
        >
          <PageItem>
            <span className="inline-block rounded-control border border-accent px-2.5 py-1 type-label text-accent">{t.chip}</span>
            <Headline className="mt-6">{t.headline}</Headline>
            <p className="mt-6 max-w-[46ch] type-body-lg text-muted">{t.sub}</p>
            <div className="mt-8 max-w-[24rem]">
              <p className="type-label text-ink">{fill(t.counter, { ready: ROADMAP_READY, total: ROADMAP_TOTAL })}</p>
              <div className="mt-3 flex gap-1" aria-hidden="true">
                {ROADMAP.map((r) => (
                  <span key={r.id} className={`h-1.5 flex-1 rounded-full ${SEGMENT[r.status]}`} />
                ))}
              </div>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button onClick={toLog} className="px-7">
                {t.seeLog}
              </Button>
              <Button variant="outline" onClick={() => setMode('research')}>
                {t.backToResearch}
              </Button>
            </div>
          </PageItem>
          <PageItem>
            <ParticleHeart />
          </PageItem>
        </section>

        <section id="build-log" aria-labelledby="build-log-title" className="mt-12 scroll-mt-10">
          <h2 id="build-log-title" className="type-h2 text-ink">
            {t.logTitle}
          </h2>
          <div className="mt-10">
            <BuildLog />
          </div>
        </section>

        <PageItem className="mt-28">
          <SneakPeek />
        </PageItem>

        <PatientFooter />
      </div>
    </Page>
  )
}
