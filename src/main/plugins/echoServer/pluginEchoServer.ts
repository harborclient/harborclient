import type { Server } from 'node:http';
import { createEchoApp } from './app';
import type { EchoServerIncomingRequest, EchoServerStatus } from './types';

interface EchoServerEntry {
  server: Server;
  port: number;
}

const servers = new Map<string, EchoServerEntry>();

/**
 * Handler invoked for each incoming HTTP request on a plugin echo server.
 */
export type EchoServerIncomingHandler = (
  pluginId: string,
  request: EchoServerIncomingRequest
) => Promise<unknown>;

let incomingHandler: EchoServerIncomingHandler | null = null;

/**
 * Registers the callback used when an echo server receives a request.
 *
 * @param handler - Processes incoming requests and returns the JSON response body.
 */
export function setEchoServerIncomingHandler(handler: EchoServerIncomingHandler | null): void {
  incomingHandler = handler;
}

/**
 * Starts an echo HTTP server for one plugin.
 *
 * Binds to loopback (`127.0.0.1`) only so request headers and bodies are not
 * exposed on the local network. LAN access would require an explicit future opt-in.
 *
 * @param pluginId - Plugin manifest id.
 * @param options - Listen options; port 0 selects the first available non-privileged port.
 * @returns Assigned listen port after the server is accepting connections.
 */
export async function startEchoServer(
  pluginId: string,
  options: { port: number }
): Promise<number> {
  await stopEchoServer(pluginId);

  const app = createEchoApp(async (request) => {
    if (!incomingHandler) {
      return undefined;
    }
    try {
      return await incomingHandler(pluginId, request);
    } catch {
      return undefined;
    }
  });

  const server = await new Promise<Server>((resolve, reject) => {
    const instance = app.listen(options.port, '127.0.0.1', () => {
      resolve(instance);
    });
    instance.on('error', reject);
  });

  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : options.port;

  servers.set(pluginId, { server, port });
  return port;
}

/**
 * Stops the echo server owned by one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export async function stopEchoServer(pluginId: string): Promise<void> {
  const entry = servers.get(pluginId);
  if (!entry) {
    return;
  }
  servers.delete(pluginId);
  await new Promise<void>((resolve, reject) => {
    entry.server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

/**
 * Returns whether a plugin echo server is running and its listen port.
 *
 * @param pluginId - Plugin manifest id.
 */
export function getEchoServerStatus(pluginId: string): EchoServerStatus {
  const entry = servers.get(pluginId);
  if (!entry) {
    return { running: false };
  }
  return { running: true, port: entry.port };
}

/**
 * Stops every plugin echo server during app shutdown.
 */
export async function stopAllEchoServers(): Promise<void> {
  const pluginIds = [...servers.keys()];
  for (const pluginId of pluginIds) {
    await stopEchoServer(pluginId);
  }
}
