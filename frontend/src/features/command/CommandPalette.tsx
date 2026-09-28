import { Command } from 'cmdk'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { COMMAND_PALETTE_EVENT } from '@/components/shell/TopBar'
import { useAppActions } from '@/features/actions'
import { useExperimentDrawer } from '@/features/experiments/ExperimentDrawer'
import { useShortcuts } from '@/features/shortcuts/Shortcuts'
import { DATASET_IDS, DATASETS, MODELS } from '@/lib/domain'
import { formatTime } from '@/lib/format'
import { easePrecise } from '@/lib/motion'
import { isMac } from '@/lib/platform'
import { PATIENT_ROUTES, RESEARCH_GROUPS } from '@/routes'
import { useDataset } from '@/state/dataset'
import { useMode } from '@/state/mode'
import { usePlainLanguage } from '@/state/plainLanguage'
import { useProjector } from '@/state/projector'
import { useTheme } from '@/state/theme'
import type { ExperimentSummary } from '@/types'

function Item({ value, keywords, onSelect, children, hint }: { value: string; keywords?: string[]; onSelect: () => void; children: ReactNode; hint?: ReactNode }) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-3 rounded-[2px] px-3 py-2.5 type-body text-muted data-[selected=true]:bg-surface data-[selected=true]:text-ink"
    >
      <span className="block h-[6px] w-[6px] shrink-0 bg-transparent group-data-[selected=true]:bg-accent" aria-hidden="true" />
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="type-label shrink-0 text-muted">{hint}</span>}
    </Command.Item>
  )
}

const groupClass =
  '[&_[cmdk-group-heading]]:type-label [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-muted'

/** ⌘K / Ctrl+K: jump anywhere, switch dataset, theme or mode, open experiments. */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [recent, setRecent] = useState<ExperimentSummary[] | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  const navigate = useNavigate()
  const { mode, setMode } = useMode()
  const { theme } = useTheme()
  const { datasetId } = useDataset()
  const { openExperiment } = useExperimentDrawer()
  const { switchDataset, toggleTheme, runPrediction, newExperiment } = useAppActions()
  const { projector, toggleProjector } = useProjector()
  const { plain, togglePlain } = usePlainLanguage()
  const { openShortcuts } = useShortcuts()

  const show = useCallback(() => {
    returnFocus.current = document.activeElement as HTMLElement | null
    setSearch('')
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => returnFocus.current?.focus?.())
  }, [])

  // Global shortcut + top-bar button.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (open) close()
        else show()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener(COMMAND_PALETTE_EVENT, show)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(COMMAND_PALETTE_EVENT, show)
    }
  }, [open, show, close])

  // Recent experiments for the active dataset, fetched when the palette opens.
  useEffect(() => {
    if (!open || mode !== 'research') return
    const controller = new AbortController()
    setRecent(null)
    api
      .listExperiments({ dataset: datasetId, limit: 6 }, { signal: controller.signal })
      .then(setRecent)
      .catch(() => undefined)
    return () => controller.abort()
  }, [open, mode, datasetId])

  const run = (action: () => void) => {
    close()
    action()
  }


  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[14vh]">
          <motion.div
            className="absolute inset-0 bg-[var(--overlay)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: easePrecise }}
            className="shadow-float relative w-[min(44rem,calc(100vw-32px))] overflow-hidden rounded-[4px] bg-bg"
          >
            <Command
              label="Command palette"
              loop
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  close()
                }
              }}
            >
              <div className="flex items-center gap-3 border-b border-rule px-5">
                <span className="type-label text-accent" aria-hidden="true">
                  →
                </span>
                <Command.Input
                  ref={inputRef}
                  autoFocus
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Jump to a page, switch dataset, open an experiment…"
                  className="h-14 flex-1 bg-transparent type-body-lg text-ink outline-none placeholder:text-muted focus-visible:outline-none"
                />
                <kbd className="type-label rounded-[2px] border border-rule px-1.5 py-0.5 text-muted">Esc</kbd>
              </div>

              <Command.List className="max-h-[min(460px,60vh)] overflow-y-auto px-2 pb-2">
                <Command.Empty className="px-3 py-8 text-center type-body text-muted">No matches.</Command.Empty>

                <Command.Group heading="Actions" className={groupClass}>
                  {mode === 'research' && (
                    <>
                      <Item value="Run a prediction" keywords={['predict', 'patient', 'trust']} onSelect={() => run(runPrediction)} hint="III.1">
                        Run a prediction
                      </Item>
                      <Item value="New experiment" keywords={['train', 'model']} onSelect={() => run(newExperiment)} hint="00.2">
                        New experiment
                      </Item>
                      {DATASET_IDS.map((id) => {
                        const d = DATASETS[id]
                        const current = id === datasetId
                        return (
                          <Item
                            key={id}
                            value={`Switch to ${d.name}`}
                            keywords={['dataset', 'switch', d.code, d.condition]}
                            onSelect={() => run(() => !current && switchDataset(id))}
                            hint={current ? 'Current' : d.code}
                          >
                            Switch to {d.name} ({d.code})
                          </Item>
                        )
                      })}
                    </>
                  )}
                  <Item
                    value={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                    keywords={['theme', 'dark', 'light', 'appearance']}
                    onSelect={() => run(toggleTheme)}
                    hint="Shift T"
                  >
                    Switch to {theme === 'light' ? 'dark' : 'light'} theme
                  </Item>
                  <Item
                    value={`Projector mode ${projector ? 'off' : 'on'}`}
                    keywords={['projector', 'present', 'large', 'contrast', 'zoom']}
                    onSelect={() => run(toggleProjector)}
                    hint="Shift P"
                  >
                    Turn projector mode {projector ? 'off' : 'on'}
                  </Item>
                  <Item
                    value={`Plain language ${plain ? 'off' : 'on'}`}
                    keywords={['plain', 'simple', 'explain', 'beginner']}
                    onSelect={() => run(togglePlain)}
                    hint="Shift L"
                  >
                    Turn plain language {plain ? 'off' : 'on'}
                  </Item>
                  <Item value="Keyboard shortcuts" keywords={['keys', 'help', 'hotkeys']} onSelect={() => run(openShortcuts)} hint="?">
                    Keyboard shortcuts
                  </Item>
                  <Item
                    value={`Switch to ${mode === 'research' ? 'Patient' : 'Research'} mode`}
                    keywords={['mode', 'patient', 'research']}
                    onSelect={() => run(() => setMode(mode === 'research' ? 'patient' : 'research'))}
                  >
                    Switch to {mode === 'research' ? 'Patient' : 'Research'} mode
                  </Item>
                </Command.Group>

                {mode === 'research' ? (
                  RESEARCH_GROUPS.map((group) => (
                    <Command.Group key={group.numeral} heading={`${group.numeral} — ${group.title}`} className={groupClass}>
                      {group.routes.map((route) => (
                        <Item
                          key={route.id}
                          value={`Go to ${route.label}`}
                          keywords={[typeof route.headline === 'string' ? route.headline : route.headline.join(' ')]}
                          onSelect={() => run(() => navigate(route.path))}
                          hint={route.section.split(' — ')[0]}
                        >
                          {route.label}
                        </Item>
                      ))}
                    </Command.Group>
                  ))
                ) : (
                  <Command.Group heading="Pages" className={groupClass}>
                    {PATIENT_ROUTES.map((route) => (
                      <Item key={route.id} value={`Go to ${route.label}`} onSelect={() => run(() => navigate(route.path))}>
                        {route.label}
                      </Item>
                    ))}
                  </Command.Group>
                )}

                {mode === 'research' && (
                  <Command.Group heading={`Recent experiments · ${DATASETS[datasetId].code}`} className={groupClass}>
                    {recent === null ? (
                      <Command.Loading>
                        <p className="type-label px-3 py-2.5 text-muted">Loading…</p>
                      </Command.Loading>
                    ) : (
                      recent.map((e) => (
                        <Item
                          key={e.id}
                          value={`${e.id} ${e.title}`}
                          keywords={[e.model ? MODELS[e.model].name : '', 'experiment']}
                          onSelect={() => run(() => openExperiment(e.id))}
                          hint={formatTime(e.timestamp)}
                        >
                          <span className="num text-ink">{e.id}</span>
                          <span className="ml-3">{e.title}</span>
                        </Item>
                      ))
                    )}
                  </Command.Group>
                )}
              </Command.List>

              <div className="type-label flex items-center gap-5 border-t border-rule px-5 py-2.5 text-muted">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span className="ml-auto">{isMac ? '⌘K' : 'Ctrl K'} Toggle</span>
              </div>
            </Command>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
