import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { isPlainObject, parseJson } from '@harborclient/core/parseJson';
import { resolveImportUuid } from '#/main/storage/uuid';
import type { CollectionExport, Variable } from '@harborclient/core/types';

/**
 * Gitignored overlay file inside a collection folder (`local*.json`).
 * Stores private (non-share) variable values that must not be committed.
 */
export const COLLECTION_LOCAL_VARIABLES_FILE = 'local-variables.json';

/**
 * On-disk shape for private collection and folder variable values.
 */
export interface CollectionLocalVariablesFile {
  harborclientVersion: 1;
  harborclientExport: 'collection-local-variables';
  /**
   * Collection-scoped private values keyed by variable key.
   */
  variables: Record<string, string>;
  /**
   * Folder-scoped private values keyed by folder uuid, then variable key.
   */
  folders: Record<string, Record<string, string>>;
}

/**
 * Returns the absolute path to the private-variables overlay in a collection folder.
 *
 * @param dirPath - Absolute collection folder path.
 */
export function collectionLocalVariablesPath(dirPath: string): string {
  return join(dirPath, COLLECTION_LOCAL_VARIABLES_FILE);
}

/**
 * Builds a key→value map for variables whose values should stay local (not shared).
 *
 * @param variables - Variable rows that may include private secrets.
 * @returns Map of trimmed keys to values for non-shared rows with a key.
 */
export function extractPrivateVariableValues(variables: Variable[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const variable of variables) {
    const key = variable.key.trim();
    if (!key || variable.share === true) {
      continue;
    }
    values[key] = typeof variable.value === 'string' ? variable.value : '';
  }
  return values;
}

/**
 * Restores private values onto variable rows from a key→value overlay map.
 *
 * Shared rows keep their committed values. Non-shared rows prefer the overlay
 * when a key is present so reload-from-disk after a masked write keeps secrets.
 *
 * @param variables - Variables loaded from the committed collection manifest.
 * @param privateValues - Overlay map of private values by key.
 * @returns Variables with private values merged back in.
 */
export function mergePrivateVariableValues(
  variables: Variable[],
  privateValues: Record<string, string> | undefined
): Variable[] {
  if (!privateValues || Object.keys(privateValues).length === 0) {
    return variables;
  }

  return variables.map((variable) => {
    if (variable.share === true) {
      return variable;
    }
    const key = variable.key.trim();
    if (!key || !Object.prototype.hasOwnProperty.call(privateValues, key)) {
      return variable;
    }
    return { ...variable, value: privateValues[key] ?? '' };
  });
}

/**
 * Reads the private-variables overlay from a collection folder when present.
 *
 * @param dirPath - Absolute collection folder path.
 * @returns Parsed overlay, or null when missing or invalid.
 */
export function readCollectionLocalVariables(dirPath: string): CollectionLocalVariablesFile | null {
  const filePath = collectionLocalVariablesPath(dirPath);
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const parsed = parseJson(readFileSync(filePath, 'utf-8'), null);
    if (!isPlainObject(parsed) || parsed.harborclientExport !== 'collection-local-variables') {
      return null;
    }

    const variables =
      parsed.variables && isPlainObject(parsed.variables)
        ? Object.fromEntries(
            Object.entries(parsed.variables).filter(
              (entry): entry is [string, string] =>
                typeof entry[0] === 'string' && typeof entry[1] === 'string'
            )
          )
        : {};

    const folders: Record<string, Record<string, string>> = {};
    if (parsed.folders && isPlainObject(parsed.folders)) {
      for (const [folderKey, folderValues] of Object.entries(parsed.folders)) {
        if (!isPlainObject(folderValues)) {
          continue;
        }
        const folderUuid = resolveImportUuid(folderKey);
        folders[folderUuid] = Object.fromEntries(
          Object.entries(folderValues).filter(
            (entry): entry is [string, string] =>
              typeof entry[0] === 'string' && typeof entry[1] === 'string'
          )
        );
      }
    }

    return {
      harborclientVersion: 1,
      harborclientExport: 'collection-local-variables',
      variables,
      folders
    };
  } catch {
    return null;
  }
}

/**
 * Writes or removes the private-variables overlay for a collection folder.
 *
 * @param dirPath - Absolute collection folder path.
 * @param variables - Full collection variables (including private values).
 * @param folders - Collection folders with their variables.
 */
export function writeCollectionLocalVariables(
  dirPath: string,
  variables: Variable[],
  folders: CollectionExport['folders']
): void {
  const privateVariables = extractPrivateVariableValues(variables);
  const privateFolders: Record<string, Record<string, string>> = {};

  for (const folder of folders ?? []) {
    const folderUuid = resolveImportUuid(folder.uuid);
    const folderPrivate = extractPrivateVariableValues(folder.variables ?? []);
    if (Object.keys(folderPrivate).length > 0) {
      privateFolders[folderUuid] = folderPrivate;
    }
  }

  const filePath = collectionLocalVariablesPath(dirPath);
  const hasPrivateValues =
    Object.keys(privateVariables).length > 0 || Object.keys(privateFolders).length > 0;

  if (!hasPrivateValues) {
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
    }
    return;
  }

  const payload: CollectionLocalVariablesFile = {
    harborclientVersion: 1,
    harborclientExport: 'collection-local-variables',
    variables: privateVariables,
    folders: privateFolders
  };
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
}

/**
 * Applies a collection-folder private-variables overlay onto an export payload.
 *
 * @param exportData - Collection export loaded from the committed manifest.
 * @param dirPath - Absolute collection folder path that may contain the overlay.
 * @returns Export with private values restored from the overlay when present.
 */
export function applyCollectionLocalVariables(
  exportData: CollectionExport,
  dirPath: string
): CollectionExport {
  const local = readCollectionLocalVariables(dirPath);
  if (!local) {
    return exportData;
  }

  return {
    ...exportData,
    variables: mergePrivateVariableValues(exportData.variables, local.variables),
    folders: (exportData.folders ?? []).map((folder) => {
      const folderUuid = resolveImportUuid(folder.uuid);
      return {
        ...folder,
        variables: mergePrivateVariableValues(folder.variables ?? [], local.folders[folderUuid])
      };
    })
  };
}
