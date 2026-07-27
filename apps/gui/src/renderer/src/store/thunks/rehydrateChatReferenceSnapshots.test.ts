import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '@harborclient/core/types';
import {
  selectResponseSelections,
  setResponseSelection
} from '#/renderer/src/store/slices/responseSelectionsSlice';
import { selectScriptSelections } from '#/renderer/src/store/slices/scriptSelectionsSlice';
import { rehydrateChatReferenceSnapshots } from './rehydrateChatReferenceSnapshots';

/**
 * Builds a minimal persisted chat message for rehydration tests.
 *
 * @param overrides - Fields to override on the base message.
 */
function sampleMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 1,
    chatId: 1,
    role: 'user',
    content: 'hello',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

describe('rehydrateChatReferenceSnapshots', () => {
  it('restores response and script snapshots into Redux selection slices', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const responseToken = '@res.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.body';
    const scriptToken = '@active.post.1';

    rehydrateChatReferenceSnapshots(
      [
        sampleMessage({
          content: `Explain ${responseToken} and ${scriptToken}`,
          referenceSnapshots: {
            [responseToken]: {
              kind: 'response-section',
              snapshot: {
                label: 'Response body',
                requestName: 'Echo',
                section: 'body',
                status: 200,
                content: '{"ok":true}'
              }
            },
            [scriptToken]: {
              kind: 'script-selection',
              snapshot: {
                scriptLabel: 'SendSuccess',
                phase: 'post',
                scriptIndex: 1,
                requestId: 'active',
                source: 'hc.test("ok", () => true);',
                selectedText: 'hc.test("ok", () => true);',
                startOffset: 0,
                endOffset: 26,
                startLine: 1,
                endLine: 1
              }
            }
          }
        })
      ],
      store.dispatch,
      store.getState
    );

    expect(selectResponseSelections(store.getState())[responseToken]?.label).toBe('Response body');
    expect(selectScriptSelections(store.getState())[scriptToken]?.scriptLabel).toBe('SendSuccess');
  });

  it('does not overwrite an existing in-session response snapshot', async () => {
    const { store } = await import('#/renderer/src/store/redux');
    const token = '@res.bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee.headers';

    store.dispatch(
      setResponseSelection({
        token,
        snapshot: {
          label: 'Live headers',
          requestName: 'Live',
          section: 'headers',
          content: 'x-live: 1'
        }
      })
    );

    rehydrateChatReferenceSnapshots(
      [
        sampleMessage({
          referenceSnapshots: {
            [token]: {
              kind: 'response-section',
              snapshot: {
                label: 'Persisted headers',
                requestName: 'Persisted',
                section: 'headers',
                content: 'x-persisted: 1'
              }
            }
          }
        })
      ],
      store.dispatch,
      store.getState
    );

    expect(selectResponseSelections(store.getState())[token]?.label).toBe('Live headers');
  });
});
