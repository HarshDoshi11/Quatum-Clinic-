import { PageItem } from '@/components/ui/Page'
import { usePatientStrings } from '@/i18n/patient'

/** The quiet line a Patient Mode page ends with. */
export function PatientFooter({ className = 'mt-20' }: { className?: string }) {
  const t = usePatientStrings().shell
  return (
    <PageItem as="footer" className={`border-t border-rule pt-6 print:hidden ${className}`}>
      <p className="type-body text-muted">{t.footer}</p>
    </PageItem>
  )
}
