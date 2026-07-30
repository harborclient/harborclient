import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultLiveServerCorsSettings } from '@harborclient/core/types';
import {
  clearLiveServerLogs,
  getLiveServerLogs,
  startLiveServer,
  stopAllLiveServers,
  stopLiveServer
} from './liveServerHost';

const tempRoots: string[] = [];

/**
 * Creates a temporary document root with an index.html file.
 *
 * @returns Absolute path to the new directory.
 */
function makeTempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hc-live-host-'));
  tempRoots.push(dir);
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>host</h1>');
  return dir;
}

afterEach(async () => {
  await stopAllLiveServers();
  for (const dir of tempRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('liveServerHost request logs', () => {
  it('buffers request logs and clears them by saved id', async () => {
    const root = makeTempRoot();
    const running = await startLiveServer({
      savedId: 42,
      config: {
        name: 'Docs',
        root,
        port: null,
        aliases: [],
        watch: false,
        cors: defaultLiveServerCorsSettings()
      }
    });

    const response = await fetch(`${running.origin}/`);
    expect(response.status).toBe(200);

    // Allow the Express finish handler to append the access log.
    await waitForLogs(42, 1);

    const logs = getLiveServerLogs({ savedId: 42 });
    expect(logs).toHaveLength(1);
    expect(logs[0]?.method).toBe('GET');
    expect(logs[0]?.url).toBe('/');
    expect(logs[0]?.savedId).toBe(42);
    expect(logs[0]?.id).toBe(running.id);

    clearLiveServerLogs({ savedId: 42 });
    expect(getLiveServerLogs({ savedId: 42 })).toEqual([]);

    await stopLiveServer(running.id);
    expect(getLiveServerLogs({ savedId: 42 })).toEqual([]);
  });

  it('returns an empty list when the server is not running', () => {
    expect(getLiveServerLogs({ savedId: 99 })).toEqual([]);
    expect(getLiveServerLogs({ id: 'missing' })).toEqual([]);
  });
});

/**
 * Polls until buffered logs reach the expected count or the timeout elapses.
 *
 * @param savedId - Saved live server id to query.
 * @param count - Expected minimum number of log entries.
 */
async function waitForLogs(savedId: number, count: number): Promise<void> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (getLiveServerLogs({ savedId }).length >= count) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${count} live-server log(s)`);
}
