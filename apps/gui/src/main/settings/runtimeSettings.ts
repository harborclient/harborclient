import { randomUUID } from 'crypto';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { parseJson } from '@harborclient/core/parseJson';
import { normalizeRuntime, normalizeRuntimes, type Runtime } from '@harborclient/core/types';

const RUNTIMES_KEY = 'runtimes';

/**
 * Persists the runtime list to the local registry.
 *
 * @param runtimes - Runtimes to store.
 */
function persistRuntimes(runtimes: Runtime[]): void {
  getLocalDatabase().setSetting(RUNTIMES_KEY, JSON.stringify(runtimes));
}

/**
 * Reads and normalizes runtimes from the local registry.
 *
 * @returns Normalized runtime list (empty when unset).
 */
function readRuntimes(): Runtime[] {
  return normalizeRuntimes(parseJson<unknown>(getLocalDatabase().getSetting(RUNTIMES_KEY), []));
}

/**
 * Lists all configured machine-local runtimes.
 *
 * @returns Persisted runtimes.
 */
export function listRuntimes(): Runtime[] {
  return readRuntimes();
}

/**
 * Returns a runtime by id, or undefined when not found.
 *
 * @param id - Runtime id to look up.
 * @returns Matching runtime, or undefined.
 */
export function getRuntime(id: string): Runtime | undefined {
  const trimmed = id.trim();
  if (trimmed === '') {
    return undefined;
  }
  return listRuntimes().find((runtime) => runtime.id === trimmed);
}

/**
 * Creates or updates a runtime in the local registry.
 *
 * Empty ids are replaced with a new uuid. Invalid kinds throw.
 *
 * @param input - Runtime to persist.
 * @returns Updated list of all runtimes.
 * @throws When the runtime kind is unsupported.
 */
export function saveRuntime(input: Runtime): Runtime[] {
  const normalized = normalizeRuntime(input);
  if (normalized == null) {
    throw new Error('Unsupported runtime kind');
  }
  const runtime: Runtime = {
    ...normalized,
    id: normalized.id || randomUUID()
  };
  const runtimes = listRuntimes();
  const index = runtimes.findIndex((entry) => entry.id === runtime.id);
  if (index >= 0) {
    runtimes[index] = runtime;
  } else {
    runtimes.push(runtime);
  }
  persistRuntimes(runtimes);
  return runtimes;
}

/**
 * Deletes a runtime by id.
 *
 * @param id - Runtime id to remove.
 * @returns Updated list of all runtimes.
 * @throws When the id is unknown.
 */
export function deleteRuntime(id: string): Runtime[] {
  const trimmed = id.trim();
  const runtimes = listRuntimes();
  const next = runtimes.filter((runtime) => runtime.id !== trimmed);
  if (next.length === runtimes.length) {
    throw new Error(`Unknown runtime: ${trimmed}`);
  }
  persistRuntimes(next);
  return next;
}
