import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { findFreePort, isPortFree, LIVE_SERVER_PORT_BASE } from './ports';

const heldServers: net.Server[] = [];

/**
 * Holds a TCP port open on the given host so findFreePort can observe it as busy.
 *
 * @param port - Port to occupy.
 * @param host - Bind host (defaults to loopback).
 * @returns Resolves when the server is listening.
 */
async function holdPort(port: number, host: string = '127.0.0.1'): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, host, () => {
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

  it('probes the requested bind host', async () => {
    const port = await findFreePort(null, LIVE_SERVER_PORT_BASE, '127.0.0.1');
    await holdPort(port, '127.0.0.1');
    await expect(isPortFree(port, '127.0.0.1')).resolves.toBe(false);
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

  it('rejects when an explicit port is busy on a non-default host', async () => {
    const port = await findFreePort(null, LIVE_SERVER_PORT_BASE, '127.0.0.1');
    await holdPort(port, '127.0.0.1');
    await expect(findFreePort(port, LIVE_SERVER_PORT_BASE, '127.0.0.1')).rejects.toThrow(
      `Port ${port} is already in use`
    );
  });

  it('rejects invalid explicit ports', async () => {
    await expect(findFreePort(0)).rejects.toThrow('Invalid port');
    await expect(findFreePort(70000)).rejects.toThrow('Invalid port');
  });
});
