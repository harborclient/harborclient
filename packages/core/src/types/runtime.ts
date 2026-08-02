import type { KeyValue } from './common';

/**
 * Supported companion-process runtime kinds for live server run commands.
 */
export type RuntimeKind = 'node' | 'php' | 'python';

/**
 * Machine-local runtime definition (executable path + env vars).
 *
 * Paths differ per machine, so runtimes are stored in the local registry and
 * referenced from live servers by id. Live-server exports carry a portable
 * {@link RuntimeRequirement} instead of the id/path. Settings → Runtimes
 * can also export a full {@link RuntimeExport} / {@link RuntimesExport}
 * backup that includes path and env.
 */
export interface Runtime {
  /**
   * Stable identifier for this runtime on the current machine.
   */
  id: string;

  /**
   * Display name shown in Settings and the live-server Runtime dropdown.
   */
  name: string;

  /**
   * Runtime family (Node, PHP, or Python).
   */
  kind: RuntimeKind;

  /**
   * Declared major.minor version (no patch), e.g. `"22.14"` or `"8.3"`.
   */
  version: string;

  /**
   * Absolute path to the executable file, or to a bin directory containing it.
   */
  path: string;

  /**
   * Environment variables applied when spawning this runtime.
   * Values may include `{{variables}}` resolved at spawn time.
   */
  env: KeyValue[];
}

/**
 * Portable single-runtime export file format (Settings → Runtimes).
 *
 * Includes machine-local path and env so the file is a full backup of the
 * configured runtime on this machine.
 */
export interface RuntimeExport {
  /**
   * HarborClient export schema version for forward compatibility.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a single runtime export.
   */
  harborclientExport: 'runtime';

  /**
   * Stable identifier for this runtime on the exporting machine.
   */
  id: string;

  /**
   * Display name shown in Settings and the live-server Runtime dropdown.
   */
  name: string;

  /**
   * Runtime family (Node, PHP, or Python).
   */
  kind: RuntimeKind;

  /**
   * Declared major.minor version (no patch), e.g. `"22.14"` or `"8.3"`.
   */
  version: string;

  /**
   * Absolute path to the executable file, or to a bin directory containing it.
   */
  path: string;

  /**
   * Environment variables applied when spawning this runtime.
   */
  env: KeyValue[];
}

/**
 * Portable multi-runtime export file format (Settings → Runtimes → Export all).
 */
export interface RuntimesExport {
  /**
   * HarborClient export schema version for forward compatibility.
   */
  harborclientVersion: 1;

  /**
   * Discriminator identifying this file as a runtimes bundle export.
   */
  harborclientExport: 'runtimes';

  /**
   * Ordered runtime definitions from the local registry.
   */
  runtimes: Runtime[];
}

/**
 * Portable runtime reference stored in live-server exports.
 *
 * On import, matched against the machine's configured runtimes by kind+version
 * first, then by case-insensitive name.
 */
export interface RuntimeRequirement {
  /**
   * Required runtime family.
   */
  kind: RuntimeKind;

  /**
   * Required major.minor version.
   */
  version: string;

  /**
   * Display name from the exporting machine (fallback match key).
   */
  name: string;
}

/**
 * Static catalog entry describing one supported runtime kind.
 */
export interface RuntimeCatalogEntry {
  /**
   * Human-readable label for Settings (e.g. `"Node"`).
   */
  label: string;

  /**
   * Default binary basename appended when {@link Runtime.path} is a directory.
   */
  binary: string;

  /**
   * Args passed to the binary to print its version.
   */
  versionArgs: string[];

  /**
   * Popular major.minor versions offered in the Settings version select.
   */
  versions: string[];
}

/**
 * Supported runtimes and popular versions (major.minor only; patch is ignored).
 */
export const RUNTIME_CATALOG: Record<RuntimeKind, RuntimeCatalogEntry> = {
  node: {
    label: 'Node',
    binary: 'node',
    versionArgs: ['--version'],
    versions: [
      '24.5',
      '24.4',
      '24.3',
      '24.2',
      '24.1',
      '24.0',
      '22.18',
      '22.17',
      '22.16',
      '22.15',
      '22.14',
      '22.13',
      '22.12',
      '22.11',
      '22.10',
      '22.9',
      '22.8',
      '22.7',
      '22.6',
      '22.5',
      '22.4',
      '22.3',
      '22.2',
      '22.1',
      '22.0',
      '20.19',
      '20.18',
      '20.17',
      '20.16',
      '20.15',
      '20.14',
      '20.13',
      '20.12',
      '20.11',
      '20.10',
      '18.20',
      '18.19',
      '18.18'
    ]
  },
  php: {
    label: 'PHP',
    binary: 'php',
    versionArgs: ['-v'],
    versions: ['8.4', '8.3', '8.2', '8.1', '8.0', '7.4']
  },
  python: {
    label: 'Python',
    binary: 'python3',
    versionArgs: ['--version'],
    versions: ['3.13', '3.12', '3.11', '3.10', '3.9']
  }
};

/**
 * Ordered list of supported runtime kinds for Settings selects.
 */
export const RUNTIME_KINDS: RuntimeKind[] = ['node', 'php', 'python'];

/**
 * Returns whether a value is a supported {@link RuntimeKind}.
 *
 * @param value - Unknown value from storage or IPC.
 * @returns True when the value is a known runtime kind.
 */
export function isRuntimeKind(value: unknown): value is RuntimeKind {
  return value === 'node' || value === 'php' || value === 'python';
}

/**
 * Joins a directory path with a binary basename without relying on Node `path`.
 *
 * @param directory - Absolute or relative directory path.
 * @param binary - Binary basename (e.g. `node`).
 * @returns Joined path using the directory's separator style when possible.
 */
export function joinRuntimePath(directory: string, binary: string): string {
  const trimmed = directory.replace(/[/\\]+$/, '');
  if (trimmed === '') {
    return binary;
  }
  const separator = trimmed.includes('\\') && !trimmed.includes('/') ? '\\' : '/';
  return `${trimmed}${separator}${binary}`;
}

/**
 * Returns the basename of a path (last segment after `/` or `\`).
 *
 * @param path - Absolute or relative path.
 * @returns Final path segment, or empty when the path is blank.
 */
export function runtimePathBasename(path: string): string {
  const trimmed = path.trim().replace(/[/\\]+$/, '');
  if (trimmed === '') {
    return '';
  }
  const parts = trimmed.split(/[/\\]/);
  return parts[parts.length - 1] ?? '';
}

/**
 * Returns whether a path's basename matches the catalog binary for a kind.
 *
 * Accepts Windows-style `.exe` suffixes (case-insensitive).
 *
 * @param kind - Runtime kind whose catalog binary is compared.
 * @param path - Path that may point at the executable itself.
 * @returns True when the basename equals the catalog binary (with optional `.exe`).
 */
export function pathLooksLikeRuntimeExecutable(kind: RuntimeKind, path: string): boolean {
  const basename = runtimePathBasename(path).toLowerCase();
  if (basename === '') {
    return false;
  }
  const binary = RUNTIME_CATALOG[kind].binary.toLowerCase();
  return basename === binary || basename === `${binary}.exe`;
}

/**
 * Resolves the executable path for a runtime.
 *
 * When {@link pathKind} is `'file'`, or when the path basename matches the
 * catalog binary, the path is returned as-is. Otherwise the catalog binary is
 * appended (treating the path as a bin directory).
 *
 * @param runtime - Runtime kind and path to resolve.
 * @param pathKind - Optional filesystem kind from `fs.statSync` in the host.
 * @returns Absolute-looking executable path ready for `spawn`.
 */
export function resolveRuntimeExecutable(
  runtime: Pick<Runtime, 'kind' | 'path'>,
  pathKind?: 'file' | 'directory'
): string {
  const trimmed = runtime.path.trim();
  if (trimmed === '') {
    return '';
  }
  if (pathKind === 'file' || pathLooksLikeRuntimeExecutable(runtime.kind, trimmed)) {
    return trimmed;
  }
  if (pathKind === 'directory') {
    return joinRuntimePath(trimmed, RUNTIME_CATALOG[runtime.kind].binary);
  }
  // Pure heuristic when the host did not report file vs directory: treat paths
  // that already look like the binary as files; everything else as a bin dir.
  return joinRuntimePath(trimmed, RUNTIME_CATALOG[runtime.kind].binary);
}

/**
 * Normalizes a major.minor version string by dropping a trailing patch segment.
 *
 * Non-strings and blank values become `''`. `"22.14.0"` → `"22.14"`, `"8.3"` stays.
 *
 * @param value - Raw version from storage, verify output, or the editor.
 * @returns Normalized major.minor string, or empty when unset/invalid.
 */
export function normalizeRuntimeVersion(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim().replace(/^v/i, '');
  if (trimmed === '') {
    return '';
  }
  const match = trimmed.match(/^(\d+)(?:\.(\d+))?/);
  if (match == null) {
    return '';
  }
  const major = match[1];
  const minor = match[2] ?? '0';
  return `${major}.${minor}`;
}

/**
 * Normalizes a runtime env-var list from storage or IPC.
 *
 * Corrupt entries are skipped. Keys/values are coerced to strings; `enabled`
 * defaults to true when omitted.
 *
 * @param value - Array of key/value rows, or unknown legacy payload.
 * @returns Normalized env rows (may be empty).
 */
export function normalizeRuntimeEnv(value: unknown): KeyValue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: KeyValue[] = [];
  for (const entry of value) {
    if (entry == null || typeof entry !== 'object') {
      continue;
    }
    const row = entry as Partial<KeyValue>;
    const key = typeof row.key === 'string' ? row.key : '';
    const envValue = typeof row.value === 'string' ? row.value : '';
    rows.push({
      key,
      value: envValue,
      enabled: row.enabled !== false
    });
  }
  return rows;
}

/**
 * Normalizes a single runtime from storage or IPC.
 *
 * Invalid kinds return `null` so callers can drop them. Missing ids become `''`
 * (the host assigns a uuid on save when blank).
 *
 * @param value - Raw runtime object.
 * @returns Normalized runtime, or null when the kind is unsupported.
 */
export function normalizeRuntime(value: unknown): Runtime | null {
  if (value == null || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<Runtime>;
  if (!isRuntimeKind(raw.kind)) {
    return null;
  }
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const path = typeof raw.path === 'string' ? raw.path.trim() : '';
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const version =
    normalizeRuntimeVersion(raw.version) || (RUNTIME_CATALOG[raw.kind].versions[0] ?? '');
  return {
    id,
    name: name || `${RUNTIME_CATALOG[raw.kind].label} v${version}`,
    kind: raw.kind,
    version,
    path,
    env: normalizeRuntimeEnv(raw.env)
  };
}

/**
 * Normalizes a list of runtimes, dropping invalid entries.
 *
 * @param value - Raw array from storage or IPC.
 * @returns Normalized runtime list.
 */
export function normalizeRuntimes(value: unknown): Runtime[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const runtimes: Runtime[] = [];
  for (const entry of value) {
    const normalized = normalizeRuntime(entry);
    if (normalized != null) {
      runtimes.push(normalized);
    }
  }
  return runtimes;
}

/**
 * Builds a portable {@link RuntimeRequirement} from a configured runtime.
 *
 * @param runtime - Machine-local runtime to export.
 * @returns Kind + version + name suitable for live-server exports.
 */
export function runtimeRequirementFor(
  runtime: Pick<Runtime, 'kind' | 'version' | 'name'>
): RuntimeRequirement {
  return {
    kind: runtime.kind,
    version: normalizeRuntimeVersion(runtime.version),
    name: runtime.name.trim()
  };
}

/**
 * Builds a single-runtime Settings export envelope.
 *
 * @param runtime - Machine-local runtime to serialize.
 * @returns HarborClient `runtime` export payload.
 */
export function buildRuntimeExport(runtime: Runtime): RuntimeExport {
  const normalized = normalizeRuntime(runtime);
  if (normalized == null) {
    throw new Error(`Unsupported runtime kind: ${String((runtime as { kind?: unknown }).kind)}`);
  }
  return {
    harborclientVersion: 1,
    harborclientExport: 'runtime',
    id: normalized.id,
    name: normalized.name,
    kind: normalized.kind,
    version: normalized.version,
    path: normalized.path,
    env: normalized.env.map((row) => ({ ...row }))
  };
}

/**
 * Builds a multi-runtime Settings export envelope.
 *
 * Invalid entries are dropped via {@link normalizeRuntimes}.
 *
 * @param runtimes - Machine-local runtimes to serialize.
 * @returns HarborClient `runtimes` export payload.
 */
export function buildRuntimesExport(runtimes: Runtime[]): RuntimesExport {
  return {
    harborclientVersion: 1,
    harborclientExport: 'runtimes',
    runtimes: normalizeRuntimes(runtimes).map((runtime) => ({
      ...runtime,
      env: runtime.env.map((row) => ({ ...row }))
    }))
  };
}

/**
 * Finds a machine-local runtime that satisfies an export requirement.
 *
 * Prefers an exact kind+version match; falls back to a case-insensitive name
 * match when no version match exists.
 *
 * @param runtimes - Configured runtimes on this machine.
 * @param requirement - Portable requirement from an imported live server.
 * @returns Matching runtime, or undefined when none match.
 */
export function findMatchingRuntime(
  runtimes: Runtime[],
  requirement: RuntimeRequirement
): Runtime | undefined {
  const version = normalizeRuntimeVersion(requirement.version);
  const byKindVersion = runtimes.find(
    (runtime) =>
      runtime.kind === requirement.kind && normalizeRuntimeVersion(runtime.version) === version
  );
  if (byKindVersion != null) {
    return byKindVersion;
  }
  const name = requirement.name.trim().toLowerCase();
  if (name === '') {
    return undefined;
  }
  return runtimes.find((runtime) => runtime.name.trim().toLowerCase() === name);
}

/**
 * Parses major.minor from a runtime's `--version` / `-v` stdout/stderr.
 *
 * Handles common formats: `v22.14.0`, `PHP 8.3.6 (cli)`, `Python 3.12.4`.
 *
 * @param kind - Runtime kind (used only for documentation; parsing is shared).
 * @param output - Combined stdout/stderr from the version command.
 * @returns Normalized major.minor, or empty when no version was found.
 */
export function parseRuntimeVersionOutput(kind: RuntimeKind, output: string): string {
  void kind;
  if (typeof output !== 'string' || output.trim() === '') {
    return '';
  }
  // Prefer a "vX.Y.Z" / "X.Y.Z" token after an optional language label.
  const match = output.match(/(?:^|[\s])v?(\d+\.\d+(?:\.\d+)?)/i);
  if (match == null) {
    return '';
  }
  return normalizeRuntimeVersion(match[1]);
}

/**
 * Merges runtime and command-level env rows into a flat string map.
 *
 * Disabled rows are dropped. Command rows override runtime rows for the same
 * key (case-sensitive). Blank keys are ignored.
 *
 * @param runtimeEnv - Env rows from the selected runtime.
 * @param commandEnv - Env rows from the live server run-command settings.
 * @returns Flat env map ready to merge onto `process.env`.
 */
export function mergeRuntimeEnv(
  runtimeEnv: KeyValue[],
  commandEnv: KeyValue[]
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const row of runtimeEnv) {
    if (!row.enabled) {
      continue;
    }
    const key = row.key.trim();
    if (key === '') {
      continue;
    }
    merged[key] = row.value;
  }
  for (const row of commandEnv) {
    if (!row.enabled) {
      continue;
    }
    const key = row.key.trim();
    if (key === '') {
      continue;
    }
    merged[key] = row.value;
  }
  return merged;
}

/**
 * Normalizes a portable runtime requirement from an export payload.
 *
 * @param value - Raw requirement object.
 * @returns Normalized requirement, or null when kind is missing/invalid.
 */
export function normalizeRuntimeRequirement(value: unknown): RuntimeRequirement | null {
  if (value == null || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<RuntimeRequirement>;
  if (!isRuntimeKind(raw.kind)) {
    return null;
  }
  return {
    kind: raw.kind,
    version: normalizeRuntimeVersion(raw.version),
    name: typeof raw.name === 'string' ? raw.name.trim() : ''
  };
}
