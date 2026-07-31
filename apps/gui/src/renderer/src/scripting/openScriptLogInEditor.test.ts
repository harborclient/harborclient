import { describe, expect, it, vi } from 'vitest';
import type { ScriptLogEntry } from '@harborclient/core/types';
import { createInlineScriptRef } from '@harborclient/core/scriptRefs';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { canOpenScriptLogInEditor, openScriptLogInEditor } from './openScriptLogInEditor';

/**
 * Builds a request-scoped script log entry with sensible defaults for tests.
 *
 * @param overrides - Fields to replace on the base entry.
 * @returns Structured script log row.
 */
function logEntry(overrides: Partial<ScriptLogEntry> = {}): ScriptLogEntry {
  return {
    message: 'hello',
    level: 'log',
    method: 'log',
    scriptName: 'Assert',
    scriptId: 'script-1',
    phase: 'post',
    scope: 'request',
    ...overrides
  };
}

describe('canOpenScriptLogInEditor', () => {
  it('only navigates request-scoped logs with a script id', () => {
    expect(canOpenScriptLogInEditor(logEntry({ scope: 'collection' }))).toBe(false);
    expect(canOpenScriptLogInEditor(logEntry({ scriptId: undefined }))).toBe(false);
    expect(canOpenScriptLogInEditor(logEntry({ phase: undefined }))).toBe(false);
    expect(canOpenScriptLogInEditor(logEntry())).toBe(true);
  });
});

describe('openScriptLogInEditor', () => {
  it('dispatches openPageTab for a matching request tab', () => {
    const script = createInlineScriptRef('console.log("hello");', 'Assert');
    const dispatch = vi.fn();
    /**
     * Returns a minimal tabs state containing the owning request draft.
     *
     * @returns Partial RootState for navigation lookup.
     */
    const getState = (): never =>
      ({
        tabs: {
          activeTabId: 'req-1',
          tabs: [
            {
              tabId: 'req-1',
              draft: {
                pre_request_scripts: [],
                post_request_scripts: [script]
              }
            }
          ]
        }
      }) as never;

    const entry = logEntry({ scriptId: script.id, scriptName: 'Assert' });

    expect(openScriptLogInEditor(dispatch, getState, entry)).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(
      openPageTab({
        type: 'script-editor',
        requestTabId: 'req-1',
        phase: 'post',
        scriptId: script.id,
        label: 'Assert',
        revealSource: 'script',
        revealNonce: expect.any(Number)
      })
    );
  });
});
