import { parse } from 'dotenv';
import type { EnvironmentExport, Variable } from '#/shared/types';

/**
 * Returns whether a file name looks like a dotenv environment file.
 *
 * Matches `.env`, `.env.local`, `.env.production`, and `dev.env` style names.
 *
 * @param fileName - Base name of the selected import file (with or without path).
 * @returns True when the file should be parsed as dotenv contents.
 */
export function isDotenvFile(fileName: string): boolean {
  const baseName = fileName.split(/[/\\]/).pop()?.trim() ?? '';
  if (!baseName) {
    return false;
  }

  if (baseName === '.env' || baseName.startsWith('.env.')) {
    return true;
  }

  return baseName.endsWith('.env');
}

/**
 * Parses dotenv file contents into a HarborClient environment export payload.
 *
 * Variable values are treated as private (`share: false`) because env files
 * typically contain secrets that should not be included in portable exports.
 *
 * @param raw - UTF-8 contents of the dotenv file.
 * @param fileName - Base name used as the imported environment display name.
 * @returns Environment export object ready for schema validation.
 * @throws When parsing yields no variables.
 */
export function parseDotenvEnvironment(raw: string, fileName: string): EnvironmentExport {
  const parsed = parse(raw);
  const entries = Object.entries(parsed);

  if (entries.length === 0) {
    throw new Error('No environment variables found in file');
  }

  const variables: Variable[] = entries.map(([key, value]) => ({
    key,
    value,
    defaultValue: '',
    share: false
  }));

  const trimmedName = fileName.trim();
  if (!trimmedName) {
    throw new Error('Environment file name is required');
  }

  return {
    harborclientVersion: 1,
    harborclientExport: 'environment',
    name: trimmedName,
    variables
  };
}
