import { Copy, MessageCircle, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { useAppActions } from '@/features/actions'
import { familySummary } from '@/lib/patientText'
import type { PatientReport } from '@/types'

/**
 * "Share with family": a plain summary with no personal identifiers and no exact numbers beyond
 * "about N in 10" (familySummary, checked in check:mocks). Copy, WhatsApp, or the device's own share sheet.
 */
export function ShareSheet({ r, open, onClose }: { r: PatientReport; open: boolean; onClose: () => void }) {
  const { copyLine } = useAppActions()
  const text = familySummary(r)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const nativeShare = async () => {
    try {
      await navigator.share({ title: 'My health check', text })
    } catch {
      // Closing the share sheet is not an error.
    }
  }
  return (
    <Drawer open={open} onClose={onClose} label="Share with family" width={460}>
      <div className="px-8 pt-8 pb-10">
        <p className="type-h2 font-serif text-ink">Share with family</p>
        <p className="mt-3 type-body-lg text-muted">A short summary in plain words. It has no name, date or test values in it.</p>
        <div className="mt-8 rounded-panel bg-surface p-6">
          <p className="whitespace-pre-line type-body-lg text-ink">{text}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={() => void copyLine(text, 'Summary')}>
            <Copy size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
            Copy text
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-control border border-ink px-5 type-body font-medium text-ink transition-colors duration-300 hover:bg-ink hover:text-bg"
          >
            <MessageCircle size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
            Share on WhatsApp
          </a>
          {canShare && (
            <Button variant="outline" onClick={() => void nativeShare()}>
              <Share2 size="1.125rem" strokeWidth={1.5} aria-hidden="true" />
              More ways to share
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  )
}
