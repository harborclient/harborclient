import {
  Menu,
  type BrowserWindow,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron';

import { isDeveloperToolsEnabled } from '#/main/devMode';
import { getGeneralSettings } from '#/main/settings/generalSettings';

/** Maximum spelling suggestions shown in the right-click context menu. */
export const SPELLING_SUGGESTION_LIMIT = 5;

/** Data attribute marking a collection markdown document editor surface. */
export const MARKDOWN_DOCUMENT_EDITOR_ATTR = 'data-markdown-document-editor';

/**
 * Builds the right-click context menu template for the main renderer.
 *
 * Spelling suggestions and dictionary actions appear first when spellcheck is
 * enabled and the click target contains a misspelled word. Copy and paste
 * follow. Format Document is offered only for collection markdown document
 * editors. Inspect Element is appended only when developer tooling is enabled.
 *
 * @param params - Electron context-menu event payload for the click target.
 * @param webContents - Web contents that received the right-click.
 * @param spellCheckEnabled - Whether spelling suggestions should be offered.
 * @param includeInspectElement - Whether to append the Inspect Element action.
 * @param includeFormatDocument - Whether to append the Format Document action.
 * @returns Menu template consumed by {@link Menu.buildFromTemplate}.
 */
export function buildWebContextMenuTemplate(
  params: ContextMenuParams,
  webContents: WebContents,
  spellCheckEnabled: boolean,
  includeInspectElement: boolean,
  includeFormatDocument = false
): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [];
  let spellingItemsAdded = false;

  if (spellCheckEnabled && params.misspelledWord) {
    const suggestions = (params.dictionarySuggestions ?? []).slice(0, SPELLING_SUGGESTION_LIMIT);
    for (const suggestion of suggestions) {
      spellingItemsAdded = true;
      template.push({
        label: suggestion,
        click: () => {
          webContents.replaceMisspelling(suggestion);
        }
      });
    }

    spellingItemsAdded = true;
    template.push({
      label: `Add "${params.misspelledWord}" to Dictionary`,
      click: () => {
        webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord);
      }
    });
  }

  if (spellingItemsAdded) {
    template.push({ type: 'separator' });
  }

  template.push(
    {
      role: 'copy',
      enabled: params.editFlags.canCopy
    },
    {
      role: 'paste',
      enabled: params.editFlags.canPaste
    }
  );

  if (includeFormatDocument) {
    template.push(
      { type: 'separator' },
      {
        label: 'Format Document',
        click: () => {
          webContents.send('menu:action', 'format-markdown-document');
        }
      }
    );
  }

  if (includeInspectElement) {
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

  return template;
}

/**
 * Returns whether the context-menu click target is inside a markdown document editor.
 *
 * @param webContents - Web contents that received the right-click.
 * @param x - Pointer X position in viewport pixels.
 * @param y - Pointer Y position in viewport pixels.
 * @returns True when the click is inside an element marked with
 *   {@link MARKDOWN_DOCUMENT_EDITOR_ATTR}.
 */
export async function isMarkdownDocumentEditorClick(
  webContents: WebContents,
  x: number,
  y: number
): Promise<boolean> {
  return webContents.executeJavaScript(
    `(function () {
      const element = document.elementFromPoint(${x}, ${y});
      return element != null && element.closest('[${MARKDOWN_DOCUMENT_EDITOR_ATTR}]') != null;
    })()`
  );
}

/**
 * Attaches a right-click context menu to the main window web contents.
 *
 * Copy is always available and enabled when the user has selected text. Paste is
 * always available and enabled when the click target is editable and clipboard
 * paste is allowed (inputs, textareas, contenteditable regions, etc.).
 * Spelling suggestions and Add to Dictionary appear when spellcheck is enabled
 * and the click target contains a misspelled word. Format Document appears
 * only inside collection markdown document editors. Inspect Element is added
 * only when developer tooling is enabled (unpackaged builds or packaged builds
 * started with `--dev-mode`).
 *
 * @param window - Main application window to augment.
 */
export function attachWebContextMenu(window: BrowserWindow): void {
  const { webContents } = window;
  webContents.on('context-menu', (_event, params) => {
    void (async () => {
      const includeFormatDocument = await isMarkdownDocumentEditorClick(
        webContents,
        params.x,
        params.y
      );
      const template = buildWebContextMenuTemplate(
        params,
        webContents,
        getGeneralSettings().spellCheckEnabled,
        isDeveloperToolsEnabled(),
        includeFormatDocument
      );

      const menu = Menu.buildFromTemplate(template);
      menu.popup({ window });
    })();
  });
}
