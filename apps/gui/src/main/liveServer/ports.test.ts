import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { findFreePort, isPortFree, LIVE_SERVER_PORT_BASE } from './ports';

const heldServers: net.Server[] = [];

/**
 * Holds a loopback port open so findFreePort can observe it as busy.
 *
 * @param port - Port to occupy.
 * @returns Resolves when the server is listening.
 */
async function holdPort(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      heldServers.push(server);
      resolve();
    });
  });
}

afterEach(async () => {
  await Promise.all(
    heldServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );
});

describe('isPortFree', () => {
  it('returns false for invalid ports', async () => {
    await expect(isPortFree(0)).resolves.toBe(false);
    await expect(isPortFree(-1)).resolves.toBe(false);
    await expect(isPortFree(70000)).resolves.toBe(false);
  });

  it('returns false when a port is occupied', async () => {
    const port = await findFreePort(null);
    await holdPort(port);
    await expect(isPortFree(port)).resolves.toBe(false);
  });
});

describe('findFreePort', () => {
  it('auto-selects from the base port upward', async () => {
    const port = await findFreePort(null);
    expect(port).toBeGreaterThanOrEqual(LIVE_SERVER_PORT_BASE);
    await expect(isPortFree(port)).resolves.toBe(true);
  });

  it('returns an explicit free port', async () => {
    const candidate = await findFreePort(null);
    await expect(findFreePort(candidate)).resolves.toBe(candidate);
  });

  it('rejects when an explicit port is busy', async () => {
    const port = await findFreePort(null);
    await holdPort(port);
    await expect(findFreePort(port)).rejects.toThrow(`Port ${port} is already in use`);
  });

  it('rejects invalid explicit ports', async () => {
    await expect(findFreePort(0)).rejects.toThrow('Invalid port');
    await expect(findFreePort(70000)).rejects.toThrow('Invalid port');
  });
});
