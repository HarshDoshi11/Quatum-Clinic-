/**
 * User-facing actions that should behave the same wherever they're triggered
 * (top bar, command palette, page buttons, drawer), including their toast.
 */
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { useToast } from '@/components/ui/Toast'
import { BACKENDS, DATASETS } from '@/lib/domain'
import { useDataVersion } from '@/state/dataVersion'
import { useDataset } from '@/state/dataset'
import { useTheme, type Theme } from '@/state/theme'
import { reportSummaryText } from '@/features/report/reportText'
import type { DatasetId, Experiment, PatientReport } from '@/types'

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback for insecure contexts or denied permission.
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

export function useAppActions() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { invalidate } = useDataVersion()
  const { setDataset } = useDataset()
  const { theme, setTheme: applyTheme } = useTheme()

  const switchDataset = useCallback(
    (id: DatasetId) => {
      const meta = DATASETS[id]
      setDataset(id)
      toast(`Dataset · ${meta.name} (${meta.code}) · ${meta.samples}`)
    },
    [setDataset, toast],
  )

  const setTheme = useCallback(
    (next: Theme) => {
      if (next === theme) return
      applyTheme(next)
      toast(`Theme · ${next}`)
    },
    [theme, applyTheme, toast],
  )

  const toggleTheme = useCallback(() => setTheme(theme === 'light' ? 'dark' : 'light'), [theme, setTheme])

  const runPrediction = useCallback(() => {
    navigate('/predict')
    toast('Prediction · load a patient to begin')
  }, [navigate, toast])

  const newExperiment = useCallback(() => {
    navigate('/train')
    toast('New experiment · choose models and qubits')
  }, [navigate, toast])

  const copyExperimentId = useCallback(
    async (id: string) => {
      await copyText(id)
      toast(`${id} copied`)
    },
    [toast],
  )

  /** Re-runs an experiment; toasts "EXP-2049 QUEUED · 4Q · NOISY SIM" and refreshes data views. */
  const rerunExperiment = useCallback(
    async (id: string): Promise<Experiment | null> => {
      try {
        const created = await api.rerunExperiment(id)
        const target = created.qubits
          ? `${created.qubits}Q · ${BACKENDS[created.backend].name}`
          : BACKENDS[created.backend].name
        toast(`${created.id} queued · ${target}`, 'accent')
        invalidate()
        return created
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Re-run failed', 'error')
        return null
      }
    },
    [toast, invalidate],
  )

  /** Copies a line of text (e.g. a question for the doctor) and says so. */
  const copyLine = useCallback(
    async (text: string, what: string) => {
      await copyText(text)
      toast(`${what} copied`)
    },
    [toast],
  )

  /** "Download PDF": the browser's print dialog, with print styles that keep only the letter. */
  const printReport = useCallback(
    (report: PatientReport) => {
      toast(`${report.reportId} · choose “Save as PDF” to download`)
      window.print()
    },
    [toast],
  )

  /** Shares a plain-text summary (Web Share where available, otherwise the clipboard). */
  const shareReport = useCallback(
    async (report: PatientReport) => {
      const text = reportSummaryText(report)
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: `Screening report ${report.reportId}`, text })
          toast(`${report.reportId} shared`)
          return
        } catch (error) {
          // Closing the share sheet is not a failure; anything else falls back to copying.
          if (error instanceof DOMException && error.name === 'AbortError') return
        }
      }
      await copyText(text)
      toast(`${report.reportId} summary copied`)
    },
    [toast],
  )

  return { switchDataset, setTheme, toggleTheme, runPrediction, newExperiment, copyExperimentId, copyLine, rerunExperiment, printReport, shareReport }
}
