import { motion } from 'motion/react'
import { springIndicator } from '@/lib/motion'
import { usePlainLanguage } from '@/state/plainLanguage'

/** Top-bar switch for the "In simple words" layer. Persisted in localStorage. */
export function PlainToggle() {
  const { plain, togglePlain } = usePlainLanguage()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={plain}
      onClick={togglePlain}
      title="Show a plain-language line under every section"
      className={`label-mono flex h-8 items-center gap-2 rounded-[2px] border px-2.5 whitespace-nowrap ${
        plain ? 'border-ink text-ink' : 'border-rule text-muted hover:border-rule-strong hover:text-ink'
      }`}
    >
      {/* Two-cell track with a sliding square */}
      <span className="relative flex h-[10px] w-[20px] items-center border border-current" aria-hidden="true">
        <motion.span
          className={`absolute top-[1px] block h-[6px] w-[8px] ${plain ? 'bg-accent' : 'bg-current'}`}
          animate={{ left: plain ? 10 : 1 }}
          transition={springIndicator}
        />
      </span>
      <span>
        Plain<span className="hidden xl:inline"> language</span>
      </span>
    </button>
  )
}
