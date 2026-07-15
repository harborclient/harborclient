import { describe, expect, it } from 'vitest';
import { defaultAuth, type AuthConfig } from '#/shared/auth';
import type { HttpMethod } from '#/shared/types';
import {
  findAiScriptReferenceCandidates,
  isValidAiScriptReference,
  resolveAiScriptReferenceLabel
} from '#/shared/ai/scriptReferences';
import { createInlineScriptRef } from '#/shared/scriptRefs';
import { openPageTab, openTabWithDraft } from '#/renderer/src/store/slices/tabsSlice';
import { selectEffectiveActiveRequestTab } from '#/renderer/src/store/selectors';
import { buildAiScriptReferenceValidationContext } from './useAiScriptReferenceValidationContext';

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
  pre_request_script: string;
  post_request_script: string;
  pre_request_scripts: ReturnType<typeof createInlineScriptRef>[];
  post_request_scripts: ReturnType<typeof createInlineScriptRef>[];
  comment: string;
  tags: string;
  auth: AuthConfig;
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
    pre_request_script: '',
    post_request_script: '',
    pre_request_scripts: [] as ReturnType<typeof createInlineScriptRef>[],
    post_request_scripts: [script],
    comment: '',
    tags: '',
    auth: defaultAuth()
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
});
