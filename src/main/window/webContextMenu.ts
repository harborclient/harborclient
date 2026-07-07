import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';

import { isDeveloperToolsEnabled } from '#/main/devMode';

/**
 * Attaches a right-click context menu to the main window web contents.
 *
 * Copy is always available and enabled when the user has selected text. Paste is
 * always available and enabled when the click target is editable and clipboard
 * paste is allowed (inputs, textareas, contenteditable regions, etc.).
 * Inspect Element is added only when developer tooling is enabled (unpackaged
 * builds or packaged builds started with `--dev-mode`).
 *
 * @param window - Main application window to augment.
 */
export function attachWebContextMenu(window: BrowserWindow): void {
  const { webContents } = window;
  webContents.on('context-menu', (_event, params) => {
    const template: MenuItemConstructorOptions[] = [
      {
        role: 'copy',
        enabled: params.editFlags.canCopy
      },
      {
        role: 'paste',
        enabled: params.editFlags.canPaste
      }
    ];

    if (isDeveloperToolsEnabled()) {
      template.push(
        { type: 'separator' },
        {
          label: 'Inspect Element',
          click: () => {
            webContents.inspectElement(params.x, params.y);
            if (!webContents.isDevToolsOpened()) {
              webContents.openDevTools();
            }
          }
        }
      );
    }

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window });
  });
}
