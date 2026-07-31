import net from 'node:net';

/** First port tried when auto-selecting a free live-server port. */
export const LIVE_SERVER_PORT_BASE = 5500;

/** Upper bound (inclusive) when scanning for a free auto-selected port. */
export const LIVE_SERVER_PORT_MAX = 65535;

/** Default bind host used when probing for a free port. */
const DEFAULT_PROBE_HOST = '127.0.0.1';

/**
 * Returns whether a TCP port can be bound on the given host.
 *
 * @param port - Port number to probe.
 * @param host - Bind host to probe (defaults to `127.0.0.1`).
 * @returns Resolves true when the port is free, false when it is in use or invalid.
 */
export function isPortFree(port: number, host: string = DEFAULT_PROBE_HOST): Promise<boolean> {
  if (!Number.isInteger(port) || port < 1 || port > LIVE_SERVER_PORT_MAX) {
    return Promise.resolve(false);
  }

  const bindHost = host.trim() || DEFAULT_PROBE_HOST;

  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => {
      resolve(false);
    });
    server.listen(port, bindHost, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

/**
 * Finds a free port for a live server on the given bind host.
 *
 * When `preferred` is a positive integer, that exact port is required and the
 * promise rejects if it is busy. When `preferred` is null/undefined, ports are
 * probed upward from {@link LIVE_SERVER_PORT_BASE} (or `startFrom` when set).
 *
 * @param preferred - Explicit port, or null/undefined to auto-select.
 * @param startFrom - When auto-selecting, first port to probe (inclusive).
 * @param host - Bind host to probe (defaults to `127.0.0.1`).
 * @returns A free port number.
 * @throws When an explicit port is busy, or no free port is found in range.
 */
export async function findFreePort(
  preferred: number | null | undefined,
  startFrom: number = LIVE_SERVER_PORT_BASE,
  host: string = DEFAULT_PROBE_HOST
): Promise<number> {
  if (preferred != null) {
    if (!Number.isInteger(preferred) || preferred < 1 || preferred > LIVE_SERVER_PORT_MAX) {
      throw new Error(`Invalid port: ${String(preferred)}`);
    }
    const free = await isPortFree(preferred, host);
    if (!free) {
      throw new Error(`Port ${preferred} is already in use`);
    }
    return preferred;
  }

  const first = Math.max(
    LIVE_SERVER_PORT_BASE,
    Number.isInteger(startFrom) ? startFrom : LIVE_SERVER_PORT_BASE
  );
  for (let port = first; port <= LIVE_SERVER_PORT_MAX; port += 1) {
    // Sequential probes keep the assigned port stable and predictable.
    const free = await isPortFree(port, host);
    if (free) {
      return port;
    }
  }

  throw new Error(`No free port found between ${first} and ${LIVE_SERVER_PORT_MAX}`);
}
