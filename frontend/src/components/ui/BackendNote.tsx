import { BACKENDS, MODELS } from '@/lib/domain'
import type { BackendId, ModelId } from '@/types'
import { Term } from './Term'

/** Page-level note so a page never silently contradicts the top bar: "THIS PAGE USES NOISY SIM · QSVM 4Q". */
export function BackendNote({ backend, model, qubits }: { backend: BackendId; model: ModelId; qubits: number }) {
  return (
    <p className="type-label text-muted">
      This page uses <span className="text-ink">{BACKENDS[backend].name}</span> ·{' '}
      <Term term={model === 'qsvm' ? 'qsvm' : 'vqc'}>{MODELS[model].name}</Term> <span className="num text-accent">{qubits}Q</span>
    </p>
  )
}
