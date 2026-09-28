import { api, useResource } from '@/api'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { useAppActions } from '@/features/actions'
import { ReportLetter } from '@/features/report/ReportLetter'
import { PATIENT_BASE, type RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { useCurrentPatient } from '@/state/patient'

/**
 * Patient Mode · My Report: the Patient Report letter for the current patient, with the
 * patient's view of it (no technical check details, no experiment or model provenance).
 */
export function MyReport({ route }: { route: RouteMeta }) {
  const { datasetId } = useDataset()
  const { version } = useDataVersion()
  const { printReport, shareReport } = useAppActions()
  const schema = useResource((signal) => api.getFeatureSchema(datasetId, { signal }), [datasetId, version])
  const { patient } = useCurrentPatient(datasetId, schema.data)
  const input = patient?.input
  const report = useResource(
    (signal) => (input ? api.getReport({ dataset: datasetId, input }, { signal }) : new Promise<never>(() => {})),
    [datasetId, version, input],
  )
  const data = report.data?.dataset === datasetId ? report.data : undefined

  if (schema.status === 'error' || report.status === 'error') {
    return (
      <Page label={route.label}>
        <PageHeader route={route} />
        <EmptyState className="mt-16" tone="error" title="Couldn’t write your report." body={(schema.error ?? report.error)?.message} />
      </Page>
    )
  }

  return (
    <Page label={route.label}>
      <PageItem as="header" className="max-w-[48rem] print:hidden">
        <PageHeader route={route} />
      </PageItem>

      <PageItem className="mt-10 max-w-[48rem] print:hidden">
        {patient && patient.source !== 'entered' && (
          <p className="mb-8 type-body-lg text-muted">
            This report uses example answers.{' '}
            <ButtonLink to={`${PATIENT_BASE}/assessment`} variant="ghost" className="!h-auto !px-0 !type-body-lg text-ink underline underline-offset-4">
              Take the assessment
            </ButtonLink>{' '}
            to use your own.
          </p>
        )}
        <div className="flex flex-wrap gap-3" data-tour="report-actions">
          <Button onClick={() => data && printReport(data)} disabled={!data}>
            Download PDF for your doctor
          </Button>
          <Button variant="outline" onClick={() => data && void shareReport(data)} disabled={!data}>
            Share
          </Button>
        </div>
      </PageItem>

      <PageItem className="mt-14 max-w-[52rem] print:mt-0 print:max-w-none">
        {data ? (
          <ReportLetter report={data} audience="patient" />
        ) : (
          <div className="flex flex-col gap-6" aria-hidden="true">
            <Skeleton width="100%" height="3rem" />
            <Skeleton width="60%" height="2.5rem" />
            <Skeleton width="100%" height="6rem" />
            <Skeleton width="100%" height="10rem" />
          </div>
        )}
      </PageItem>
    </Page>
  )
}
