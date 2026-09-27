import { motion } from 'motion/react'
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatedNumber } from '@/components/ui/Metric'
import { SegmentedToggle, type SegmentOption } from '@/components/ui/SegmentedToggle'
import { Skeleton } from '@/components/ui/Skeleton'
import { Slider } from '@/components/ui/Slider'
import { Term } from '@/components/ui/Term'
import { springPrecise } from '@/lib/motion'
import type { PcaComponent } from '@/types'

// three.js is large; load it only when the Overview renders.
const BlochSphere = lazy(() => import('./BlochSphere'))

const QUBITS = 4
type QubitId = 'q0' | 'q1' | 'q2' | 'q3'
const QUBIT_OPTIONS: readonly SegmentOption<QubitId>[] = Array.from({ length: QUBITS }, (_, i) => ({
  value: `q${i}` as QubitId,
  label: `Q${i}`,
  ariaLabel: `Qubit ${i}`,
}))

/** Measurement probabilities for a Bloch vector at polar angle θ with length r = 1 − noise. */
export function measurement(theta: number, noise: number): { p0: number; p1: number } {
  const r = 1 - noise
  const p0 = (1 + r * Math.cos(theta)) / 2
  return { p0, p1: 1 - p0 }
}

/** Plain-English reading of the current state. */
function readout(p1: number, noise: number): string {
  if (noise >= 0.6) return 'Noise has washed out most of the signal — reading this qubit is now close to a coin flip.'
  if (p1 >= 0.6) return 'This qubit now leans toward 1 — the model reads this feature as higher risk.'
  if (p1 <= 0.4) return 'This qubit leans toward 0 — the model reads this feature as lower risk.'
  return 'This qubit sits near the equator — on its own, this feature doesn’t tip the result either way.'
}

function SphereFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
      <div className="aspect-square w-[62%] rounded-full border border-dashed border-rule-strong motion-safe:animate-pulse" />
    </div>
  )
}

function ProbabilityBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[64px_1fr_44px] items-center gap-3">
      <span className="num text-[12px] text-muted">{label}</span>
      <span className="relative h-[6px] bg-rule" aria-hidden="true">
        <motion.span
          className="absolute inset-y-0 left-0 block bg-accent"
          initial={false}
          animate={{ width: `${value * 100}%` }}
          transition={springPrecise}
        />
      </span>
      <span className="text-right text-[13px] text-ink">
        <AnimatedNumber value={value} format={(n) => n.toFixed(2)} from={value} />
      </span>
    </div>
  )
}

interface BlochPanelProps {
  /** PCA components of the active dataset (one per qubit); undefined while loading. */
  pca: PcaComponent[] | undefined
  /** The demo patient's encoded value per qubit, in [0, 1]. */
  sampleEncoding: number[] | undefined
}

/**
 * FIG. 01 — how one patient feature becomes one qubit: angle encoding (θ = x·π),
 * measurement probabilities, and what noise does to the state.
 */
export function BlochPanel({ pca, sampleEncoding }: BlochPanelProps) {
  const [qubit, setQubit] = useState<QubitId>('q0')
  const [values, setValues] = useState<number[]>([0.5, 0.5, 0.5, 0.5])
  const [noise, setNoise] = useState(0)
  const thetaRef = useRef<HTMLSpanElement>(null)
  const phiRef = useRef<HTMLSpanElement>(null)

  // Start from the demo patient whenever the dataset (and so its encoding) changes.
  useEffect(() => {
    if (sampleEncoding) setValues(sampleEncoding.slice(0, QUBITS))
  }, [sampleEncoding])

  const index = Number(qubit.slice(1))
  const x = values[index] ?? 0.5
  const theta = x * Math.PI
  const { p0, p1 } = measurement(theta, noise)
  const component = pca?.[index]
  const ready = Boolean(pca && sampleEncoding)

  // Written straight to the DOM ~10×/s so the caption never re-renders the canvas.
  const onAngles = useCallback((t: number, phi: number) => {
    if (thetaRef.current) thetaRef.current.textContent = t.toFixed(2)
    if (phiRef.current) phiRef.current.textContent = phi.toFixed(2)
  }, [])

  const setX = (v: number) => setValues((prev) => prev.map((old, i) => (i === index ? v : old)))

  return (
    <figure className="flex flex-col" data-tour="bloch" aria-labelledby="fig01-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="fig01-title" className="label-mono text-ink">
          Fig. 01 — One qubit, one patient feature
        </p>
        <SegmentedToggle<QubitId> options={QUBIT_OPTIONS} value={qubit} onChange={setQubit} layoutId="fig01-qubit" ariaLabel="Qubit" size="sm" />
      </div>
      <p className="label-mono mt-2 min-h-[16px] text-muted" aria-live="polite">
        {component ? (
          <>
            <span className="text-accent">Q{index}</span> · {component.label} · <Term term="pca">PCA</Term> component {component.component} ·{' '}
            {Math.round(component.explained * 100)}% of the information
          </>
        ) : (
          <Skeleton width={34} />
        )}
      </p>

      <div className="relative mx-auto mt-1 aspect-square w-[88%] cursor-grab active:cursor-grabbing">
        <Suspense fallback={<SphereFallback />}>
          <BlochSphere theta={theta} noise={noise} onAngles={onAngles} />
        </Suspense>
      </div>
      <figcaption className="label-mono text-center text-muted">
        Drag to inspect · θ = <span ref={thetaRef} className="text-ink">{theta.toFixed(2)}</span> · φ ={' '}
        <span ref={phiRef} className="text-ink">0.48</span>
      </figcaption>

      <p className="mt-4 min-h-[48px] text-[15px] leading-6 text-ink" aria-live="polite">
        {readout(p1, noise)}
      </p>

      <div className="mt-5 flex flex-col gap-5 border-t border-rule pt-5">
        <Slider
          label={
            <>
              Feature value · x <span className="normal-case">(normalised)</span>
            </>
          }
          value={x}
          min={0}
          max={1}
          step={0.01}
          onChange={setX}
          format={(v) => v.toFixed(2)}
          tone="accent"
          disabled={!ready}
          hint={
            <span className="num text-[12px]">
              <Term term="encoding">Angle encoding</Term> · θ = x · π = {x.toFixed(2)} · π = {theta.toFixed(2)} rad
            </span>
          }
        />

        <div>
          <p className="label-mono mb-2.5 text-muted">
            <Term term="measurement">Measurement</Term> · {noise === 0 ? 'P(|0⟩) = cos²(θ/2)' : 'P(|0⟩) = (1 + r·cos θ) / 2'}
          </p>
          <div className="flex flex-col gap-2">
            <ProbabilityBar label="P(|0⟩)" value={p0} />
            <ProbabilityBar label="P(|1⟩)" value={p1} />
          </div>
        </div>

        <Slider
          label={<Term term="noise">Noise</Term>}
          value={noise}
          min={0}
          max={1}
          step={0.01}
          onChange={setNoise}
          format={(v) => `${Math.round(v * 100)}%`}
          valueText={(v) => `${Math.round(v * 100)} percent`}
          disabled={!ready}
          hint={
            <>
              <span className="block">Noise pulls the qubit toward pure randomness.</span>
              <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="num text-[12px]">
                  Vector length r = 1 − noise = <span className="text-ink">{(1 - noise).toFixed(2)}</span>
                </span>
                <Link to="/hardware" className="label-mono text-ink underline-offset-4 hover:underline">
                  Explore in Hardware Reality Lab ↗
                </Link>
              </span>
            </>
          }
        />
      </div>
    </figure>
  )
}
