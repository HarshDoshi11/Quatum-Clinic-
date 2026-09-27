import { Link } from 'react-router-dom'
import type { Mode } from '@/state/mode'

export function Logo({ mode }: { mode: Mode }) {
  return (
    <Link
      to={mode === 'research' ? '/' : '/patient'}
      className="flex h-full flex-col justify-center px-5"
      aria-label="Q/Clinical home"
    >
      <span className="type-h2 text-ink">
        Q<span className="text-muted">/</span>Clinical
      </span>
      <span className="type-label mt-0.5 text-muted">Early Signal Lab</span>
    </Link>
  )
}
