import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/components/ui/Toast'
import { useAppActions } from '@/features/actions'
import { isMac } from '@/lib/platform'
import { useMode } from '@/state/mode'
import { usePlainLanguage } from '@/state/plainLanguage'
import { useProjector } from '@/state/projector'

const MOD = isMac ? '⌘' : 'Ctrl'

/** Every global shortcut, in one list — the sheet and the handler read the same data. */
export const SHORTCUTS: readonly { keys: string[]; label: string }[] = [
  { keys: [MOD, 'K'], label: 'Open the command palette' },
  { keys: ['Shift', 'T'], label: 'Switch light / dark theme' },
  { keys: ['Shift', 'L'], label: 'Plain language on / off' },
  { keys: ['Shift', 'P'], label: 'Projector mode on / off' },
  { keys: ['?'], label: 'Show keyboard shortcuts' },
  { keys: ['Esc'], label: 'Close any panel or drawer' },
  { keys: ['Tab'], label: 'Move between controls' },
]

interface ShortcutsValue {
  openShortcuts: () => void
}

const ShortcutsContext = createContext<ShortcutsValue | null>(null)

export function useShortcuts(): ShortcutsValue {
  const ctx = useContext(ShortcutsContext)
  if (!ctx) throw new Error('useShortcuts must be used inside <ShortcutsProvider>')
  return ctx
}

/** True when a keystroke belongs to a text field, not to the app. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
}

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { toggleTheme } = useAppActions()
  const { plain, togglePlain } = usePlainLanguage()
  const { projector, toggleProjector } = useProjector()
  const { toast } = useToast()
  // Patient Mode has no shortcuts sheet and no Plain language toggle: its copy is always plain.
  const patient = useMode().mode === 'patient'

  const openShortcuts = useCallback(() => setOpen(true), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      if (e.key === '?' && !patient) {
        e.preventDefault()
        setOpen((o) => !o)
        return
      }
      if (!e.shiftKey) return
      switch (e.key.toLowerCase()) {
        case 'p':
          e.preventDefault()
          toggleProjector()
          toast(`Projector mode · ${projector ? 'off' : 'on'}`)
          break
        case 't':
          e.preventDefault()
          toggleTheme()
          break
        case 'l':
          if (patient) break
          e.preventDefault()
          togglePlain()
          toast(`Plain language · ${plain ? 'off' : 'on'}`)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleProjector, toggleTheme, togglePlain, projector, plain, toast, patient])

  const value = useMemo(() => ({ openShortcuts }), [openShortcuts])

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
      <Drawer open={open && !patient} onClose={() => setOpen(false)} label="Keyboard shortcuts" width={480}>
        <div className="px-8 pt-8 pb-12">
          <p className="type-label text-muted">Keyboard</p>
          <p className="mt-4 type-h2 text-ink">Keyboard shortcuts</p>
          <p className="measure mt-3 type-body text-muted">Shortcuts work anywhere except while typing in a field.</p>
          <dl className="mt-8 border-t border-rule">
            {SHORTCUTS.map((s) => (
              <div key={s.label} className="flex min-h-11 items-center justify-between gap-6 border-b border-rule py-2">
                <dt className="type-ui text-ink">{s.label}</dt>
                <dd className="flex shrink-0 items-center gap-1.5">
                  {s.keys.map((k) => (
                    <kbd key={k} className="type-label rounded-[2px] border border-rule-strong px-2 py-1 text-ink">
                      {k}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Drawer>
    </ShortcutsContext.Provider>
  )
}
