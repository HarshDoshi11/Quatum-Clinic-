import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { tQuick } from '@/lib/motion'

export interface SelectOption<T extends string> {
  value: T
  label: string
  /** De-emphasised choice, e.g. "Not recorded". */
  muted?: boolean
}

interface SelectProps<T extends string> {
  value: T
  options: readonly SelectOption<T>[]
  onChange: (value: T) => void
  id?: string
  /** Use when there is no visible <label htmlFor={id}>. */
  ariaLabel?: string
  /** Hairline in ink instead of rule (e.g. a flagged value). */
  emphasis?: boolean
  className?: string
}

const GAP = 4
const EDGE = 12

/**
 * Theme-aware replacement for the native <select> (never use the native one: its
 * popup ignores the theme). WAI-ARIA select-only combobox: focus stays on the
 * button; ↑/↓, Home/End and typing move the active option; Enter/Space/Tab pick it;
 * Escape closes.
 */
export function Select<T extends string>({ value, options, onChange, id, ariaLabel, emphasis = false, className = '' }: SelectProps<T>) {
  const autoId = useId()
  const buttonId = id ?? `${autoId}-button`
  const listId = `${autoId}-list`
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null)
  const typeahead = useRef({ text: '', at: 0 })

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const selected = options[selectedIndex]

  const place = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const listHeight = listRef.current?.offsetHeight ?? 0
    const above = rect.bottom + GAP + listHeight > window.innerHeight - EDGE && rect.top - GAP - listHeight > EDGE
    const width = Math.max(rect.width, 160)
    const left = Math.min(Math.max(rect.left, EDGE), window.innerWidth - width - EDGE)
    setPos({ left, top: above ? rect.top - GAP : rect.bottom + GAP, width, above })
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  // Close on outside pointer-down.
  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  // Keep the active option in view.
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const openAt = (index: number) => {
    setActive(index)
    setOpen(true)
  }
  const pick = (index: number) => {
    const option = options[index]
    if (option && option.value !== value) onChange(option.value)
    setOpen(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = options.length - 1
    const move = (index: number) => {
      event.preventDefault()
      if (open) setActive(Math.min(last, Math.max(0, index)))
      else openAt(Math.min(last, Math.max(0, index)))
    }
    switch (event.key) {
      case 'ArrowDown':
        if (event.altKey && !open) return openAt(selectedIndex)
        return move(open ? active + 1 : selectedIndex)
      case 'ArrowUp':
        if (event.altKey && open) {
          event.preventDefault()
          return pick(active)
        }
        return move(open ? active - 1 : selectedIndex)
      case 'Home':
        return move(0)
      case 'End':
        return move(last)
      case 'Enter':
      case ' ':
        event.preventDefault()
        return open ? pick(active) : openAt(selectedIndex)
      case 'Escape':
        if (open) {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
        }
        return
      case 'Tab':
        if (open) pick(active)
        return
      default:
        // Typeahead: jump to the next option starting with the typed text.
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const now = Date.now()
          const t = typeahead.current
          t.text = now - t.at > 700 ? event.key.toLowerCase() : t.text + event.key.toLowerCase()
          t.at = now
          const from = open ? active : selectedIndex
          const order = [...options.keys()].map((k) => (from + 1 + k) % options.length)
          const hit = order.find((k) => options[k].label.toLowerCase().startsWith(t.text))
          if (hit !== undefined) {
            event.preventDefault()
            if (open) setActive(hit)
            else pick(hit)
          }
        }
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={onKeyDown}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-[2px] border bg-surface px-2.5 text-left type-ui ${
          emphasis ? 'border-ink' : 'border-rule hover:border-rule-strong'
        } ${selected?.muted ? 'text-muted' : 'text-ink'} ${className}`}
      >
        <span className="truncate">{selected?.label ?? ''}</span>
        <ChevronDown size="0.875rem" strokeWidth={1.5} className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-labelledby={ariaLabel ? undefined : buttonId}
              aria-label={ariaLabel}
              tabIndex={-1}
              initial={{ opacity: 0, y: pos?.above ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={tQuick}
              style={pos ? { left: pos.left, top: pos.top, width: pos.width, translate: pos.above ? '0 -100%' : undefined } : { visibility: 'hidden' }}
              className="shadow-float fixed z-[95] max-h-[18rem] overflow-y-auto rounded-[4px] border border-rule bg-surface py-1"
            >
              {options.map((o, i) => {
                const isSelected = o.value === value
                return (
                  <li
                    key={o.value}
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onPointerMove={() => setActive(i)}
                    onPointerDown={(e) => e.preventDefault() /* keep focus on the button */}
                    onClick={() => pick(i)}
                    className={`flex min-h-9 cursor-pointer items-center gap-2.5 px-2.5 py-1.5 type-ui ${i === active ? 'bg-ink/[0.07]' : ''} ${o.muted ? 'text-muted' : 'text-ink'}`}
                  >
                    <span className={`block h-[0.4375rem] w-[0.4375rem] shrink-0 ${isSelected ? 'bg-accent' : ''}`} aria-hidden="true" />
                    {o.label}
                  </li>
                )
              })}
            </motion.ul>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
