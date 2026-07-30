import net from 'node:net';

/** First port tried when auto-selecting a free live-server port. */
export const LIVE_SERVER_PORT_BASE = 5500;

/** Upper bound (inclusive) when scanning for a free auto-selected port. */
export const LIVE_SERVER_PORT_MAX = 65535;

/**
 * Returns whether a TCP port can be bound on loopback.
 *
 * @param port - Port number to probe.
 * @returns Resolves true when the port is free, false when it is in use or invalid.
 */
export function isPortFree(port: number): Promise<boolean> {
  if (!Number.isInteger(port) || port < 1 || port > LIVE_SERVER_PORT_MAX) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => {
      resolve(false);
    });
    server.listen(port, '127.0.0.1', () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

/**
 * Finds a free loopback port for a live server.
 *
 * When `preferred` is a positive integer, that exact port is required and the
 * promise rejects if it is busy. When `preferred` is null/undefined, ports are
 * probed upward from {@link LIVE_SERVER_PORT_BASE}.
 *
 * @param preferred - Explicit port, or null/undefined to auto-select.
 * @returns A free port number.
 * @throws When an explicit port is busy, or no free port is found in range.
 */
export async function findFreePort(preferred: number | null | undefined): Promise<number> {
  if (preferred != null) {
    if (!Number.isInteger(preferred) || preferred < 1 || preferred > LIVE_SERVER_PORT_MAX) {
      throw new Error(`Invalid port: ${String(preferred)}`);
    }
    const free = await isPortFree(preferred);
    if (!free) {
      throw new Error(`Port ${preferred} is already in use`);
    }
    return preferred;
  }

  for (let port = LIVE_SERVER_PORT_BASE; port <= LIVE_SERVER_PORT_MAX; port += 1) {
    // Sequential probes keep the assigned port stable and predictable.
    const free = await isPortFree(port);
    if (free) {
      return port;
    }
  }

  throw new Error(
    `No free port found between ${LIVE_SERVER_PORT_BASE} and ${LIVE_SERVER_PORT_MAX}`
  );
}
