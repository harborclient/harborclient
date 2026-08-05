// @vitest-environment jsdom
import { act, createElement, useEffect } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TeamHub } from '@harborclient/core/types';

import { useTeamHubs, type TeamHubsState } from './useTeamHubs';

/**
 * Builds a minimal configured team hub record.
 *
 * @param id - Team hub id.
 * @returns Hub shaped like the `teamHubs:list` IPC payload.
 */
function makeHub(id: string): TeamHub {
  return {
    id,
    name: `Hub ${id}`,
    baseUrl: `https://${id}.example.com`,
    token: '',
    connected: true
  } as TeamHub;
}

describe('useTeamHubs', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latestState: TeamHubsState | null;
  let listTeamHubs: ReturnType<typeof vi.fn>;
  let connectionsChangedHandlers: Array<() => void>;

  /**
   * Fixture that mounts the hook and publishes its return value to the test.
   */
  function HookFixture(): null {
    const state = useTeamHubs();

    /**
     * Publishes the latest hook result after each render so tests can assert without DOM.
     */
    useEffect(() => {
      latestState = state;
    });

    return null;
  }

  /**
   * Mounts the hook fixture and flushes the initial IPC bootstrap.
   */
  async function renderHookFixture(): Promise<void> {
    await act(async () => {
      root.render(createElement(HookFixture));
    });
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latestState = null;
    connectionsChangedHandlers = [];
    listTeamHubs = vi.fn().mockResolvedValue([]);

    vi.stubGlobal(
      'window',
      Object.assign(globalThis.window, {
        api: {
          listTeamHubs,
          onStorageConnectionsChanged: (callback: () => void) => {
            connectionsChangedHandlers.push(callback);
            return () => {
              connectionsChangedHandlers = connectionsChangedHandlers.filter(
                (handler) => handler !== callback
              );
            };
          }
        }
      })
    );
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    document.body.removeChild(container);
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('loads configured team hubs on mount', async () => {
    listTeamHubs.mockResolvedValue([makeHub('hub-1')]);
    await renderHookFixture();

    expect(latestState?.loading).toBe(false);
    expect(latestState?.teamHubs).toHaveLength(1);
  });

  it('shows hubs added elsewhere when storage connections change', async () => {
    await renderHookFixture();
    expect(latestState?.teamHubs).toEqual([]);

    listTeamHubs.mockResolvedValue([makeHub('hub-new')]);
    await act(async () => {
      for (const handler of connectionsChangedHandlers) {
        handler();
      }
    });

    expect(latestState?.teamHubs).toHaveLength(1);
    expect(latestState?.teamHubs[0]?.id).toBe('hub-new');
  });

  it('drops hubs deleted elsewhere when storage connections change', async () => {
    listTeamHubs.mockResolvedValue([makeHub('hub-1')]);
    await renderHookFixture();
    expect(latestState?.teamHubs).toHaveLength(1);

    listTeamHubs.mockResolvedValue([]);
    await act(async () => {
      for (const handler of connectionsChangedHandlers) {
        handler();
      }
    });

    expect(latestState?.teamHubs).toEqual([]);
  });

  it('unsubscribes from storage connection changes on unmount', async () => {
    await renderHookFixture();
    expect(connectionsChangedHandlers).toHaveLength(1);

    act(() => {
      root.unmount();
    });
    root = createRoot(container);

    expect(connectionsChangedHandlers).toHaveLength(0);
  });
});
