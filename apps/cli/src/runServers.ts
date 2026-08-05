import {
  setLiveServerProcessLogHandler,
  setLiveServerRequestLogHandler,
  setLiveServerScriptLogHandler,
  startLiveServer,
  stopLiveServer,
  toLiveServerConfig,
  type LiveServerHostProviders
} from '@harborclient/live-server';
import { normalizeRuntimes, type Runtime } from '@harborclient/core/types';
import { parseJson } from '@harborclient/core/parseJson';
import { initLocalDatabase } from '@harborclient/storage-sqlite';
import { CliSettingsProvider } from './adapters/CliSettingsProvider.js';
import { NodeScriptRunner } from './adapters/NodeScriptRunner.js';
import { findLiveServer } from './findLiveServer.js';
import { resolveHarborUserDataPath } from './userDataPath.js';

/**
 * Options for {@link runServersCommand}.
 */
export interface RunServersOptions {
  /**
   * Live server display name or uuid.
   */
  serverRef: string;

  /**
   * Optional Electron userData override.
   */
  userDataPath?: string;
}

/**
 * Builds a globals map from Settings, with optional session overlays.
 *
 * @param settingsProvider - CLI settings reader.
 * @param overlays - Extra key/value pairs (e.g. urlVariable → origin).
 * @returns Key → value map for scripts and runCommand substitution.
 */
function buildVariablesMap(
  settingsProvider: CliSettingsProvider,
  overlays: Record<string, string> = {}
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const variable of settingsProvider.getGeneralSettings().globalVariables) {
    if (variable.enabled === false) {
      continue;
    }
    const key = variable.key.trim();
    if (key === '') {
      continue;
    }
    map[key] = variable.value;
  }
  return { ...map, ...overlays };
}

/**
 * Formats one access / process / script log line for stderr.
 *
 * @param kind - Log category label.
 * @param message - Line body.
 */
function writeLogLine(kind: string, message: string): void {
  console.error(`[${kind}] ${message}`);
}

/**
 * Waits until SIGINT or SIGTERM, then resolves.
 *
 * @returns Promise that settles when the user interrupts the process.
 */
function waitForShutdownSignal(): Promise<void> {
  return new Promise((resolve) => {
    /**
     * Clears handlers and resolves the waiter.
     */
    const onSignal = (): void => {
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      resolve();
    };
    process.on('SIGINT', onSignal);
    process.on('SIGTERM', onSignal);
  });
}

/**
 * Loads a saved live server from the GUI registry and serves it until Ctrl+C.
 *
 * Prints the listening origin to stdout. Access, process, and script logs go
 * to stderr. Does not open a browser. When `urlVariable` is set, overlays that
 * key with the origin in the in-memory variable map only (does not persist
 * Settings).
 *
 * @param options - Server reference and optional userData path.
 * @returns Exit code (0 success, 1 failure).
 */
export async function runServersCommand(options: RunServersOptions): Promise<number> {
  const userDataPath = resolveHarborUserDataPath(options.userDataPath);
  const database = await initLocalDatabase(userDataPath);
  const settingsProvider = new CliSettingsProvider(database);
  const settings = settingsProvider.getGeneralSettings();
  const scriptRunner = new NodeScriptRunner(settings.scriptTimeoutMs, true);

  const servers = database.listLiveServers();
  const saved = findLiveServer(servers, options.serverRef);
  if (saved == null) {
    console.error(`Live server not found: ${options.serverRef}`);
    console.error(
      `Available: ${servers.map((server) => server.name).join(', ') || '(none — is userData correct?)'}`
    );
    console.error(`userData: ${userDataPath}`);
    scriptRunner.dispose();
    return 1;
  }

  const config = toLiveServerConfig(saved);
  const overlays: Record<string, string> = {};

  /**
   * Looks up a machine-local runtime from the registry settings blob.
   *
   * @param id - Runtime id from the live server config.
   * @returns Matching runtime, or undefined when missing.
   */
  function getRuntime(id: string): Runtime | undefined {
    const trimmed = id.trim();
    if (trimmed === '') {
      return undefined;
    }
    const parsed = parseJson(database.getSetting('runtimes'), []);
    const runtimes = normalizeRuntimes(Array.isArray(parsed) ? parsed : []);
    return runtimes.find((runtime) => runtime.id === trimmed);
  }

  const providers: LiveServerHostProviders = {
    listSnippets: () => database.listSnippets(),
    getVariables: () => buildVariablesMap(settingsProvider, overlays),
    getRuntime,
    runScript: (input) => scriptRunner.run(input)
  };

  setLiveServerRequestLogHandler((entry) => {
    writeLogLine(
      'access',
      `${entry.method} ${entry.url} → ${entry.statusCode} (${entry.durationMs}ms)`
    );
  });
  setLiveServerProcessLogHandler((entry) => {
    writeLogLine(`process:${entry.stream}`, entry.message);
  });
  setLiveServerScriptLogHandler((entry) => {
    const detail =
      entry.level === 'test'
        ? `${entry.passed ? 'pass' : 'fail'}: ${entry.message}`
        : entry.message;
    writeLogLine(`script:${entry.level}`, detail);
  });

  let runtimeId: string | null = null;
  try {
    const running = await startLiveServer({ savedId: saved.id, config }, providers);
    runtimeId = running.id;

    const urlVariable = running.config.urlVariable.trim();
    if (urlVariable !== '') {
      overlays[urlVariable] = running.origin;
    }

    process.stdout.write(`${running.origin}\n`);
    console.error(`Serving "${saved.name}" — press Ctrl+C to stop`);

    await waitForShutdownSignal();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    scriptRunner.dispose();
    return 1;
  } finally {
    setLiveServerRequestLogHandler(null);
    setLiveServerProcessLogHandler(null);
    setLiveServerScriptLogHandler(null);
    if (runtimeId != null) {
      try {
        await stopLiveServer(runtimeId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed to stop live server: ${message}`);
      }
    }
    scriptRunner.dispose();
  }

  return 0;
}
