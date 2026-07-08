import { BrowserWindow, dialog } from 'electron';
import { stat } from 'fs/promises';
import { readFile } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { isBrunoCollectionManifest } from '#/main/import/bruno';
import {
  getSuppressPostmanImportWarning,
  setSuppressPostmanImportWarning
} from '#/main/settings/importWarningSettings';

/**
 * User choice when importing a document whose uuid already exists locally.
 */
export type DuplicateImportChoice = 'cancel' | 'copy' | 'update';

/**
 * Parsed import file selection from the native open dialog.
 */
export type ImportFileSelection = {
  /**
   * Raw UTF-8 contents of the JSON file that was read.
   */
  raw: string;

  /**
   * Parsed JSON payload from the selected import file.
   */
  parsed: unknown;

  /**
   * Absolute path to the JSON file read (HarborClient export or bruno.json).
   */
  filePath: string;

  /**
   * Absolute path to the Bruno collection root when a manifest was loaded.
   */
  collectionDir?: string;

  /**
   * Base name of the selected import file, without extension.
   */
  fileName?: string;
};

/**
 * Returns the base name of a file path without its extension.
 *
 * @param filePath - Absolute path to an import file.
 * @returns File base name suitable for default collection naming.
 */
function importFileBaseName(filePath: string): string {
  const fileName = basename(filePath);
  const extensionIndex = fileName.lastIndexOf('.');
  if (extensionIndex <= 0) {
    return fileName;
  }

  return fileName.slice(0, extensionIndex);
}

/**
 * Reads bruno.json from a directory and returns a parsed import selection.
 *
 * @param collectionDir - Absolute path to the selected Bruno collection folder.
 * @returns Parsed manifest selection for downstream import handlers.
 * @throws When bruno.json is missing or does not contain a valid manifest.
 */
async function readBrunoCollectionSelection(collectionDir: string): Promise<ImportFileSelection> {
  const manifestPath = join(collectionDir, 'bruno.json');
  const raw = await readFile(manifestPath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;

  if (!isBrunoCollectionManifest(parsed)) {
    throw new Error('Selected folder is not a Bruno collection (missing or invalid bruno.json).');
  }

  return {
    raw,
    parsed,
    filePath: manifestPath,
    collectionDir,
    fileName: importFileBaseName(manifestPath)
  };
}

/**
 * Opens a native import picker and parses the selected JSON file or Bruno folder.
 *
 * On macOS the picker accepts both files and directories so users can select a
 * collection folder directly. Other platforms remain file-only; select bruno.json.
 *
 * @param win - Focused browser window for modal dialogs, if any.
 * @returns Parsed import selection, or null when the dialog was canceled.
 */
export async function openImportFile(
  win: BrowserWindow | null
): Promise<ImportFileSelection | null> {
  const isDarwin = process.platform === 'darwin';
  const dialogOptions = {
    properties: isDarwin
      ? (['openFile', 'openDirectory'] as Array<'openFile' | 'openDirectory'>)
      : (['openFile'] as Array<'openFile'>),
    filters: [{ name: 'Import files', extensions: ['json', 'har'] }]
  };
  const { canceled, filePaths } = win
    ? await dialog.showOpenDialog(win, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const selectedPath = filePaths[0];
  const selectedStat = await stat(selectedPath);

  if (selectedStat.isDirectory()) {
    return readBrunoCollectionSelection(selectedPath);
  }

  const raw = await readFile(selectedPath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  const selection: ImportFileSelection = {
    raw,
    parsed,
    filePath: selectedPath,
    fileName: importFileBaseName(selectedPath)
  };

  if (isBrunoCollectionManifest(parsed)) {
    selection.collectionDir = dirname(selectedPath);
  }

  return selection;
}

/**
 * Shows the Postman import warning and returns whether the user chose to continue.
 *
 * @param win - Focused browser window for modal dialogs, if any.
 * @returns True when the user confirmed import.
 */
export async function confirmPostmanImport(win: BrowserWindow | null): Promise<boolean> {
  if (getSuppressPostmanImportWarning()) {
    return true;
  }

  const postmanWarningOptions = {
    type: 'warning' as const,
    buttons: ['Cancel', 'Import anyway'],
    defaultId: 0,
    cancelId: 0,
    title: 'Import Postman collection',
    message: 'HarborClient does not support all Postman features.',
    detail:
      'Some Postman settings may be ignored or converted. Scripts from imported files may not behave the same as in Postman. Only import collections from sources you trust.',
    checkboxLabel: "Don't show this again"
  };
  const { response, checkboxChecked } = win
    ? await dialog.showMessageBox(win, postmanWarningOptions)
    : await dialog.showMessageBox(postmanWarningOptions);

  if (response !== 1) {
    return false;
  }

  if (checkboxChecked) {
    setSuppressPostmanImportWarning(true);
  }

  return true;
}

/**
 * Shows the collection script warning and returns whether the user chose to continue.
 *
 * @param win - Focused browser window for modal dialogs, if any.
 * @returns True when the user confirmed import.
 */
export async function confirmCollectionScripts(win: BrowserWindow | null): Promise<boolean> {
  const messageBoxOptions = {
    type: 'warning' as const,
    buttons: ['Cancel', 'Import anyway'],
    defaultId: 0,
    cancelId: 0,
    title: 'Collection contains scripts',
    message: 'This collection includes pre-request or post-request scripts.',
    detail:
      'Scripts from imported files may not be safe. They run in a limited sandbox, but that sandbox is not a security boundary. Only import collections from sources you trust.'
  };
  const { response } = win
    ? await dialog.showMessageBox(win, messageBoxOptions)
    : await dialog.showMessageBox(messageBoxOptions);

  return response === 1;
}

/**
 * Shows the request script warning and returns whether the user chose to continue.
 *
 * @param win - Focused browser window for modal dialogs, if any.
 * @returns True when the user confirmed import.
 */
export async function confirmRequestScripts(win: BrowserWindow | null): Promise<boolean> {
  const messageBoxOptions = {
    type: 'warning' as const,
    buttons: ['Cancel', 'Import anyway'],
    defaultId: 0,
    cancelId: 0,
    title: 'Request contains scripts',
    message: 'This request includes pre-request or post-request scripts.',
    detail:
      'Scripts from imported files may not be safe. They run in a limited sandbox, but that sandbox is not a security boundary. Only import requests from sources you trust.'
  };
  const { response } = win
    ? await dialog.showMessageBox(win, messageBoxOptions)
    : await dialog.showMessageBox(messageBoxOptions);

  return response === 1;
}

/**
 * Prompts the user when an import uuid matches an existing local document.
 *
 * @param win - Focused browser window for modal dialogs, if any.
 * @param kind - Imported entity kind for the dialog title.
 * @param existingName - Display name of the document already in the app.
 * @returns The user's import choice.
 */
export async function confirmDuplicateImport(
  win: BrowserWindow | null,
  kind: 'collection' | 'request' | 'environment' | 'snippet' | 'theme',
  existingName: string
): Promise<DuplicateImportChoice> {
  const kindLabel =
    kind === 'collection'
      ? 'Collection'
      : kind === 'request'
        ? 'Request'
        : kind === 'environment'
          ? 'Environment'
          : kind === 'snippet'
            ? 'Snippet'
            : 'Theme';

  const messageBoxOptions = {
    type: 'question' as const,
    buttons: ['Cancel', 'Import as new copy', 'Update existing'],
    defaultId: 2,
    cancelId: 0,
    title: `${kindLabel} already exists`,
    message: `A ${kind} named "${existingName}" is already in HarborClient.`,
    detail:
      'Update existing replaces its saved content with the imported file. Import as new copy creates a separate document with a new identifier.'
  };

  const { response } = win
    ? await dialog.showMessageBox(win, messageBoxOptions)
    : await dialog.showMessageBox(messageBoxOptions);

  if (response === 2) {
    return 'update';
  }
  if (response === 1) {
    return 'copy';
  }
  return 'cancel';
}
