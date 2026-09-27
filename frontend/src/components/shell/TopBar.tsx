import { SegmentedToggle, type SegmentOption } from '@/components/ui/SegmentedToggle'
import { isMac, modKeyLabel } from '@/lib/platform'
import { useMode, type Mode } from '@/state/mode'
import { DatasetSelect } from './DatasetSelect'
import { HelpPopover } from './HelpPopover'
import { PlainToggle } from './PlainToggle'
import { ThemeToggle } from './ThemeToggle'

const MODE_OPTIONS: readonly SegmentOption<Mode>[] = [
  { value: 'research', label: 'Research' },
  { value: 'patient', label: 'Patient' },
]

export const COMMAND_PALETTE_EVENT = 'qc:command-palette'

/** Opens the command palette (its listener is registered in Phase 3). */
function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_EVENT))
}

export function TopBar() {
  const { mode, setMode } = useMode()

  return (
    <header className="@container flex h-full items-center gap-4 px-6">
      <div className="flex min-w-0 flex-1 items-center">{mode === 'research' && <DatasetSelect />}</div>

      <div data-tour="mode">
        <SegmentedToggle<Mode>
          options={MODE_OPTIONS}
          value={mode}
          onChange={setMode}
          layoutId="mode-indicator"
          ariaLabel="View mode"
        />
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        {mode === 'research' && (
          <span
            className="type-label hidden whitespace-nowrap text-muted @min-[74rem]:inline"
            title="Active backend: ideal simulator, 4 qubits"
          >
            <span className="text-ink">SIM</span> · IDEAL · <span className="text-accent">4Q</span>
          </span>
        )}
        <PlainToggle />
        <ThemeToggle />
        <button
          type="button"
          onClick={openCommandPalette}
          data-tour="palette"
          aria-label="Open command palette"
          aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
          className="type-label flex h-8 items-center gap-2 rounded-[2px] border border-rule px-2.5 whitespace-nowrap text-muted hover:border-rule-strong hover:text-ink"
        >
          <span>Search</span>
          <kbd className="text-ink">{isMac ? `${modKeyLabel}K` : `${modKeyLabel} K`}</kbd>
        </button>
        <HelpPopover />
      </div>
    </header>
  )
}
