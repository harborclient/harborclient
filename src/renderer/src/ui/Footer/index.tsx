import { useMemo, type JSX } from 'react';
import type { Variable } from '#/shared/types';
import type { ConsoleEntry } from '#/renderer/src/store';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faRobot, faTableColumns } from '#/renderer/src/fontawesome';
import { segmentGroup } from '#/renderer/src/ui/shared/classes';
import { ConsolePanel } from './ConsolePanel';
import { VariablesPanel } from './VariablesPanel';
import { effectiveCount, resolveScopedVariables } from './VariablesPanel/resolve';
import { footerIconButton, footerSegment } from './styles';

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

  /**
   * Whether the AI sidebar is currently visible.
   */
  aiSidebarOpen: boolean;

  /**
   * Toggles the AI sidebar visible/hidden.
   */
  onToggleAiSidebar: () => void;
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
  onToggleSidebar,
  aiSidebarOpen,
  onToggleAiSidebar
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
          <button
            type="button"
            className={footerSegment(consoleOpen)}
            aria-expanded={consoleOpen}
            aria-controls="footer-console-panel"
            onClick={onToggleConsole}
          >
            Console
            {entryCount > 0 && <span className="ml-1 text-[14px] text-muted">({entryCount})</span>}
          </button>
          <button
            type="button"
            className={footerSegment(variablesOpen)}
            aria-expanded={variablesOpen}
            aria-controls="footer-variables-panel"
            onClick={onToggleVariables}
          >
            Variables
            {variableCount > 0 && (
              <span className="ml-1 text-[14px] text-muted">({variableCount})</span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={footerIconButton(sidebarOpen)}
            onClick={onToggleSidebar}
            aria-pressed={sidebarOpen}
            aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <FaIcon icon={faTableColumns} className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={footerIconButton(aiSidebarOpen)}
            onClick={onToggleAiSidebar}
            aria-pressed={aiSidebarOpen}
            aria-label={aiSidebarOpen ? 'Hide AI sidebar' : 'Show AI sidebar'}
            title={aiSidebarOpen ? 'Hide AI sidebar' : 'Show AI sidebar'}
          >
            <FaIcon icon={faRobot} className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
