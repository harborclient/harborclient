import { useMemo, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import type { ConsoleEntry } from '#/renderer/src/store';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faTableColumns } from '#/renderer/src/fontawesome';
import { segmentGroup } from '#/renderer/src/ui/shared/classes';
import { ConsolePanel } from './ConsolePanel';
import { VariablesPanel } from './VariablesPanel';
import { effectiveCount, resolveScopedVariables } from './VariablesPanel/resolve';
import { footerSegment } from './styles';

interface Props {
  /**
   * Whether the console panel is currently open.
   */
  consoleOpen: boolean;

  /**
   * Number of entries in the console log.
   */
  entryCount: number;

  /**
   * Console log entries, newest first.
   */
  entries: ConsoleEntry[];

  /**
   * Toggles the console panel open/closed.
   */
  onToggleConsole: () => void;

  /**
   * Clears all console entries.
   */
  onClear: () => void;

  /**
   * Whether the variables panel is currently open.
   */
  variablesOpen: boolean;

  /**
   * Toggles the variables panel open/closed.
   */
  onToggleVariables: () => void;

  /**
   * Variables from the active collection.
   */
  collectionVariables: Variable[];

  /**
   * Variables from the active environment.
   */
  environmentVariables: Variable[];

  /**
   * Name of the active collection, if any.
   */
  collectionName?: string;

  /**
   * Name of the active environment, if any.
   */
  environmentName?: string;

  /**
   * Whether the sidebar is currently visible.
   */
  sidebarOpen: boolean;

  /**
   * Toggles the sidebar visible/hidden.
   */
  onToggleSidebar: () => void;
}

/**
 * Persistent window footer with Console and Variables slide-up panels.
 */
export function Footer({
  consoleOpen,
  entryCount,
  entries,
  onToggleConsole,
  onClear,
  variablesOpen,
  onToggleVariables,
  collectionVariables,
  environmentVariables,
  collectionName,
  environmentName,
  sidebarOpen,
  onToggleSidebar
}: Props): JSX.Element {
  /**
   * Merges collection and environment variables for the footer variables panel.
   */
  const resolvedVariables = useMemo(
    () => resolveScopedVariables(collectionVariables, environmentVariables),
    [collectionVariables, environmentVariables]
  );
  const variableCount = effectiveCount(resolvedVariables);

  return (
    <div className="relative shrink-0">
      <ConsolePanel
        entries={entries}
        open={consoleOpen}
        onClose={onToggleConsole}
        onClear={onClear}
      />
      <VariablesPanel
        variables={resolvedVariables}
        open={variablesOpen}
        onClose={onToggleVariables}
        collectionName={collectionName}
        environmentName={environmentName}
      />
      <footer className="relative z-50 flex shrink-0 items-center justify-between border-t border-separator bg-control px-2 py-0.5 app-no-drag">
        <div className={segmentGroup}>
          <button className={footerSegment(consoleOpen)} onClick={onToggleConsole}>
            Console
            {entryCount > 0 && <span className="ml-1 text-[11px] text-muted">({entryCount})</span>}
          </button>
          <button className={footerSegment(variablesOpen)} onClick={onToggleVariables}>
            Variables
            {variableCount > 0 && (
              <span className="ml-1 text-[11px] text-muted">({variableCount})</span>
            )}
          </button>
        </div>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent text-muted hover:bg-selection hover:text-text app-no-drag"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <FaIcon icon={faTableColumns} className="h-3.5 w-3.5" />
        </button>
      </footer>
    </div>
  );
}
