import type { ImportFile } from '#/shared/plugin/importHandlers';
import { logImportVerbose } from '#/renderer/src/import/importVerboseLog';

/**
 * Local import handler with in-process callbacks (reference context and tests).
 */
interface LocalImportHandlerEntry {
  /**
   * Registration mode stored in the host renderer.
   */
  mode: 'local';

  /**
   * Plugin manifest id that owns the handler.
   */
  pluginId: string;

  /**
   * Normalized dot-prefixed extensions handled by this registration.
   */
  extensions: string[];

  /**
   * Returns whether the handler should import the selected file.
   */
  canImport: (file: ImportFile) => boolean | Promise<boolean>;

  /**
   * Performs the import workflow for a matched file.
   */
  import: (file: ImportFile) => void | Promise<void>;
}

/**
 * Bridged import handler registered by a plugin agent webview.
 */
interface BridgedImportHandlerEntry {
  /**
   * Registration mode stored in the host renderer.
   */
  mode: 'bridged';

  /**
   * Plugin manifest id that owns the handler.
   */
  pluginId: string;

  /**
   * Agent-scoped registration id forwarded through the UI broker.
   */
  registrationId: string;

  /**
   * Normalized dot-prefixed extensions handled by this registration.
   */
  extensions: string[];
}

/** Discriminated union of host-side import handler registrations. */
type ImportHandlerEntry = LocalImportHandlerEntry | BridgedImportHandlerEntry;

const handlers: ImportHandlerEntry[] = [];

/**
 * Returns a snapshot of registered import handlers for verbose diagnostics.
 *
 * @returns Serializable handler metadata in registration order.
 */
export function getImportHandlerSnapshot(): Array<{
  mode: ImportHandlerEntry['mode'];
  pluginId: string;
  extensions: string[];
  registrationId?: string;
}> {
  return handlers.map((handler) =>
    handler.mode === 'bridged'
      ? {
          mode: handler.mode,
          pluginId: handler.pluginId,
          extensions: handler.extensions,
          registrationId: handler.registrationId
        }
      : {
          mode: handler.mode,
          pluginId: handler.pluginId,
          extensions: handler.extensions
        }
  );
}

/**
 * Normalizes a file extension to lowercase with a leading dot.
 *
 * @param extension - Extension with or without a leading dot.
 * @returns Normalized extension such as `.json`.
 */
export function normalizeImportExtension(extension: string): string {
  const trimmed = extension.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

/**
 * Normalizes one extension or an array of extensions for handler registration.
 *
 * @param extensions - Single extension or list of extensions.
 * @returns Deduplicated normalized extensions.
 */
export function normalizeImportExtensions(extensions: string | string[]): string[] {
  const values = Array.isArray(extensions) ? extensions : [extensions];
  const normalized = values
    .map((extension) => normalizeImportExtension(extension))
    .filter((extension) => extension.length > 0);
  return [...new Set(normalized)];
}

/**
 * Converts dialog filter extensions (without dots) from registered handlers.
 *
 * @returns Lowercase extensions suitable for Electron open-dialog filters.
 */
export function getRegisteredImportExtensions(): string[] {
  const values = new Set<string>();
  for (const handler of handlers) {
    for (const extension of handler.extensions) {
      values.add(extension.slice(1));
    }
  }
  return [...values].sort();
}

/**
 * Registers an import handler owned by one plugin in the host renderer.
 *
 * Used by the reference {@link createPluginContext} implementation and unit tests.
 *
 * @param pluginId - Plugin manifest id.
 * @param extensions - Normalized dot-prefixed extensions.
 * @param handler - Import detection and execution callbacks.
 * @returns Disposable that removes the handler on dispose.
 */
export function registerImportHandlerContribution(
  pluginId: string,
  extensions: string[],
  handler: Pick<LocalImportHandlerEntry, 'canImport' | 'import'>
): { dispose: () => void } {
  const entry: LocalImportHandlerEntry = {
    mode: 'local',
    pluginId,
    extensions,
    canImport: handler.canImport,
    import: handler.import
  };
  handlers.push(entry);
  logImportVerbose('handler registered (local)', {
    pluginId,
    extensions
  });

  return {
    dispose: () => {
      const index = handlers.indexOf(entry);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  };
}

/**
 * Registers bridged import handler metadata forwarded from a plugin agent webview.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 * @param extensions - Normalized dot-prefixed extensions.
 */
export function registerBridgedImportHandler(
  pluginId: string,
  registrationId: string,
  extensions: string[]
): void {
  handlers.push({
    mode: 'bridged',
    pluginId,
    registrationId,
    extensions
  });
  logImportVerbose('handler registered (bridged)', {
    pluginId,
    registrationId,
    extensions
  });
}

/**
 * Removes one bridged import handler registration.
 *
 * @param pluginId - Plugin manifest id.
 * @param registrationId - Agent-scoped registration id.
 */
export function unregisterBridgedImportHandler(pluginId: string, registrationId: string): void {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    const entry = handlers[index];
    if (
      entry?.mode === 'bridged' &&
      entry.pluginId === pluginId &&
      entry.registrationId === registrationId
    ) {
      handlers.splice(index, 1);
    }
  }
}

/**
 * Removes every import handler owned by one plugin.
 *
 * @param pluginId - Plugin manifest id.
 */
export function clearPluginImportHandlers(pluginId: string): void {
  for (let index = handlers.length - 1; index >= 0; index -= 1) {
    if (handlers[index]?.pluginId === pluginId) {
      handlers.splice(index, 1);
    }
  }
}

/**
 * Finds handlers whose registered extensions match the selected file.
 *
 * @param file - Import file forwarded from the main process.
 * @returns Handlers in registration order.
 */
function handlersForFile(file: ImportFile): ImportHandlerEntry[] {
  const extension = normalizeImportExtension(file.extension);
  return handlers.filter((handler) => handler.extensions.includes(extension));
}

/**
 * Invokes one import handler phase for a bridged registration.
 *
 * @param handler - Bridged handler metadata from the host registry.
 * @param phase - Import detection or execution phase.
 * @param file - Selected import file from File → Import.
 */
async function invokeBridgedImportHandler(
  handler: BridgedImportHandlerEntry,
  phase: 'canImport' | 'import',
  file: ImportFile
): Promise<unknown> {
  return window.api.invokePluginImportHandler(
    handler.pluginId,
    handler.registrationId,
    phase,
    file
  );
}

/**
 * Runs plugin import handlers for a file unrecognized by built-in importers.
 *
 * @param file - Selected import file from File -> Import.
 * @throws When no handler matches or a handler import callback fails.
 */
export async function runPluginImportHandlers(file: ImportFile): Promise<void> {
  const matchingHandlers = handlersForFile(file);
  logImportVerbose('runPluginImportHandlers start', {
    fileName: file.name,
    extension: file.extension,
    handlerCount: handlers.length,
    matchingHandlerCount: matchingHandlers.length,
    handlers: getImportHandlerSnapshot()
  });

  for (const handler of matchingHandlers) {
    let canImport = false;
    try {
      if (handler.mode === 'local') {
        canImport = Boolean(await handler.canImport(file));
      } else {
        canImport = Boolean(await invokeBridgedImportHandler(handler, 'canImport', file));
      }
      logImportVerbose('handler canImport result', {
        pluginId: handler.pluginId,
        mode: handler.mode,
        registrationId: handler.mode === 'bridged' ? handler.registrationId : undefined,
        canImport
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Plugin ${handler.pluginId} failed while checking import support: ${message}`
      );
    }

    if (!canImport) {
      continue;
    }

    try {
      if (handler.mode === 'local') {
        await handler.import(file);
      } else {
        await invokeBridgedImportHandler(handler, 'import', file);
      }
      logImportVerbose('handler import completed', {
        pluginId: handler.pluginId,
        mode: handler.mode,
        registrationId: handler.mode === 'bridged' ? handler.registrationId : undefined
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Plugin ${handler.pluginId} failed to import: ${message}`);
    }
  }

  logImportVerbose('runPluginImportHandlers no match', {
    fileName: file.name,
    extension: file.extension,
    handlerCount: handlers.length
  });
  throw new Error('No plugin can import this file.');
}

/**
 * Clears every registered import handler — test helper only.
 */
export function clearAllImportHandlersForTests(): void {
  handlers.length = 0;
}
