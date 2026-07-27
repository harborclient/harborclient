import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPluginEntityContextMenuSubscribers,
  emitPluginEntityContextMenuOpen,
  subscribePluginEntityContextMenuOpen
} from './pluginEntityContextMenuBus';
import type { EntityContextMenuOpenRequest } from './hostEntityContextMenu';

/**
 * Builds a minimal open-request fixture for bus tests.
 *
 * @param overrides - Fields to override.
 */
function makeRequest(
  overrides: Partial<EntityContextMenuOpenRequest> = {}
): EntityContextMenuOpenRequest {
  return {
    target: { type: 'collection', collectionId: 1 },
    anchor: { x: 10, y: 20 },
    pluginId: 'com.example.tree',
    contributionId: 'collections',
    ...overrides
  };
}

beforeEach(() => {
  clearPluginEntityContextMenuSubscribers();
});

afterEach(() => {
  clearPluginEntityContextMenuSubscribers();
});

describe('pluginEntityContextMenuBus', () => {
  it('notifies subscribers when a menu open is emitted', () => {
    const listener = vi.fn();
    subscribePluginEntityContextMenuOpen(listener);

    const request = makeRequest();
    emitPluginEntityContextMenuOpen(request);

    expect(listener).toHaveBeenCalledWith(request);
  });

  it('stops notifying after dispose', () => {
    const listener = vi.fn();
    const disposable = subscribePluginEntityContextMenuOpen(listener);

    disposable.dispose();
    emitPluginEntityContextMenuOpen(makeRequest());

    expect(listener).not.toHaveBeenCalled();
  });
});
