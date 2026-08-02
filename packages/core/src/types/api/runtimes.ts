import type { Runtime, RuntimeKind } from '../runtime';

/**
 * Result of verifying a runtime executable path and declared version.
 */
export interface VerifyRuntimeResult {
  /**
   * True when the executable ran and its version matched the declared major.minor.
   */
  ok: boolean;

  /**
   * Resolved executable path that was (or would be) spawned.
   */
  resolvedPath: string;

  /**
   * Detected major.minor from the version command, or empty when unavailable.
   */
  detectedVersion: string;

  /**
   * Human-readable error when verification failed; omitted when ok.
   */
  error?: string;
}

/**
 * Input for {@link ApiRuntimes.verifyRuntime}.
 */
export interface VerifyRuntimeInput {
  /**
   * Runtime kind used to pick the catalog binary and version args.
   */
  kind: RuntimeKind;

  /**
   * Declared major.minor version to compare against the binary output.
   */
  version: string;

  /**
   * Absolute path to the executable or its bin directory.
   */
  path: string;
}

/**
 * IPC methods for machine-local companion-process runtimes.
 */
export interface ApiRuntimes {
  /**
   * Lists all configured runtimes from the local registry.
   */
  listRuntimes: () => Promise<Runtime[]>;

  /**
   * Creates or updates a runtime.
   *
   * @param runtime - Runtime to persist; empty id inserts a new runtime.
   * @returns Updated list of all runtimes.
   */
  saveRuntime: (runtime: Runtime) => Promise<Runtime[]>;

  /**
   * Deletes a runtime by id.
   *
   * @param id - Runtime id to remove.
   * @returns Updated list of all runtimes.
   */
  deleteRuntime: (id: string) => Promise<Runtime[]>;

  /**
   * Verifies that a path points at a working executable of the declared version.
   *
   * @param input - Kind, version, and path to verify.
   * @returns Verification result for the Settings UI.
   */
  verifyRuntime: (input: VerifyRuntimeInput) => Promise<VerifyRuntimeResult>;
}
