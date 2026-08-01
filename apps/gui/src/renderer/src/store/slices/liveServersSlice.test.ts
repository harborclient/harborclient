import { describe, expect, it } from 'vitest';
import type { LiveServer, RunningLiveServer } from '@harborclient/core/types';
import {
  defaultLiveServerCorsSettings,
  normalizeLiveServerConfigFields
} from '@harborclient/core/types';
import liveServersReducer, {
  bindLiveServerTab,
  setLiveServerLogSessions,
  setLiveServerLogsSelection,
  setLiveServerLogsSessionId,
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
    ...normalizeLiveServerConfigFields(undefined),
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
      cors: defaultLiveServerCorsSettings(),
      ...normalizeLiveServerConfigFields(undefined)
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
      tabIdsByServerId: {},
      logSessions: [],
      logsSavedId: null,
      logsSessionId: null,
      logsSelections: {}
    });
  });

  it('stores access-log selection snapshots by token', () => {
    const token = '@logs.55555555-5555-5555-5555-555555555555#1.40';
    const state = liveServersReducer(
      undefined,
      setLiveServerLogsSelection({
        token,
        snapshot: {
          label: 'Logs: Docs',
          startLine: 1,
          endLine: 40,
          selectedText: 'GET / 200',
          contextText: 'GET / 200'
        }
      })
    );
    expect(state.logsSelections[token]?.label).toBe('Logs: Docs');
  });

  it('replaces saved and running lists', () => {
    let state = liveServersReducer(undefined, setSavedLiveServers([savedServer(1)]));
    expect(state.saved).toHaveLength(1);
    state = liveServersReducer(state, setRunningLiveServers([runningServer('a')]));
    expect(state.running).toHaveLength(1);
  });

  it('stores log sessions and clears a removed selected session id', () => {
    let state = liveServersReducer(
      undefined,
      setLiveServerLogSessions([
        {
          id: 'sess-1',
          savedId: 1,
          serverName: 'Demo',
          origin: 'http://127.0.0.1:5500',
          startedAt: 1,
          stoppedAt: null,
          active: true
        }
      ])
    );
    state = liveServersReducer(state, setLiveServerLogsSessionId('sess-1'));
    expect(state.logsSessionId).toBe('sess-1');

    state = liveServersReducer(state, setLiveServerLogSessions([]));
    expect(state.logSessions).toEqual([]);
    expect(state.logsSessionId).toBeNull();
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
