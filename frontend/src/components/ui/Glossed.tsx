import { Fragment } from 'react'
import type { GlossaryKey } from '@/lib/glossary'
import { Term } from './Term'

/**
 * Surface forms → glossary keys. Acronyms match case-sensitively; words match
 * whole-word, any case. Longest phrases first so "gate error" wins over "gate".
 */
const PHRASES: [string, GlossaryKey][] = [
  ['two-qubit gate error', 'gate error'],
  ['gate error', 'gate error'],
  ['readout error', 'readout error'],
  ['circuit depth', 'circuit depth'],
  ['Pareto front', 'pareto front'],
  ['state vector', 'state vector'],
  ['Bloch sphere', 'bloch sphere'],
  ['superposition', 'superposition'],
  ['measurement', 'measurement'],
  ['calibration', 'calibration'],
  ['sensitivity', 'sensitivity'],
  ['specificity', 'specificity'],
  ['abstained', 'abstain'],
  ['abstain', 'abstain'],
  ['baselines', 'baseline'],
  ['baseline', 'baseline'],
  ['simulator', 'simulator'],
  ['encoding', 'encoding'],
  ['qubits', 'qubit'],
  ['qubit', 'qubit'],
  ['seeds', 'seed'],
  ['seed', 'seed'],
  ['shots', 'shots'],
  ['noise', 'noise'],
  ['QSVM', 'qsvm'],
  ['VQC', 'vqc'],
  ['AUC', 'auc'],
  ['PCA', 'pca'],
  ['QPU', 'qpu'],
  ['OOD', 'ood'],
  ['T1', 't1'],
  ['T2', 't2'],
]

const isAcronym = (s: string) => /^[A-Z0-9]+$/.test(s)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const PATTERN = new RegExp(`\\b(${PHRASES.map(([p]) => escape(p)).join('|')})\\b`, 'gi')

function keyFor(match: string): GlossaryKey | null {
  for (const [phrase, key] of PHRASES) {
    if (isAcronym(phrase) ? match === phrase : match.toLowerCase() === phrase.toLowerCase()) return key
  }
  return null
}

/**
 * Renders plain text (typically from the API) with every glossary word wrapped
 * in <Term>. Each term is linked once per text, on first occurrence.
 */
export function Glossed({ text }: { text: string }) {
  const seen = new Set<GlossaryKey>()
  const parts = text.split(PATTERN)
  return (
    <>
      {parts.map((part, i) => {
        // Odd indices are regex captures.
        const key = i % 2 === 1 ? keyFor(part) : null
        if (!key || seen.has(key)) return <Fragment key={i}>{part}</Fragment>
        seen.add(key)
        return (
          <Term key={i} term={key}>
            {part}
          </Term>
        )
      })}
    </>
  )
}
