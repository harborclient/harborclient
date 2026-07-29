import { describe, expect, it } from 'vitest';
import type { RootState } from '#/renderer/src/store/redux';
import { enrichWorkflowSendDisplayFields } from './enrichWorkflowSendDisplayFields';

/**
 * Builds a minimal workflow action for enricher tests.
 *
 * @param type - Logical event type.
 * @param payload - Action payload.
 * @param uuid - Stable action uuid.
 * @returns Action-shaped fixture.
 */
function action(
  type: string,
  payload: unknown,
  uuid = `uuid-${type}`
): { uuid: string; type: string; at: number; payload: unknown } {
  return { uuid, type, at: 0, payload };
}

describe('enrichWorkflowSendDisplayFields', () => {
  it('copies method/name/url from a preceding request.load onto bare sends', () => {
    const enriched = enrichWorkflowSendDisplayFields([
      action('request.load', {
        method: 'GET',
        name: 'List things',
        url: 'https://example.com/things'
      }),
      action('request.send', { target: 'active' }, 'send-1')
    ]);

    expect(enriched[1]?.payload).toEqual({
      target: 'active',
      method: 'GET',
      name: 'List things',
      url: 'https://example.com/things'
    });
  });

  it('uses the latest preceding draft/save/create display fields', () => {
    const enriched = enrichWorkflowSendDisplayFields([
      action('request.load', { method: 'GET', name: 'Old', url: 'https://a.example' }),
      action('request.draft', { method: 'POST', name: 'Create', url: 'https://b.example' }),
      action('request.send', { target: 'active' }, 'send-1'),
      action('request.save', { method: 'PUT', name: 'Saved', url: 'https://c.example' }),
      action('request.send', { target: 'active' }, 'send-2'),
      action('request.create', { method: 'GET', name: 'Untitled' }),
      action('request.send', { target: 'active' }, 'send-3')
    ]);

    expect(enriched[2]?.payload).toMatchObject({
      method: 'POST',
      name: 'Create',
      url: 'https://b.example'
    });
    expect(enriched[4]?.payload).toMatchObject({
      method: 'PUT',
      name: 'Saved',
      url: 'https://c.example'
    });
    expect(enriched[6]?.payload).toMatchObject({
      method: 'GET',
      name: 'Untitled',
      url: 'https://c.example'
    });
  });

  it('leaves sends that already have method and name unchanged', () => {
    const send = action(
      'request.send',
      {
        target: 'active',
        method: 'DELETE',
        name: 'Remove',
        url: 'https://example.com/x'
      },
      'send-1'
    );
    const enriched = enrichWorkflowSendDisplayFields([
      action('request.load', { method: 'GET', name: 'Other', url: 'https://other' }),
      send
    ]);

    expect(enriched[1]).toBe(send);
    expect(enriched[1]?.payload).toEqual(send.payload);
  });

  it('leaves bare sends alone when no preceding request display exists', () => {
    const send = action('request.send', { target: 'active' }, 'send-1');
    const enriched = enrichWorkflowSendDisplayFields([
      action('environment.activate', { environmentId: 1 }),
      send
    ]);

    expect(enriched[1]).toBe(send);
    expect(enriched[1]?.payload).toEqual({ target: 'active' });
  });

  it('fills only missing send display fields from the latest request', () => {
    const enriched = enrichWorkflowSendDisplayFields([
      action('request.load', { method: 'PATCH', name: 'Update', url: 'https://example.com' }),
      action('request.send', { target: 'active', name: 'Custom name' }, 'send-1')
    ]);

    expect(enriched[1]?.payload).toEqual({
      target: 'active',
      name: 'Custom name',
      method: 'PATCH',
      url: 'https://example.com'
    });
  });

  it('returns a new array without mutating inputs', () => {
    const original = [
      action('request.load', { method: 'GET', name: 'A' }),
      action('request.send', { target: 'active' }, 'send-1')
    ];
    const snapshot = structuredClone(original);
    const enriched = enrichWorkflowSendDisplayFields(original);

    expect(enriched).not.toBe(original);
    expect(original).toEqual(snapshot);
    expect(enriched[0]).toBe(original[0]);
  });

  it('resolves bare sends from a preceding tab.activate request identity', () => {
    const getState = (): RootState =>
      ({
        tabs: { tabs: [], activeTabId: '' },
        collections: {
          requestsByCollection: {
            1: [
              {
                id: 10,
                uuid: 'req-uuid-10',
                name: 'Delete item',
                method: 'DELETE',
                url: 'https://example.com/items/1',
                collection_id: 1
              }
            ]
          },
          documentsByCollection: {}
        }
      }) as unknown as RootState;

    const enriched = enrichWorkflowSendDisplayFields(
      [
        action(
          'tab.activate',
          { identity: { kind: 'request', requestUuid: 'req-uuid-10', requestId: 10 } },
          'tab-1'
        ),
        action('request.send', { target: 'active' }, 'send-1')
      ],
      { getState }
    );

    expect(enriched[1]?.payload).toEqual({
      target: 'active',
      method: 'DELETE',
      name: 'Delete item',
      url: 'https://example.com/items/1'
    });
  });

  it('prefers open-tab draft over saved request for tab.activate identity', () => {
    const getState = (): RootState =>
      ({
        tabs: {
          tabs: [
            {
              tabId: 'tab-1',
              draft: {
                id: 10,
                name: 'Renamed draft',
                method: 'POST',
                url: 'https://example.com/draft'
              },
              savedDraft: {
                id: 10,
                name: 'Saved',
                method: 'GET',
                url: 'https://example.com/saved'
              },
              response: null,
              sending: false,
              sendingRequestId: null,
              testResults: [],
              scriptLogs: [],
              executionEvents: []
            }
          ],
          activeTabId: 'tab-1'
        },
        collections: {
          requestsByCollection: {
            1: [
              {
                id: 10,
                uuid: 'req-uuid-10',
                name: 'Saved',
                method: 'GET',
                url: 'https://example.com/saved',
                collection_id: 1
              }
            ]
          },
          documentsByCollection: {}
        }
      }) as unknown as RootState;

    const enriched = enrichWorkflowSendDisplayFields(
      [
        action(
          'tab.activate',
          { identity: { kind: 'request', requestUuid: 'req-uuid-10', requestId: 10 } },
          'tab-1'
        ),
        action('request.send', { target: 'active' }, 'send-1')
      ],
      { getState }
    );

    expect(enriched[1]?.payload).toMatchObject({
      method: 'POST',
      name: 'Renamed draft',
      url: 'https://example.com/draft'
    });
  });

  it('does not resolve tab.activate without getState', () => {
    const enriched = enrichWorkflowSendDisplayFields([
      action(
        'tab.activate',
        { identity: { kind: 'request', requestUuid: 'req-uuid-10', requestId: 10 } },
        'tab-1'
      ),
      action('request.send', { target: 'active' }, 'send-1')
    ]);

    expect(enriched[1]?.payload).toEqual({ target: 'active' });
  });

  it('fills a bare send from the following tab.activate identity', () => {
    const getState = (): RootState =>
      ({
        tabs: { tabs: [], activeTabId: '' },
        collections: {
          requestsByCollection: {
            1: [
              {
                id: 10,
                uuid: 'req-uuid-10',
                name: 'Delete item',
                method: 'DELETE',
                url: 'https://example.com/items/1',
                collection_id: 1
              }
            ]
          },
          documentsByCollection: {}
        }
      }) as unknown as RootState;

    const enriched = enrichWorkflowSendDisplayFields(
      [
        action('request.send', { target: 'active' }, 'send-1'),
        action(
          'tab.activate',
          { identity: { kind: 'request', requestUuid: 'req-uuid-10', requestId: 10 } },
          'tab-1'
        )
      ],
      { getState }
    );

    expect(enriched[0]?.payload).toMatchObject({
      method: 'DELETE',
      name: 'Delete item'
    });
  });
});
