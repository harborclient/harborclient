import { BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { isDeveloperToolsEnabled } from '#/main/devMode';
import { getShortcutOverrides } from '#/main/settings/shortcutSettings';
import { getPluginMenuContributions } from '#/main/plugins/pluginMenuContributions';
import { mergePluginMenuItemsIntoTemplate } from '#/main/plugins/pluginMenuMerge';
import { resolveAcceleratorMap, type ShortcutId } from '#/shared/shortcuts';
import { stepZoomIn, stepZoomOut, resetZoom } from '#/main/window/zoom';
import { BUILTIN_THEME_OPTIONS, type ThemeMenuOption } from '#/shared/themes';
import type { MenuActionId, ThemeSource } from '#/shared/types';

/**
 * Sends a menu action to the renderer process.
 *
 * @param window - Target browser window.
 * @param action - Menu action identifier.
 */
function sendMenuAction(window: BrowserWindow, action: MenuActionId): void {
  window.webContents.send('menu:action', action);
}

/**
 * Sends a plugin menu command to the renderer process.
 *
 * @param window - Target browser window.
 * @param pluginId - Plugin manifest id.
 * @param command - Command id declared in the manifest.
 */
function sendPluginMenuCommand(window: BrowserWindow, pluginId: string, command: string): void {
  window.webContents.send('menu:pluginCommand', { pluginId, command });
}

/**
 * Sends a theme selection from the View menu to the renderer process.
 *
 * @param window - Target browser window.
 * @param theme - Theme preference value the user selected.
 * @param label - Human-readable theme label for confirmation copy.
 */
function sendMenuThemeSelect(window: BrowserWindow, theme: ThemeSource, label: string): void {
  window.webContents.send('menu:selectTheme', { theme, label });
}

/**
 * Builds checkbox menu items for built-in and plugin appearance themes.
 *
 * @param window - Browser window that receives theme selection events.
 * @param activeTheme - Currently persisted appearance theme.
 * @param pluginThemeOptions - Plugin-provided theme menu options.
 * @param onThemeMenuClick - Rebuilds the menu after click so Electron checkbox toggles do not desync checkmarks.
 */
export function buildThemeMenuItems(
  window: BrowserWindow,
  activeTheme: ThemeSource,
  pluginThemeOptions: ThemeMenuOption[],
  onThemeMenuClick?: () => void
): MenuItemConstructorOptions[] {
  const items: MenuItemConstructorOptions[] = [{ type: 'separator' }];

  /**
   * Sends the theme selection and restores checkbox state from persisted preferences.
   *
   * @param theme - Theme preference value the user selected.
   * @param label - Human-readable theme label for confirmation copy.
   */
  const handleThemeClick = (theme: ThemeSource, label: string): void => {
    sendMenuThemeSelect(window, theme, label);
    onThemeMenuClick?.();
  };

  for (const option of BUILTIN_THEME_OPTIONS) {
    items.push({
      label: option.label,
      type: 'checkbox',
      checked: option.value === activeTheme,
      click: () => handleThemeClick(option.value, option.label)
    });
  }

  if (pluginThemeOptions.length > 0) {
    items.push({ type: 'separator' });
    for (const option of pluginThemeOptions) {
      items.push({
        label: option.label,
        type: 'checkbox',
        checked: option.value === activeTheme,
        click: () => handleThemeClick(option.value, option.label)
      });
    }
  }

  return items;
}

/**
 * Returns the effective accelerator for a shortcut id.
 *
 * @param accelerators - Resolved accelerator map.
 * @param id - Shortcut identifier.
 * @returns Electron accelerator string.
 */
function acceleratorFor(accelerators: Map<ShortcutId, string>, id: ShortcutId): string {
  return accelerators.get(id) ?? '';
}

/**
 * Builds the application menu with File, Edit, View, and Help menus.
 *
 * @param window - Browser window that receives custom menu actions.
 * @param sidebarVisible - Whether the sidebar checkbox should appear checked.
 * @param aiSidebarVisible - Whether the AI sidebar checkbox should appear checked.
 * @param requestEditorVisible - Whether the request editor checkbox should appear checked.
 * @param responseEditorVisible - Whether the response editor checkbox should appear checked.
 * @param collectionsVisible - Whether the Collections section checkbox should appear checked.
 * @param environmentsVisible - Whether the Environments section checkbox should appear checked.
 * @param activeTheme - Appearance theme used to mark the active View menu checkmark.
 * @param pluginThemeOptions - Plugin-provided theme menu options.
 * @param onThemeMenuClick - Rebuilds the menu after a theme item click.
 * @param creatorUndoRedoActive - Whether the Creator tab owns Edit menu undo/redo.
 * @param creatorCanUndo - Whether Creator undo is currently available.
 * @param creatorCanRedo - Whether Creator redo is currently available.
 * @returns The constructed application menu.
 */
export function buildMenu(
  window: BrowserWindow,
  sidebarVisible = true,
  aiSidebarVisible = false,
  requestEditorVisible = true,
  responseEditorVisible = true,
  collectionsVisible = true,
  environmentsVisible = true,
  activeTheme: ThemeSource = 'system',
  pluginThemeOptions: ThemeMenuOption[] = [],
  onThemeMenuClick?: () => void,
  creatorUndoRedoActive = false,
  creatorCanUndo = false,
  creatorCanRedo = false
): Menu {
  const accelerators = resolveAcceleratorMap(getShortcutOverrides());

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Request',
          accelerator: acceleratorFor(accelerators, 'new-request'),
          click: () => sendMenuAction(window, 'new-request')
        },
        {
          label: 'New Collection',
          accelerator: acceleratorFor(accelerators, 'new-collection'),
          click: () => sendMenuAction(window, 'new-collection')
        },
        {
          label: 'Sync Storage',
          accelerator: acceleratorFor(accelerators, 'sync'),
          click: () => sendMenuAction(window, 'sync')
        },
        {
          label: 'Save Request',
          accelerator: acceleratorFor(accelerators, 'save'),
          click: () => sendMenuAction(window, 'save')
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: acceleratorFor(accelerators, 'settings'),
          click: () => sendMenuAction(window, 'settings')
        },
        {
          label: 'Plugins',
          accelerator: acceleratorFor(accelerators, 'plugins'),
          click: () => sendMenuAction(window, 'plugins')
        },
        {
          label: 'Themes',
          accelerator: acceleratorFor(accelerators, 'themes'),
          click: () => sendMenuAction(window, 'themes')
        },
        {
          label: 'Snippets',
          accelerator: acceleratorFor(accelerators, 'snippets'),
          click: () => sendMenuAction(window, 'snippets')
        },
        {
          label: 'Cookies',
          click: () => sendMenuAction(window, 'cookies')
        },
        {
          label: 'Team Hub',
          accelerator: acceleratorFor(accelerators, 'team-hubs'),
          click: () => sendMenuAction(window, 'team-hubs')
        },
        { type: 'separator' },
        {
          label: 'Import',
          accelerator: acceleratorFor(accelerators, 'import'),
          click: () => sendMenuAction(window, 'import')
        },
        {
          label: 'Sharing Keys',
          accelerator: acceleratorFor(accelerators, 'sharing-keys'),
          click: () => sendMenuAction(window, 'sharing-keys')
        },
        {
          label: 'Join Shared Collection',
          click: () => sendMenuAction(window, 'join-shared-collection')
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        creatorUndoRedoActive
          ? {
              label: 'Undo',
              accelerator: acceleratorFor(accelerators, 'undo'),
              enabled: creatorCanUndo,
              click: () => sendMenuAction(window, 'undo')
            }
          : { role: 'undo', accelerator: acceleratorFor(accelerators, 'undo') },
        creatorUndoRedoActive
          ? {
              label: 'Redo',
              accelerator: acceleratorFor(accelerators, 'redo'),
              enabled: creatorCanRedo,
              click: () => sendMenuAction(window, 'redo')
            }
          : { role: 'redo', accelerator: acceleratorFor(accelerators, 'redo') },
        { type: 'separator' },
        { role: 'cut', accelerator: acceleratorFor(accelerators, 'cut') },
        { role: 'copy', accelerator: acceleratorFor(accelerators, 'copy') },
        { role: 'paste', accelerator: acceleratorFor(accelerators, 'paste') },
        { type: 'separator' },
        { role: 'selectAll', accelerator: acceleratorFor(accelerators, 'select-all') }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Sidebar',
          type: 'checkbox',
          checked: sidebarVisible,
          accelerator: acceleratorFor(accelerators, 'toggle-sidebar'),
          click: () => sendMenuAction(window, 'toggle-sidebar')
        },
        {
          label: 'Agent Chat',
          type: 'checkbox',
          checked: aiSidebarVisible,
          accelerator: acceleratorFor(accelerators, 'toggle-ai-sidebar'),
          click: () => sendMenuAction(window, 'toggle-ai-sidebar')
        },
        {
          label: 'Request',
          type: 'checkbox',
          checked: requestEditorVisible,
          accelerator: acceleratorFor(accelerators, 'toggle-request-editor'),
          click: () => sendMenuAction(window, 'toggle-request-editor')
        },
        {
          label: 'Response',
          type: 'checkbox',
          checked: responseEditorVisible,
          accelerator: acceleratorFor(accelerators, 'toggle-response-editor'),
          click: () => sendMenuAction(window, 'toggle-response-editor')
        },
        {
          label: 'Search Anything',
          accelerator: acceleratorFor(accelerators, 'search-anything'),
          click: () => sendMenuAction(window, 'search-anything')
        },
        { type: 'separator' },
        {
          label: 'Collections',
          type: 'checkbox',
          checked: collectionsVisible,
          accelerator: acceleratorFor(accelerators, 'toggle-collections-section'),
          click: () => sendMenuAction(window, 'toggle-collections-section')
        },
        {
          label: 'Environments',
          type: 'checkbox',
          checked: environmentsVisible,
          accelerator: acceleratorFor(accelerators, 'toggle-environments-section'),
          click: () => sendMenuAction(window, 'toggle-environments-section')
        },
        { type: 'separator' },
        {
          role: 'togglefullscreen',
          accelerator: acceleratorFor(accelerators, 'toggle-fullscreen')
        },
        {
          label: 'Zoom In',
          accelerator: acceleratorFor(accelerators, 'zoom-in'),
          click: () => stepZoomIn(window.webContents)
        },
        {
          label: 'Zoom Out',
          accelerator: acceleratorFor(accelerators, 'zoom-out'),
          click: () => stepZoomOut(window.webContents)
        },
        {
          label: 'Reset Zoom',
          accelerator: acceleratorFor(accelerators, 'reset-zoom'),
          click: () => resetZoom(window.webContents)
        },
        ...(isDeveloperToolsEnabled()
          ? [
              { type: 'separator' as const },
              { label: 'Developer Tools', role: 'toggleDevTools' as const }
            ]
          : []),
        ...buildThemeMenuItems(window, activeTheme, pluginThemeOptions, onThemeMenuClick)
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          accelerator: acceleratorFor(accelerators, 'documentation'),
          click: () => void shell.openExternal('https://harborclient.com/')
        },
        {
          label: 'Report Issue',
          accelerator: acceleratorFor(accelerators, 'report-issue'),
          click: () =>
            void shell.openExternal('https://github.com/harborclient/harborclient/issues')
        },
        {
          label: 'Check for Updates',
          accelerator: acceleratorFor(accelerators, 'check-for-updates'),
          click: () => sendMenuAction(window, 'check-for-updates')
        },
        {
          label: 'Keyboard Shortcuts',
          accelerator: acceleratorFor(accelerators, 'shortcuts-reference'),
          click: () => sendMenuAction(window, 'shortcuts-reference')
        },
        {
          label: 'About',
          accelerator: acceleratorFor(accelerators, 'about'),
          click: () => sendMenuAction(window, 'about')
        }
      ]
    }
  ];

  mergePluginMenuItemsIntoTemplate(template, getPluginMenuContributions(), (contribution) =>
    sendPluginMenuCommand(window, contribution.pluginId, contribution.command)
  );

  return Menu.buildFromTemplate(template);
}
