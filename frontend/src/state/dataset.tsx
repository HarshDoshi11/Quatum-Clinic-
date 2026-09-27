import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { DATASET_IDS, DATASETS, type DatasetMeta } from '@/lib/domain'
import { readStored, writeStored } from '@/lib/storage'
import type { DatasetId } from '@/types'

export type { DatasetId, DatasetMeta }
export { DATASETS }

const STORAGE_KEY = 'qc.dataset'

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
