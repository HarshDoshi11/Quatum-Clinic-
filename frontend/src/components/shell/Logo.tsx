import { Link } from 'react-router-dom'
import type { Mode } from '@/state/mode'

export function Logo({ mode }: { mode: Mode }) {
  return (
    <Link
      to={mode === 'research' ? '/' : '/patient'}
      className="flex h-full flex-col justify-center px-5"
      aria-label="Q/Clinical home"
    >
      <span className="font-serif text-[26px] leading-none text-ink">
        Q<span className="text-muted">/</span>Clinical
      </span>
      <span className="label-mono mt-1 text-[10px] text-muted">Early Signal Lab</span>
    </Link>
  )
}
