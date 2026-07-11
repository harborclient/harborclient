import { ipcMain } from 'electron';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  createTerminal,
  killTerminal,
  resizeTerminal,
  writeTerminal
} from '#/main/terminal/terminalHost';

/**
 * Registers IPC handlers for footer terminal pseudo-terminal sessions.
 */
export function registerTerminalHandlers(): void {
  handle('terminal:create', ipcArgSchemas.terminalCreate, (event, input) => {
    return createTerminal(input, event.sender);
  });

  handle('terminal:kill', ipcArgSchemas.terminalId, (event, id) => {
    killTerminal(id);
  });

  ipcMain.on('terminal:write', (event, ...raw) => {
    const result = ipcArgSchemas.terminalWrite.safeParse(raw);
    if (!result.success) {
      return;
    }

    const [id, data] = result.data;
    writeTerminal(id, data);
  });

  ipcMain.on('terminal:resize', (event, ...raw) => {
    const result = ipcArgSchemas.terminalResize.safeParse(raw);
    if (!result.success) {
      return;
    }

    const [id, cols, rows] = result.data;
    resizeTerminal(id, cols, rows);
  });
}
