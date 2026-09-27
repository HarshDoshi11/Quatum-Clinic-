import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { readStored, writeStored } from '@/lib/storage'

export type DatasetId = 'wdbc' | 'heart'
const DATASET_IDS = ['wdbc', 'heart'] as const
const STORAGE_KEY = 'qc.dataset'

export interface DatasetMeta {
  id: DatasetId
  name: string
  code: string
  samples: number
  features: number
}

export const DATASETS: Record<DatasetId, DatasetMeta> = {
  wdbc: { id: 'wdbc', name: 'Breast Cancer', code: 'WDBC', samples: 569, features: 30 },
  heart: { id: 'heart', name: 'Heart Disease', code: 'UCI', samples: 303, features: 13 },
}

interface DatasetContextValue {
  datasetId: DatasetId
  dataset: DatasetMeta
  setDataset: (id: DatasetId) => void
}

const DatasetContext = createContext<DatasetContextValue | null>(null)

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [datasetId, setDatasetId] = useState<DatasetId>(() => readStored(STORAGE_KEY, DATASET_IDS) ?? 'wdbc')

  const setDataset = useCallback((id: DatasetId) => {
    writeStored(STORAGE_KEY, id)
    setDatasetId(id)
  }, [])

  const value = useMemo(
    () => ({ datasetId, dataset: DATASETS[datasetId], setDataset }),
    [datasetId, setDataset],
  )
  return <DatasetContext.Provider value={value}>{children}</DatasetContext.Provider>
}

export function useDataset(): DatasetContextValue {
  const ctx = useContext(DatasetContext)
  if (!ctx) throw new Error('useDataset must be used inside <DatasetProvider>')
  return ctx
}
