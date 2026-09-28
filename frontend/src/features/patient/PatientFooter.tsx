import { PageItem } from '@/components/ui/Page'

/** The quiet line a Patient Mode page ends with. */
export function PatientFooter() {
  return (
    <PageItem as="footer" className="mt-20 border-t border-rule pt-6 print:hidden">
      <p className="type-body text-muted">Decision support, not a diagnosis.</p>
    </PageItem>
  )
}
