import { Headline } from '@/components/ui/Headline'
import { Page, PageItem } from '@/components/ui/Page'
import { SectionLabel } from '@/components/ui/SectionLabel'
import type { RouteMeta } from '@/routes'

interface PlaceholderPageProps {
  route: RouteMeta
  /** Patient pages use warmer, larger type. */
  variant?: 'research' | 'patient'
}

/** Stand-in for pages not built yet — already uses the final label + headline. */
export function PlaceholderPage({ route, variant = 'research' }: PlaceholderPageProps) {
  const headingId = `${route.id}-heading`

  return (
    <Page label={route.label}>
      <div className="grid-12">
        <PageItem as="header" className="col-span-12 lg:col-span-10">
          <SectionLabel>{route.section}</SectionLabel>
          <Headline id={headingId} className="mt-6">
            {route.headline}
          </Headline>
        </PageItem>

        <PageItem className="col-span-12 mt-16">
          <div className="border-t border-rule" />
        </PageItem>

        <PageItem className="col-span-12 mt-6 grid grid-cols-subgrid">
          <p className="label-mono col-span-3 text-muted">Status</p>
          <div className="col-span-9 flex min-h-[280px] flex-col justify-between border border-dashed border-rule-strong p-6">
            <p className="max-w-[52ch] text-[15px] leading-6 text-muted">
              {variant === 'patient'
                ? 'This part of the patient view is being prepared.'
                : 'Layout, data and charts for this page arrive in a later build phase.'}
            </p>
            <p className="label-mono text-muted">
              Built in phase <span className="num text-ink">{String(route.phase).padStart(2, '0')}</span>
            </p>
          </div>
        </PageItem>
      </div>
    </Page>
  )
}
