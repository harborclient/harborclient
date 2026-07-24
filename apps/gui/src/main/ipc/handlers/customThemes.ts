import { BrowserWindow } from 'electron';
import {
  deleteCustomTheme,
  getCustomTheme,
  listCustomThemes,
  restoreBuiltinTheme,
  saveCustomTheme,
  type SaveCustomThemeInput
} from '#/main/storage/customThemes';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { openImportFile } from './importDialogs';
import {
  envelopeToImportDraft,
  validateCustomThemeExport
} from '#/shared/plugin/customThemeExport';
import type { CustomThemeImportDraft } from '#/shared/types/customTheme';

/**
 * Registers IPC handlers for user-authored custom themes.
 */
export function registerCustomThemeHandlers(): void {
  handle('customThemes:list', ipcArgSchemas.none, () => {
    return listCustomThemes();
  });

  handle('customThemes:get', ipcArgSchemas.customThemeId, (_event, id) => {
    return getCustomTheme(id);
  });

  handle('customThemes:save', ipcArgSchemas.customThemeSave, (_event, input) => {
    return saveCustomTheme(input as SaveCustomThemeInput);
  });

  handle('customThemes:delete', ipcArgSchemas.customThemeId, (_event, id) => {
    deleteCustomTheme(id);
  });

  handle('customThemes:restoreBuiltin', ipcArgSchemas.customThemeId, (_event, id) => {
    return restoreBuiltinTheme(id);
  });

  handle('customThemes:import', ipcArgSchemas.none, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const selection = await openImportFile(win);
    if (!selection) {
      return null;
    }

    const envelope = validateCustomThemeExport(selection.parsed);
    const draft: CustomThemeImportDraft = envelopeToImportDraft(envelope);
    return draft;
  });
}
