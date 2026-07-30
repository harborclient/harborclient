import { describe, expect, it } from 'vitest';
import { defaultAuth, type AuthConfig } from '@harborclient/core/auth';
import type { HttpMethod } from '@harborclient/core/types';
import {
  buildAiScriptSelectionContextMessage,
  findAiScriptReferenceCandidates,
  isValidAiScriptReference,
  resolveAiScriptReferenceLabel
} from '@harborclient/core/ai/scriptReferences';
import { createInlineScriptRef } from '@harborclient/core/scriptRefs';
import {
  newBrowserTab,
  openPageTab,
  openTabWithDraft
} from '#/renderer/src/store/slices/tabsSlice';
import {
  selectScriptSelections,
  setScriptSelection
} from '#/renderer/src/store/slices/scriptSelectionsSlice';
import { selectEffectiveActiveRequestTab, selectTabs } from '#/renderer/src/store/selectors';
import {
  buildAiScriptReferenceValidationContext,
  buildWebpageTabsById
} from './useAiScriptReferenceValidationContext';

/**
 * Builds a minimal saved request draft for validation-context tests.
 *
 * @param id - Saved request database id.
 */
function sampleDraft(id: number): {
  id: number;
  collection_id: number;
  folder_id: null;
  name: string;
  method: HttpMethod;
  url: string;
  headers: [];
  params: [];
  body: string;
  body_type: 'none';
  body_raw: null;
  body_raw_open: false;
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ReturnType<typeof createInlineScriptRef>[];
  post_request_scripts: ReturnType<typeof createInlineScriptRef>[];
  comment: string;
  tags: string;
  auth: AuthConfig;
  userAgent: string;
} {
  const script = createInlineScriptRef('hc.test("ok", () => true);', 'SendSuccess');

  return {
    id,
    collection_id: 1,
    folder_id: null,
    name: 'Echo',
    method: 'POST' as const,
    url: 'https://example.com/echo',
    headers: [],
    params: [],
    body: '',
    body_type: 'none' as const,
    body_raw: null,
    body_raw_open: false,
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [] as ReturnType<typeof createInlineScriptRef>[],
    post_request_scripts: [script],
    comment: '',
    tags: '',
    auth: defaultAuth(),
    userAgent: ''
  };
}

describe('buildAiScriptReferenceValidationContext', () => {
  it('resolves script references when a script-editor page tab is focused', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const draft = sampleDraft(5000000693);
    const script = draft.post_request_scripts[0];

    store.dispatch(openTabWithDraft(draft));
    const requestTabId = store.getState().tabs.activeTabId;

    store.dispatch(
      openPageTab({
        type: 'script-editor',
        requestTabId,
        phase: 'post',
        scriptId: script.id,
        label: 'SendSuccess'
      })
    );

    const state = store.getState();
    const context = buildAiScriptReferenceValidationContext(
      selectEffectiveActiveRequestTab(state),
      []
    );
    const reference = findAiScriptReferenceCandidates('@5000000693.post.1')[0];

    expect(isValidAiScriptReference(reference, context)).toBe(true);
    expect(resolveAiScriptReferenceLabel(reference, context)).toBe('SendSuccess');
  });

  it('expands script copy-to-chat context from a snapshot after the active tab changes', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const source = 'hc.expect(true).to.be.ok();';
    // Numeric id that will not match the newly opened tab (id 7).
    const token = '@99.post.1#0.25';

    store.dispatch(
      setScriptSelection({
        token,
        snapshot: {
          scriptLabel: 'Assert ok',
          phase: 'post',
          scriptIndex: 1,
          requestId: 99,
          source,
          selectedText: source,
          startOffset: 0,
          endOffset: 25,
          startLine: 1,
          endLine: 1
        }
      })
    );

    // Open a different request so live-tab validation would fail without the snapshot.
    store.dispatch(openTabWithDraft(sampleDraft(7)));

    const state = store.getState();
    const context = buildAiScriptReferenceValidationContext(
      selectEffectiveActiveRequestTab(state),
      [],
      {},
      {},
      {},
      {},
      selectScriptSelections(state)
    );
    const reference = findAiScriptReferenceCandidates(token)[0];
    const message = buildAiScriptSelectionContextMessage(`Explain ${token}`, context);

    expect(isValidAiScriptReference(reference, context)).toBe(true);
    expect(resolveAiScriptReferenceLabel(reference, context)).toBe('Assert ok (line 1)');
    expect(message).not.toBeNull();
    expect(message).toContain(source);
    expect(message).toContain('script "Assert ok"');
  });

  it('resolves webpage references from open browser tabs', async () => {
    const { store } = await import('#/renderer/src/store/redux');

    store.dispatch(
      newBrowserTab({
        tabId: '55555555-5555-5555-5555-555555555555',
        url: 'https://example.com/',
        homeUrl: 'https://example.com/'
      })
    );

    const state = store.getState();
    const webpageTabsById = buildWebpageTabsById(selectTabs(state));
    const context = buildAiScriptReferenceValidationContext(
      selectEffectiveActiveRequestTab(state),
      [],
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      webpageTabsById
    );
    const token = '@webpage.55555555-5555-5555-5555-555555555555';
    const reference = findAiScriptReferenceCandidates(token)[0];
    const message = buildAiScriptSelectionContextMessage(`Inspect ${token}`, context);

    expect(webpageTabsById['55555555-5555-5555-5555-555555555555']).toEqual({
      title: 'New Browser',
      url: 'https://example.com/'
    });
    expect(isValidAiScriptReference(reference, context)).toBe(true);
    expect(resolveAiScriptReferenceLabel(reference, context)).toBe('New Browser');
    expect(message).toContain('https://example.com/');
    expect(message).toContain('webpage_tab');
  });
});
