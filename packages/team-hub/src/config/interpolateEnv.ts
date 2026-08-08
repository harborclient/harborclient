import { ConfigError } from '#/config/configError.js';

/**
 * Pattern for a single `${NAME}` or `${NAME:-default}` placeholder after `$`.
 *
 * Captures: name (group 1), optional default including empty (group 2 when `:-` present).
 */
const PLACEHOLDER_BODY = /^\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/;

/**
 * Resolves `${NAME}` / `${NAME:-default}` placeholders in a string scalar.
 *
 * Supports `$${NAME}` as an escape that yields a literal `${NAME}`. Unset or
 * empty env values fail for `${NAME}` without a default; `${NAME:-}` allows empty.
 *
 * @param value - String scalar from the parsed YAML document.
 * @param path - Dot-separated YAML path used in error messages.
 * @param env - Environment map (defaults to `process.env`).
 * @returns The string with all placeholders resolved.
 * @throws {ConfigError} When a required variable is missing or empty.
 */
function interpolateEnvString(value: string, path: string, env: NodeJS.ProcessEnv): string {
  let result = '';
  let i = 0;

  while (i < value.length) {
    const ch = value[i];

    if (ch !== '$') {
      result += ch;
      i += 1;
      continue;
    }

    if (value[i + 1] === '$') {
      // Escape: $$ followed by `{NAME}` → literal `${NAME}`; otherwise keep a single `$`.
      if (value[i + 2] === '{') {
        const rest = value.slice(i + 2);
        const match = PLACEHOLDER_BODY.exec(rest);
        if (match) {
          result += `$${match[0]}`;
          i += 2 + match[0].length;
          continue;
        }
      }
      result += '$';
      i += 2;
      continue;
    }

    if (value[i + 1] !== '{') {
      result += ch;
      i += 1;
      continue;
    }

    const rest = value.slice(i + 1);
    const match = PLACEHOLDER_BODY.exec(rest);
    if (!match) {
      result += ch;
      i += 1;
      continue;
    }

    const name = match[1]!;
    const hasDefault = match[0].includes(':-');
    const defaultValue = hasDefault ? (match[2] ?? '') : undefined;
    const envValue = env[name];
    const isSet = envValue !== undefined && envValue !== '';

    if (isSet) {
      result += envValue;
    } else if (hasDefault) {
      result += defaultValue ?? '';
    } else {
      const keyLabel = path.length > 0 ? path : '(root)';
      throw new ConfigError(`Missing environment variable ${name} for config key ${keyLabel}`);
    }

    i += 1 + match[0].length;
  }

  return result;
}

/**
 * Recursively walks a parsed YAML value and interpolates string scalars from the environment.
 *
 * Non-string leaves (numbers, booleans, null) are left unchanged. Objects and arrays are
 * walked depth-first; keys are not interpolated.
 *
 * @param value - Parsed YAML subtree.
 * @param path - Dot-separated path for error messages.
 * @param env - Environment map used for substitution.
 * @returns A new tree with string placeholders resolved.
 * @throws {ConfigError} When a required environment variable is missing.
 */
function walkInterpolate(value: unknown, path: string, env: NodeJS.ProcessEnv): unknown {
  if (typeof value === 'string') {
    return interpolateEnvString(value, path, env);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      walkInterpolate(item, path.length > 0 ? `${path}[${index}]` : `[${index}]`, env)
    );
  }

  if (value !== null && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(input)) {
      const childPath = path.length > 0 ? `${path}.${key}` : key;
      output[key] = walkInterpolate(child, childPath, env);
    }
    return output;
  }

  return value;
}

/**
 * Resolves `${ENV}` / `${ENV:-default}` placeholders in a parsed `server.yaml` document.
 *
 * Only string scalars are interpolated. Call this after `yaml.parse` and before Zod validation
 * so numeric/boolean YAML types remain typed, while string placeholders become concrete values.
 *
 * @param document - Parsed YAML root value.
 * @param env - Environment map (defaults to `process.env`); injectable for tests.
 * @returns Document with environment placeholders resolved.
 * @throws {ConfigError} When a required variable is unset or empty.
 */
export function interpolateEnvInDocument(
  document: unknown,
  env: NodeJS.ProcessEnv = process.env
): unknown {
  return walkInterpolate(document, '', env);
}
