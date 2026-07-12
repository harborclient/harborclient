import { describe, expect, it, vi } from 'vitest';
import type {
  ContextMenuParams,
  MenuItem,
  MenuItemConstructorOptions,
  WebContents
} from 'electron';

import {
  SPELLING_SUGGESTION_LIMIT,
  buildWebContextMenuTemplate
} from '#/main/window/webContextMenu';

/**
 * Invokes a menu item click handler with placeholder Electron arguments.
 *
 * @param entry - Menu template entry whose click handler should run.
 */
function invokeMenuClick(entry: MenuItemConstructorOptions | undefined): void {
  entry?.click?.({} as MenuItem, undefined, {} as KeyboardEvent);
}

/**
 * Returns a minimal {@link ContextMenuParams} object for menu template tests.
 *
 * @param overrides - Partial fields to merge onto the default payload.
 */
function createContextMenuParams(overrides: Partial<ContextMenuParams> = {}): ContextMenuParams {
  return {
    x: 12,
    y: 34,
    linkURL: '',
    linkText: '',
    pageURL: '',
    frameURL: '',
    srcURL: '',
    mediaType: 'none',
    hasImageContents: false,
    isEditable: true,
    editFlags: {
      canUndo: false,
      canRedo: false,
      canCut: false,
      canCopy: true,
      canPaste: true,
      canDelete: false,
      canSelectAll: true,
      canEditRichly: false
    },
    ...overrides
  } as ContextMenuParams;
}

/**
 * Returns a mock web contents object with spelling and inspect hooks.
 */
function createMockWebContents(): WebContents & {
  replaceMisspelling: ReturnType<typeof vi.fn>;
  addWordToSpellCheckerDictionary: ReturnType<typeof vi.fn>;
  inspectElement: ReturnType<typeof vi.fn>;
  isDevToolsOpened: ReturnType<typeof vi.fn>;
  openDevTools: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  const addWordToSpellCheckerDictionary = vi.fn();
  const replaceMisspelling = vi.fn();
  const inspectElement = vi.fn();
  const isDevToolsOpened = vi.fn(() => false);
  const openDevTools = vi.fn();
  const send = vi.fn();

  return {
    replaceMisspelling,
    inspectElement,
    isDevToolsOpened,
    openDevTools,
    send,
    session: {
      addWordToSpellCheckerDictionary
    }
  } as unknown as WebContents & {
    replaceMisspelling: ReturnType<typeof vi.fn>;
    addWordToSpellCheckerDictionary: ReturnType<typeof vi.fn>;
    inspectElement: ReturnType<typeof vi.fn>;
    isDevToolsOpened: ReturnType<typeof vi.fn>;
    openDevTools: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

describe('buildWebContextMenuTemplate', () => {
  it('preserves copy and paste when no misspelling is present', () => {
    const template = buildWebContextMenuTemplate(
      createContextMenuParams(),
      createMockWebContents(),
      true,
      false
    );

    expect(template).toEqual([
      { role: 'copy', enabled: true },
      { role: 'paste', enabled: true }
    ]);
  });

  it('adds spelling suggestions and dictionary action before copy and paste', () => {
    const webContents = createMockWebContents();
    const template = buildWebContextMenuTemplate(
      createContextMenuParams({
        misspelledWord: 'HarborClient',
        dictionarySuggestions: ['Harbor Client', 'Harbor', 'Client']
      }),
      webContents,
      true,
      false
    );

    expect(template.map((entry) => entry.label ?? entry.role ?? entry.type)).toEqual([
      'Harbor Client',
      'Harbor',
      'Client',
      'Add "HarborClient" to Dictionary',
      'separator',
      'copy',
      'paste'
    ]);

    invokeMenuClick(template[0]);
    expect(webContents.replaceMisspelling).toHaveBeenCalledWith('Harbor Client');

    invokeMenuClick(template[3]);
    expect(webContents.session.addWordToSpellCheckerDictionary).toHaveBeenCalledWith(
      'HarborClient'
    );
  });

  it('omits spelling actions when spellcheck is disabled', () => {
    const template = buildWebContextMenuTemplate(
      createContextMenuParams({
        misspelledWord: 'HarborClient',
        dictionarySuggestions: ['Harbor Client']
      }),
      createMockWebContents(),
      false,
      false
    );

    expect(template).toEqual([
      { role: 'copy', enabled: true },
      { role: 'paste', enabled: true }
    ]);
  });

  it('caps spelling suggestions at the configured limit', () => {
    const suggestions = Array.from({ length: SPELLING_SUGGESTION_LIMIT + 3 }, (_entry, index) => {
      return `suggestion-${index}`;
    });
    const template = buildWebContextMenuTemplate(
      createContextMenuParams({
        misspelledWord: 'teh',
        dictionarySuggestions: suggestions
      }),
      createMockWebContents(),
      true,
      false
    );

    const suggestionLabels = template
      .map((entry) => entry.label)
      .filter(
        (label): label is string => typeof label === 'string' && label.startsWith('suggestion-')
      );

    expect(suggestionLabels).toHaveLength(SPELLING_SUGGESTION_LIMIT);
    expect(suggestionLabels).toEqual(suggestions.slice(0, SPELLING_SUGGESTION_LIMIT));
  });

  it('adds dictionary action even when Chromium provides no suggestions', () => {
    const template = buildWebContextMenuTemplate(
      createContextMenuParams({
        misspelledWord: 'HarborClient',
        dictionarySuggestions: []
      }),
      createMockWebContents(),
      true,
      false
    );

    expect(template.map((entry) => entry.label ?? entry.role ?? entry.type)).toEqual([
      'Add "HarborClient" to Dictionary',
      'separator',
      'copy',
      'paste'
    ]);
  });

  it('appends inspect element only when developer tooling is enabled', () => {
    const webContents = createMockWebContents();
    const template = buildWebContextMenuTemplate(
      createContextMenuParams(),
      webContents,
      true,
      true
    );

    expect(template.map((entry) => entry.label ?? entry.role ?? entry.type)).toEqual([
      'copy',
      'paste',
      'separator',
      'Inspect Element'
    ]);

    invokeMenuClick(template[3]);
    expect(webContents.inspectElement).toHaveBeenCalledWith(12, 34);
    expect(webContents.openDevTools).toHaveBeenCalledTimes(1);
  });

  it('appends format document only for markdown document editors', () => {
    const webContents = createMockWebContents();
    const template = buildWebContextMenuTemplate(
      createContextMenuParams(),
      webContents,
      true,
      false,
      true
    );

    expect(template.map((entry) => entry.label ?? entry.role ?? entry.type)).toEqual([
      'copy',
      'paste',
      'separator',
      'Format Document'
    ]);

    invokeMenuClick(template[3]);
    expect(webContents.send).toHaveBeenCalledWith('menu:action', 'format-markdown-document');
  });

  it('omits format document outside markdown document editors', () => {
    const template = buildWebContextMenuTemplate(
      createContextMenuParams(),
      createMockWebContents(),
      true,
      false,
      false
    );

    expect(template.map((entry) => entry.label ?? entry.role ?? entry.type)).toEqual([
      'copy',
      'paste'
    ]);
  });
});
