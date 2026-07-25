import { describe, expect, it, vi } from 'vitest';
import type { ScriptRunError } from '@harborclient/core/types';
import { createInlineScriptRef } from '@harborclient/core/scriptRefs';
import { canOpenScriptErrorInEditor, openScriptErrorInEditor } from './openScriptErrorInEditor';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

/**
 * Builds a request-scoped script error with sensible defaults for tests.
 *
 * @param overrides - Fields to replace on the base error.
 * @returns Structured script failure row.
 */
function errorRow(overrides: Partial<ScriptRunError> = {}): ScriptRunError {
  return {
    message: 'script.js:2:7: boom',
    scriptName: 'Assert',
    scriptId: 'script-1',
    phase: 'post',
    scope: 'request',
    source: 'script.js',
    line: 2,
    column: 7,
    ...overrides
  };
}

describe('canOpenScriptErrorInEditor', () => {
  it('only navigates request-scoped errors with a script id', () => {
    expect(canOpenScriptErrorInEditor(errorRow({ scope: 'collection' }))).toBe(false);
    expect(canOpenScriptErrorInEditor(errorRow({ scriptId: undefined }))).toBe(false);
    expect(canOpenScriptErrorInEditor(errorRow({ phase: undefined }))).toBe(false);
    expect(canOpenScriptErrorInEditor(errorRow())).toBe(true);
  });
});

describe('openScriptErrorInEditor', () => {
  it('dispatches openPageTab with reveal fields for a matching request tab', () => {
    const script = createInlineScriptRef('throw new Error("boom");', 'Assert');
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

    const error = errorRow({ scriptId: script.id });

    expect(openScriptErrorInEditor(dispatch, getState, error)).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(
      openPageTab({
        type: 'script-editor',
        requestTabId: 'req-1',
        phase: 'post',
        scriptId: script.id,
        label: 'Assert',
        revealLine: 2,
        revealColumn: 7,
        revealMessage: 'script.js:2:7: boom',
        revealSource: 'script',
        revealNonce: expect.any(Number)
      })
    );
  });

  it('prefers requestTabId when multiple open tabs share a script id', () => {
    const sharedId = 'shared-script-id';
    const oldScript = { ...createInlineScriptRef('// old', 'Assert'), id: sharedId };
    const newScript = { ...createInlineScriptRef('// new', 'Assert'), id: sharedId };
    const dispatch = vi.fn();
    /**
     * Returns two request tabs that collide on the same script id.
     *
     * @returns Partial RootState for navigation lookup.
     */
    const getState = (): never =>
      ({
        tabs: {
          activeTabId: 'req-old',
          tabs: [
            {
              tabId: 'req-old',
              draft: { pre_request_scripts: [], post_request_scripts: [oldScript] }
            },
            {
              tabId: 'req-new',
              draft: { pre_request_scripts: [], post_request_scripts: [newScript] }
            }
          ]
        }
      }) as never;

    expect(
      openScriptErrorInEditor(dispatch, getState, errorRow({ scriptId: sharedId }), 'req-new')
    ).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          type: 'script-editor',
          requestTabId: 'req-new',
          scriptId: sharedId
        })
      })
    );
  });

  it('does not navigate collection-scoped errors', () => {
    const dispatch = vi.fn();
    const opened = openScriptErrorInEditor(
      dispatch,
      () => ({ tabs: { tabs: [] } }) as never,
      errorRow({ scope: 'collection' })
    );
    expect(opened).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('returns false when no open tab contains the script', () => {
    const dispatch = vi.fn();
    const opened = openScriptErrorInEditor(
      dispatch,
      () => ({ tabs: { activeTabId: null, tabs: [] } }) as never,
      errorRow()
    );
    expect(opened).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
