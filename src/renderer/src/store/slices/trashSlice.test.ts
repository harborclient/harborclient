import { describe, expect, it } from 'vitest';
import trashReducer, { removeTrashItem, selectTrashItems, setTrashItems } from './trashSlice';

describe('trashSlice', () => {
  it('replaces trash items on refresh', () => {
    const state = trashReducer(
      undefined,
      setTrashItems([
        {
          id: 1,
          entityType: 'environment',
          label: 'Dev',
          connectionId: null,
          originalIds: { environmentId: 4 },
          payload: {},
          deletedAt: '2026-01-01T00:00:00.000Z'
        }
      ])
    );

    expect(selectTrashItems({ trash: state } as never)).toHaveLength(1);
  });

  it('removes one trash item after permanent deletion', () => {
    const initial = trashReducer(
      undefined,
      setTrashItems([
        {
          id: 1,
          entityType: 'history',
          label: 'GET /health',
          connectionId: null,
          originalIds: { historyId: 9 },
          payload: {},
          deletedAt: '2026-01-01T00:00:00.000Z'
        },
        {
          id: 2,
          entityType: 'tabGroup',
          label: 'Morning tabs',
          connectionId: null,
          originalIds: { tabGroupId: 2 },
          payload: {},
          deletedAt: '2026-01-02T00:00:00.000Z'
        }
      ])
    );

    const next = trashReducer(initial, removeTrashItem(1));
    expect(selectTrashItems({ trash: next } as never).map((item) => item.id)).toEqual([2]);
  });
});
