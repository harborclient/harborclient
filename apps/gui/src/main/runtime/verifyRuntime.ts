import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';
import {
  normalizeRuntimeVersion,
  parseRuntimeVersionOutput,
  resolveRuntimeExecutable,
  RUNTIME_CATALOG,
  type Runtime,
  type RuntimeKind
} from '@harborclient/core/types';

/** Max time to wait for a version command before killing it (ms). */
const VERIFY_TIMEOUT_MS = 5000;

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
 * Input accepted by {@link verifyRuntime}.
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
 * Stats a path and returns whether it is a file or directory.
 *
 * @param path - Absolute path to inspect.
 * @returns `'file'` or `'directory'`, or null when the path does not exist.
 */
function statPathKind(path: string): 'file' | 'directory' | null {
  try {
    const stats = statSync(path);
    if (stats.isFile()) {
      return 'file';
    }
    if (stats.isDirectory()) {
      return 'directory';
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Runs the catalog version command for an executable and captures output.
 *
 * @param executable - Absolute executable path.
 * @param kind - Runtime kind whose version args are used.
 * @returns Combined stdout/stderr, or an error message.
 */
async function runVersionCommand(
  executable: string,
  kind: RuntimeKind
): Promise<{ output: string; error?: string }> {
  const args = RUNTIME_CATALOG[kind].versionArgs;
  return await new Promise((resolve) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(executable, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
    } catch (error) {
      resolve({
        output: '',
        error: error instanceof Error ? error.message : 'Failed to spawn version command'
      });
      return;
    }

    /**
     * Settles the promise once with the given result.
     *
     * @param result - Version command outcome.
     */
    const finish = (result: { output: string; error?: string }): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ output: `${stdout}${stderr}`, error: 'Version command timed out' });
    }, VERIFY_TIMEOUT_MS);

    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      finish({ output: `${stdout}${stderr}`, error: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const output = `${stdout}${stderr}`;
      if (code !== 0 && output.trim() === '') {
        finish({ output, error: `Version command exited with code ${code ?? 'unknown'}` });
        return;
      }
      finish({ output });
    });
  });
}

/**
 * Verifies that a runtime path points at a working executable of the declared version.
 *
 * Stats the path, resolves the executable (file vs bin directory), runs the
 * catalog version command, parses major.minor, and compares it to the declared
 * version. A version mismatch returns `ok: false` with the detected version.
 *
 * @param input - Kind, declared version, and path to verify.
 * @returns Verification result for the Settings UI.
 */
export async function verifyRuntime(input: VerifyRuntimeInput): Promise<VerifyRuntimeResult> {
  const path = input.path.trim();
  if (path === '') {
    return {
      ok: false,
      resolvedPath: '',
      detectedVersion: '',
      error: 'Runtime path is empty'
    };
  }

  const pathKind = statPathKind(path);
  if (pathKind == null) {
    return {
      ok: false,
      resolvedPath: path,
      detectedVersion: '',
      error: `Path does not exist: ${path}`
    };
  }

  const resolvedPath = resolveRuntimeExecutable(
    { kind: input.kind, path } satisfies Pick<Runtime, 'kind' | 'path'>,
    pathKind
  );

  if (pathKind === 'directory') {
    const executableKind = statPathKind(resolvedPath);
    if (executableKind !== 'file') {
      return {
        ok: false,
        resolvedPath,
        detectedVersion: '',
        error: `Executable not found at ${resolvedPath}`
      };
    }
  }

  const { output, error } = await runVersionCommand(resolvedPath, input.kind);
  if (error != null && output.trim() === '') {
    return {
      ok: false,
      resolvedPath,
      detectedVersion: '',
      error
    };
  }

  const detectedVersion = parseRuntimeVersionOutput(input.kind, output);
  if (detectedVersion === '') {
    return {
      ok: false,
      resolvedPath,
      detectedVersion: '',
      error: error ?? 'Could not parse version from executable output'
    };
  }

  const declared = normalizeRuntimeVersion(input.version);
  if (declared !== '' && detectedVersion !== declared) {
    return {
      ok: false,
      resolvedPath,
      detectedVersion,
      error: `Expected v${declared} but found v${detectedVersion}`
    };
  }

  return {
    ok: true,
    resolvedPath,
    detectedVersion
  };
}
