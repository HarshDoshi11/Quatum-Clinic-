import { ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useAppActions } from '@/features/actions'
import { tQuick } from '@/lib/motion'
import { useDismiss } from '@/lib/useDismiss'
import { DATASETS, useDataset, type DatasetId, type DatasetMeta } from '@/state/dataset'

const OPTIONS: readonly DatasetMeta[] = Object.values(DATASETS)

function DatasetLabel({ meta, compact = false }: { meta: DatasetMeta; compact?: boolean }) {
  return (
    <>
      <span className="text-ink">
        {compact ? (
          <>
            <span className="hidden xl:inline">{meta.name} (</span>
            {meta.code}
            <span className="hidden xl:inline">)</span>
          </>
        ) : (
          <>
            {meta.name} ({meta.code})
          </>
        )}
      </span>
      <span className="text-muted" aria-hidden="true">
        {' · '}
      </span>
      <span className="num text-muted">{meta.samples}</span>
    </>
  )
}

/** Accessible listbox for switching the active dataset. */
export function DatasetSelect() {
  const { dataset } = useDataset()
  const { switchDataset } = useAppActions()
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  const close = useCallback(() => setOpen(false), [])
  const dismissRefs = useMemo(() => [buttonRef, listRef], [])
  useDismiss(dismissRefs, open, close)

  const openList = () => {
    setHighlight(Math.max(0, OPTIONS.findIndex((o) => o.id === dataset.id)))
    setOpen(true)
    requestAnimationFrame(() => listRef.current?.focus())
  }

  const choose = (id: DatasetId) => {
    if (id !== dataset.id) switchDataset(id)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const onListKey = (event: KeyboardEvent<HTMLUListElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setHighlight((h) => (h + 1) % OPTIONS.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setHighlight((h) => (h - 1 + OPTIONS.length) % OPTIONS.length)
        break
      case 'Home':
        event.preventDefault()
        setHighlight(0)
        break
      case 'End':
        event.preventDefault()
        setHighlight(OPTIONS.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        choose(OPTIONS[highlight].id)
        break
      case 'Tab':
        setOpen(false)
        break
      case 'Escape':
        event.preventDefault()
        setOpen(false)
        buttonRef.current?.focus()
        break
    }
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`Dataset: ${dataset.name}, ${dataset.samples} samples`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            openList()
          }
        }}
        className="flex h-8 items-center gap-2 rounded-[2px] px-2 text-[13px] hover:bg-surface"
      >
        <span className="label-mono hidden text-muted xl:inline">Dataset</span>
        <span className="whitespace-nowrap">
          <DatasetLabel meta={dataset} compact />
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={tQuick} className="inline-flex">
          <ChevronDown size={14} strokeWidth={1.5} className="text-muted" aria-hidden="true" />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label="Choose dataset"
            aria-activedescendant={`${listId}-${OPTIONS[highlight].id}`}
            onKeyDown={onListKey}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={tQuick}
            className="absolute top-[calc(100%+6px)] left-0 z-40 min-w-[320px] rounded-[2px] border border-rule-strong bg-bg py-1"
          >
            {OPTIONS.map((option, i) => {
              const selected = option.id === dataset.id
              return (
                <li
                  key={option.id}
                  id={`${listId}-${option.id}`}
                  role="option"
                  aria-selected={selected}
                  onPointerEnter={() => setHighlight(i)}
                  onClick={() => choose(option.id)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-[13px] ${
                    i === highlight ? 'bg-surface' : ''
                  }`}
                >
                  <span className="flex w-2 justify-center" aria-hidden="true">
                    {selected && <span className="block h-[6px] w-[6px] bg-accent" />}
                  </span>
                  <span className="flex-1 whitespace-nowrap">
                    <DatasetLabel meta={option} />
                  </span>
                  <span className="label-mono text-muted">{option.features} feat</span>
                </li>
              )
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
