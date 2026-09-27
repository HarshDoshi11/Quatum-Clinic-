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
import type { DatasetId, Experiment } from '@/types'

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

  return { switchDataset, setTheme, toggleTheme, runPrediction, newExperiment, copyExperimentId, rerunExperiment }
}
