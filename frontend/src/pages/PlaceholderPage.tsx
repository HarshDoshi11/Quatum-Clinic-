import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import type { RouteMeta } from '@/routes'

interface PlaceholderPageProps {
  route: RouteMeta
  /** Patient pages use warmer, larger type. */
  variant?: 'research' | 'patient'
}

/** Stand-in for pages not built yet — already uses the final label + headline. */
export function PlaceholderPage({ route, variant = 'research' }: PlaceholderPageProps) {
  return (
    <Page label={route.label}>
      <div className="grid-12">
        <PageItem as="header" className="col-span-12 lg:col-span-10">
          <PageHeader route={route} />
        </PageItem>

        <PageItem className="col-span-12 mt-16">
          <div className="border-t border-rule" />
        </PageItem>

        <PageItem className="col-span-12 mt-6 grid grid-cols-subgrid">
          <p className="type-label col-span-3 text-muted">Status</p>
          <div className="col-span-9 flex min-h-[280px] flex-col justify-between border border-dashed border-rule-strong p-6">
            <p className="measure type-body text-muted">
              {variant === 'patient'
                ? 'This part of the patient view is being prepared.'
                : 'Layout, data and charts for this page arrive in a later build phase.'}
            </p>
            <p className="type-label text-muted">
              Built in phase <span className="num text-ink">{String(route.phase).padStart(2, '0')}</span>
            </p>
          </div>
        </PageItem>
      </div>
    </Page>
  )
}
