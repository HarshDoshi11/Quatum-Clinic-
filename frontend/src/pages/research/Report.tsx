import { api, useResource } from '@/api'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExperimentTag } from '@/components/ui/ExperimentTag'
import { Page, PageItem } from '@/components/ui/Page'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Term } from '@/components/ui/Term'
import { useAppActions } from '@/features/actions'
import { ReportLetter } from '@/features/report/ReportLetter'
import type { RouteMeta } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useDataVersion } from '@/state/dataVersion'
import { PATIENT_SOURCE_LABEL, useCurrentPatient } from '@/state/patient'

export function Report({ route }: { route: RouteMeta }) {
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
        <EmptyState className="mt-16" tone="error" title="Couldn't write the report." body={(schema.error ?? report.error)?.message} />
      </Page>
    )
  }

  return (
    <Page label={route.label}>
      <PageItem as="header" className="print:hidden">
        <PageHeader route={route}>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            {data && <ExperimentTag id={data.experimentId} detail="QSVM · report" />}
            {patient && (
              <span className="type-label text-muted">
                {PATIENT_SOURCE_LABEL[patient.source]} · set on{' '}
                <ButtonLink to="/predict" variant="ghost" size="sm" className="!h-auto !px-0 underline-offset-4 hover:underline">
                  Predict &amp; Trust
                </ButtonLink>
              </span>
            )}
          </div>
        </PageHeader>
      </PageItem>

      <PageItem className="mt-16 print:hidden">
        <div className="flex flex-wrap gap-3" data-tour="report-actions">
          <Button onClick={() => data && printReport(data)} disabled={!data}>
            Download PDF for your doctor
          </Button>
          <Button variant="outline" onClick={() => data && void shareReport(data)} disabled={!data}>
            Share
          </Button>
        </div>
      </PageItem>

      <div className="grid-12 mt-12 gap-y-12 print:mt-0 print:block">
        <PageItem className="col-span-12 xl:col-span-8">
          {data ? (
            <div data-tour="report-letter">
              <ReportLetter report={data} />
            </div>
          ) : (
            <div className="flex flex-col gap-6" aria-hidden="true">
              <Skeleton width="100%" height="3rem" />
              <Skeleton width="60%" height="2.5rem" />
              <Skeleton width="100%" height="6rem" />
              <Skeleton width="100%" height="10rem" />
            </div>
          )}
        </PageItem>

        {/* Research-only provenance; not part of the letter or the PDF. */}
        <PageItem as="div" className="col-span-12 xl:col-span-4 print:hidden">
          <div className="border-t border-rule pt-5 xl:sticky xl:top-8">
            <p className="type-label text-muted">Where this letter comes from</p>
            <p className="measure mt-3 type-small text-ink">
              Every line is generated from the same prediction and explanation as <em>Predict &amp; Trust</em> and <em>Explain</em>: the result from the{' '}
              <Term term="qsvm">QSVM</Term> estimate, reliability from its six trust checks, influences from the strongest contributions. Nothing is
              written by hand.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <ButtonLink to="/predict" variant="outline" size="sm">
                Predict &amp; Trust →
              </ButtonLink>
              <ButtonLink to="/explain" variant="outline" size="sm">
                Explain →
              </ButtonLink>
            </div>
          </div>
        </PageItem>
      </div>

      <PageItem as="footer" className="mt-24 border-t border-rule pt-5">
        <p className="type-label text-muted">Decision support · not a diagnosis</p>
      </PageItem>
    </Page>
  )
}
