import type { JSX, KeyboardEvent, MouseEvent } from 'react';
import type { ScriptTestResult } from '@harborclient/core/types';
import { CopyToChatButton, StatusDot, TableCell } from '@harborclient/sdk/components';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { useAppDispatch, useAppStore } from '#/renderer/src/store/hooks';
import {
  canCopyTestResultToChat,
  copyTestResultToChat
} from '#/renderer/src/scripting/copyScriptFailureToChat';
import {
  canOpenTestResultInEditor,
  openTestResultInEditor
} from '#/renderer/src/scripting/openTestResultInEditor';
import { scriptRowIconButtonClass } from '#/renderer/src/ui/Shared/classes';

interface Props {
  /**
   * hc.test assertion result to render.
   */
  test: ScriptTestResult;

  /**
   * Request tab that produced these results; preferred when resolving jump-to-editor.
   */
  requestTabId?: string;
}

/**
 * Builds a short accessible name for a navigable test result row.
 *
 * @param test - Test result being rendered.
 * @returns Label for the row button.
 */
function testResultAccessibleName(test: ScriptTestResult): string {
  const status = test.passed ? 'Passed' : 'Failed';
  const location =
    test.line != null ? ` at line ${test.line}${test.column != null ? `:${test.column}` : ''}` : '';
  return `${status} test ${test.name}${location}`;
}

/**
 * Formats expected/actual values for the failure detail line.
 *
 * @param test - Failed test that may include Chai expected/actual.
 * @returns Detail text, or null when neither value is present.
 */
function formatExpectedActual(test: ScriptTestResult): string | null {
  if (test.expected == null && test.actual == null) {
    return null;
  }
  const parts: string[] = [];
  if (test.expected != null) {
    parts.push(`expected ${test.expected}`);
  }
  if (test.actual != null) {
    parts.push(`got ${test.actual}`);
  }
  return parts.join(', ');
}

/**
 * Formats a mapped source location for display next to the test name.
 *
 * @param test - Test result with optional sourcemap location.
 * @returns `source:line:column` text, or null when location is missing.
 */
function formatLocation(test: ScriptTestResult): string | null {
  if (test.line == null) {
    return null;
  }
  const source = test.source?.trim() || 'script.js';
  if (test.column != null) {
    return `${source}:${test.line}:${test.column}`;
  }
  return `${source}:${test.line}`;
}

/**
 * Single pass/fail test result row for the Tests tab and console Logs section.
 *
 * Request-scoped rows with a script id open the script editor at the failing line
 * when activated. Collection/folder rows remain static but still show location and
 * expected/actual details. Failed request-scoped rows also offer Copy to chat.
 */
export function TestResultTableRow({ test, requestTabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { aiAvailable, aiSettings } = useAiAvailability();
  const navigable = canOpenTestResultInEditor(test);
  const canCopy = aiAvailable && !test.passed && canCopyTestResultToChat(test);
  const location = formatLocation(test);
  const expectedActual = !test.passed ? formatExpectedActual(test) : null;
  const durationLabel =
    test.durationMs != null && Number.isFinite(test.durationMs) ? `${test.durationMs} ms` : null;

  /**
   * Opens the owning request script editor and reveals the mapped failure line.
   */
  const handleActivate = (): void => {
    openTestResultInEditor(dispatch, store.getState, test, requestTabId);
  };

  /**
   * Activates jump-to-editor on Enter or Space when the row is navigable.
   *
   * @param event - Keyboard event from the table row.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>): void => {
    if (!navigable) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleActivate();
    }
  };

  /**
   * Stops the row click handler from also opening the editor when Copy to chat is used.
   *
   * @param event - Click event from the Copy to chat control.
   */
  const handleCopyClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
    event.stopPropagation();
  };

  /**
   * Copies the failing assertion into the AI chat composer without opening the editor.
   */
  const handleCopyToChat = (): void => {
    void copyTestResultToChat(dispatch, store.getState, test, requestTabId, aiSettings);
  };

  const rowClassName = navigable
    ? 'cursor-pointer hover:bg-selection/60 focus-visible:bg-selection/60 focus-visible:outline-none'
    : undefined;

  return (
    <tr
      className={rowClassName}
      tabIndex={navigable ? 0 : undefined}
      role={navigable ? 'button' : undefined}
      aria-label={navigable ? testResultAccessibleName(test) : undefined}
      onClick={navigable ? handleActivate : undefined}
      onKeyDown={navigable ? handleKeyDown : undefined}
    >
      <TableCell className="align-middle">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusDot
            variant={test.passed ? 'success' : 'danger'}
            label={test.passed ? 'Passed' : 'Failed'}
          />
          <span className="text-text">{test.name}</span>
          {location && <span className="text-muted">{location}</span>}
          {canCopy ? (
            <CopyToChatButton
              appearance="icon"
              className={scriptRowIconButtonClass}
              aria-label={`Copy failed test ${test.name} to chat`}
              onClick={handleCopyClick}
              onSelect={handleCopyToChat}
            />
          ) : null}
        </div>
      </TableCell>
      <TableCell className="align-middle">
        {!test.passed && test.error ? (
          <span className="text-danger">{test.error}</span>
        ) : (
          <span className="text-muted" aria-hidden="true">
            —
          </span>
        )}
      </TableCell>
      <TableCell className="align-middle">
        {expectedActual ? (
          <span className="text-muted">{expectedActual}</span>
        ) : (
          <span className="text-muted" aria-hidden="true">
            —
          </span>
        )}
      </TableCell>
      <TableCell className="w-24 text-right align-middle text-muted">
        {durationLabel ?? ''}
      </TableCell>
    </tr>
  );
}
