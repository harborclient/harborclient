import { afterEach, describe, expect, it } from 'vitest';
import {
  clearAllLiveServerLogSessions,
  clearLiveServerLogSessionLogs,
  createLiveServerLogSession,
  findLiveServerLogSessionIdForSavedId,
  freezeLiveServerLogSession,
  getLiveServerLogSessionLogs,
  listLiveServerLogSessions,
  resetLiveServerLogSessionsForTests
} from './liveServerLogSessions';
import type { LiveServerLogEntry } from '@harborclient/core/types';

afterEach(() => {
  resetLiveServerLogSessionsForTests();
});

describe('liveServerLogSessions', () => {
  it('lists a session as active after create and inactive after freeze', () => {
    const logs: LiveServerLogEntry[] = [];
    createLiveServerLogSession(
      {
        id: 'runtime-1',
        savedId: 1,
        serverName: 'Demo',
        origin: 'http://127.0.0.1:5500',
        startedAt: 1000
      },
      logs
    );

    expect(listLiveServerLogSessions()).toEqual([
      {
        id: 'runtime-1',
        savedId: 1,
        serverName: 'Demo',
        origin: 'http://127.0.0.1:5500',
        startedAt: 1000,
        stoppedAt: null,
        active: true
      }
    ]);

    freezeLiveServerLogSession('runtime-1', 2000);

    expect(listLiveServerLogSessions()).toEqual([
      {
        id: 'runtime-1',
        savedId: 1,
        serverName: 'Demo',
        origin: 'http://127.0.0.1:5500',
        startedAt: 1000,
        stoppedAt: 2000,
        active: false
      }
    ]);
  });

  it('retains log lines after freeze and clears them without removing the session', () => {
    const logs: LiveServerLogEntry[] = [];
    createLiveServerLogSession(
      {
        id: 'runtime-2',
        savedId: 2,
        serverName: 'Demo',
        origin: 'http://127.0.0.1:5501',
        startedAt: 1000
      },
      logs
    );

    logs.push({
      kind: 'access',
      id: 'runtime-2',
      savedId: 2,
      timestamp: 1100,
      method: 'GET',
      url: '/',
      statusCode: 200,
      durationMs: 1,
      contentLength: null
    });

    freezeLiveServerLogSession('runtime-2', 2000);

    expect(getLiveServerLogSessionLogs({ id: 'runtime-2' })).toHaveLength(1);
    expect(getLiveServerLogSessionLogs({ savedId: 2 })).toHaveLength(1);

    clearLiveServerLogSessionLogs({ id: 'runtime-2' });
    expect(getLiveServerLogSessionLogs({ id: 'runtime-2' })).toEqual([]);
    expect(listLiveServerLogSessions()).toHaveLength(1);
  });

  it('prefers the active session for a saved id, else the latest', () => {
    const older: LiveServerLogEntry[] = [];
    const newer: LiveServerLogEntry[] = [];
    createLiveServerLogSession(
      {
        id: 'older',
        savedId: 3,
        serverName: 'Demo',
        origin: 'http://127.0.0.1:5502',
        startedAt: 1000
      },
      older
    );
    freezeLiveServerLogSession('older', 1500);
    createLiveServerLogSession(
      {
        id: 'active',
        savedId: 3,
        serverName: 'Demo',
        origin: 'http://127.0.0.1:5503',
        startedAt: 2000
      },
      newer
    );

    expect(findLiveServerLogSessionIdForSavedId(3)).toBe('active');
    freezeLiveServerLogSession('active', 2500);
    expect(findLiveServerLogSessionIdForSavedId(3)).toBe('active');

    createLiveServerLogSession(
      {
        id: 'latest',
        savedId: 3,
        serverName: 'Demo',
        origin: 'http://127.0.0.1:5504',
        startedAt: 3000
      },
      []
    );
    freezeLiveServerLogSession('latest', 3100);
    expect(findLiveServerLogSessionIdForSavedId(3)).toBe('latest');
  });

  it('clearAll drops inactive sessions and empties active buffers', () => {
    const activeLogs: LiveServerLogEntry[] = [];
    createLiveServerLogSession(
      {
        id: 'active',
        savedId: 1,
        serverName: 'A',
        origin: 'http://127.0.0.1:1',
        startedAt: 1
      },
      activeLogs
    );
    activeLogs.push({
      kind: 'access',
      id: 'active',
      savedId: 1,
      timestamp: 2,
      method: 'GET',
      url: '/',
      statusCode: 200,
      durationMs: 1,
      contentLength: null
    });
    createLiveServerLogSession(
      {
        id: 'stopped',
        savedId: 2,
        serverName: 'B',
        origin: 'http://127.0.0.1:2',
        startedAt: 3
      },
      []
    );
    freezeLiveServerLogSession('stopped', 4);

    expect(clearAllLiveServerLogSessions()).toBe(true);
    expect(listLiveServerLogSessions()).toEqual([
      {
        id: 'active',
        savedId: 1,
        serverName: 'A',
        origin: 'http://127.0.0.1:1',
        startedAt: 1,
        stoppedAt: null,
        active: true
      }
    ]);
    expect(getLiveServerLogSessionLogs({ id: 'active' })).toEqual([]);
    expect(clearAllLiveServerLogSessions()).toBe(true);
  });
});
