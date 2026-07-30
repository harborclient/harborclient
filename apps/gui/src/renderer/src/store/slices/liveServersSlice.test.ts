import { describe, expect, it } from 'vitest';
import type { LiveServer, RunningLiveServer } from '@harborclient/core/types';
import { defaultLiveServerCorsSettings } from '@harborclient/core/types';
import liveServersReducer, {
  bindLiveServerTab,
  setRunningLiveServers,
  setSavedLiveServers,
  unbindLiveServerTab
} from './liveServersSlice';

/**
 * Builds a minimal saved live server for slice tests.
 *
 * @param id - Database id.
 * @returns Saved live server fixture.
 */
function savedServer(id: number): LiveServer {
  return {
    id,
    uuid: `uuid-${id}`,
    name: `Server ${id}`,
    root: `/tmp/site-${id}`,
    port: null,
    aliases: [],
    watch: true,
    cors: defaultLiveServerCorsSettings(),
    sortOrder: id,
    createdAt: 1,
    updatedAt: 1
  };
}

/**
 * Builds a minimal running live server for slice tests.
 *
 * @param id - Runtime instance id.
 * @returns Running live server fixture.
 */
function runningServer(id: string): RunningLiveServer {
  return {
    id,
    savedId: null,
    config: {
      name: id,
      root: `/tmp/${id}`,
      port: null,
      aliases: [],
      watch: true,
      cors: defaultLiveServerCorsSettings()
    },
    port: 5500,
    origin: 'http://127.0.0.1:5500',
    startedAt: 1
  };
}

describe('liveServersSlice', () => {
  it('starts empty', () => {
    const state = liveServersReducer(undefined, { type: 'unknown' });
    expect(state).toEqual({
      saved: [],
      running: [],
      tabIdsByServerId: {}
    });
  });

  it('replaces saved and running lists', () => {
    let state = liveServersReducer(undefined, setSavedLiveServers([savedServer(1)]));
    expect(state.saved).toHaveLength(1);
    state = liveServersReducer(state, setRunningLiveServers([runningServer('a')]));
    expect(state.running).toHaveLength(1);
  });

  it('binds and unbinds browser tabs for running servers', () => {
    let state = liveServersReducer(undefined, bindLiveServerTab({ serverId: 'a', tabId: 'tab-1' }));
    expect(state.tabIdsByServerId).toEqual({ a: 'tab-1' });
    state = liveServersReducer(state, unbindLiveServerTab('a'));
    expect(state.tabIdsByServerId).toEqual({});
  });

  it('clears tab bindings for servers that are no longer running', () => {
    let state = liveServersReducer(undefined, bindLiveServerTab({ serverId: 'a', tabId: 'tab-1' }));
    state = liveServersReducer(state, bindLiveServerTab({ serverId: 'b', tabId: 'tab-2' }));
    state = liveServersReducer(state, setRunningLiveServers([runningServer('a')]));
    expect(state.tabIdsByServerId).toEqual({ a: 'tab-1' });
  });
});
