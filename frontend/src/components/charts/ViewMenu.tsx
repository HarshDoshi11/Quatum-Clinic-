import { Check, Ellipsis } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useDismiss } from '@/lib/useDismiss'

export type View = 'chart' | 'table'

/** "⋯" menu holding the Chart / Table switch (menuitemradio; arrows move, Enter picks, Esc closes). */
export function ViewMenu({ view, onChange, label = 'Chart options' }: { view: View; onChange: (v: View) => void; label?: string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const items = useRef<(HTMLButtonElement | null)[]>([])
  const [refs] = useState(() => [wrap])
  useDismiss(refs, open, () => setOpen(false))
  useEffect(() => {
    if (open) items.current[view === 'chart' ? 0 : 1]?.focus()
  }, [open, view])
  const options: { value: View; label: string }[] = [
    { value: 'chart', label: 'Show as chart' },
    { value: 'table', label: 'Show as table' },
  ]
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const i = items.current.findIndex((el) => el === document.activeElement)
    items.current[(i + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length]?.focus()
  }
  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-[2px] text-muted hover:bg-ink/[0.07] hover:text-ink"
      >
        <Ellipsis size="1rem" strokeWidth={1.5} aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="View"
          onKeyDown={onKeyDown}
          className="absolute top-full right-0 z-20 mt-1 min-w-[10rem] rounded-[2px] border border-rule bg-surface py-1 shadow-float"
        >
          {options.map((o, i) => (
            <button
              key={o.value}
              ref={(el) => {
                items.current[i] = el
              }}
              type="button"
              role="menuitemradio"
              aria-checked={view === o.value}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              className="flex h-8 w-full items-center gap-2 px-3 text-left type-ui text-ink outline-none hover:bg-ink/[0.07] focus-visible:bg-ink/[0.07]"
            >
              <span className="inline-flex w-3.5 justify-center" aria-hidden="true">
                {view === o.value && <Check size="0.875rem" strokeWidth={1.5} className="text-accent" />}
              </span>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
