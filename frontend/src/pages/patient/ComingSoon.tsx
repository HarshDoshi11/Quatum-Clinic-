import { useReducedMotion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { Headline } from '@/components/ui/Headline'
import { Page, PageItem } from '@/components/ui/Page'
import { PatientFooter } from '@/features/patient/PatientFooter'
import { EngineStrip } from '@/features/patient/teaser/EngineStrip'
import { ParticleHeart } from '@/features/patient/teaser/ParticleHeart'
import { WhatsComing } from '@/features/patient/teaser/WhatsComing'
import { usePatientStrings } from '@/i18n/patient'
import type { RouteMeta } from '@/routes'
import { useMode } from '@/state/mode'

/**
 * Patient Mode · Coming soon (while PATIENT_MODE_ENABLED is false): an asymmetric hero with the particle heart,
 * what's coming as three beats, and the engine it's built on. Words from the patient i18n file.
 */
export function ComingSoon({ route }: { route: RouteMeta }) {
  const t = usePatientStrings()
  const { setMode } = useMode()
  const reduced = useReducedMotion() ?? false
  const seeMore = () => document.getElementById('whats-coming')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })

  return (
    <Page label={route.label} className="!pt-0">
      <div className="mx-auto max-w-[84rem]">
        <section
          aria-label={t.teaser.welcome}
          className="grid min-h-[min(calc(100svh-var(--topbar-h)),56rem)] grid-cols-1 items-center gap-x-12 gap-y-10 py-10 lg:grid-cols-2"
        >
          <PageItem>
            <p className="type-small tracking-[0.06em] text-accent uppercase">{t.teaser.eyebrow}</p>
            <Headline className="mt-5 max-w-[15ch]">{t.teaser.headline}</Headline>
            <p className="mt-6 max-w-[44ch] type-body-lg text-muted">{t.teaser.subtext}</p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Button onClick={seeMore} className="px-7">
                {t.teaser.seeMore}
              </Button>
              <Button variant="outline" onClick={() => setMode('research')}>
                {t.teaser.backToResearch}
              </Button>
            </div>
          </PageItem>
          <PageItem>
            <ParticleHeart />
          </PageItem>
        </section>

        <section id="whats-coming" aria-labelledby="whats-coming-title" className="mt-12 scroll-mt-10">
          <WhatsComing />
        </section>

        <PageItem className="mt-16">
          <EngineStrip />
        </PageItem>

        <PatientFooter />
      </div>
    </Page>
  )
}
