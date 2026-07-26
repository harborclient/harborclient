import { BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import { isDeveloperToolsEnabled } from './devMode';
import { getShortcutOverrides } from '#/main/settings/shortcutSettings';
import { getPluginMenuContributions } from '#/main/plugins/pluginMenuContributions';
import { mergePluginMenuItemsIntoTemplate } from '#/main/plugins/pluginMenuMerge';
import { resolveAcceleratorMap, type ShortcutId } from '@harborclient/core/shortcuts';
import { stepZoomIn, stepZoomOut, resetZoom } from '#/main/window/zoom';
import { BUILTIN_THEME_OPTIONS, type ThemeMenuOption } from '@harborclient/core/themes';
import type { MenuActionId, ThemeSource } from '@harborclient/core/types';

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
 * Builds the View menu "Theme" submenu with built-in themes first, then any
 * installed custom and plugin themes below a separator.
 *
 * @param window - Browser window that receives theme selection events.
 * @param activeTheme - Currently persisted appearance theme.
 * @param pluginThemeOptions - Installed custom and plugin theme menu options.
 * @param onThemeMenuClick - Rebuilds the menu after click so Electron checkbox toggles do not desync checkmarks.
 * @returns A single parent menu item containing the theme checkbox submenu.
 */
export function buildThemeMenuItems(
  window: BrowserWindow,
  activeTheme: ThemeSource,
  pluginThemeOptions: ThemeMenuOption[],
  onThemeMenuClick?: () => void
): MenuItemConstructorOptions {
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

  /**
   * Maps a theme option to a checkbox menu item marked active when it matches
   * the persisted appearance preference.
   *
   * @param option - Theme menu option to render.
   * @returns Checkbox menu item wired to the theme selection handler.
   */
  const toThemeItem = (option: ThemeMenuOption): MenuItemConstructorOptions => ({
    label: option.label,
    type: 'checkbox',
    checked: option.value === activeTheme,
    click: () => handleThemeClick(option.value, option.label)
  });

  const submenu: MenuItemConstructorOptions[] = BUILTIN_THEME_OPTIONS.map(toThemeItem);

  if (pluginThemeOptions.length > 0) {
    submenu.push({ type: 'separator' });
    submenu.push(...pluginThemeOptions.map(toThemeItem));
  }

  return { label: 'Theme', submenu };
}

/**
 * Builds the View menu "Appearance" submenu with layout and footer panel visibility checkboxes.
 *
 * @param window - Browser window that receives menu action events.
 * @param sidebarVisible - Whether the collections sidebar checkbox should appear checked.
 * @param aiSidebarVisible - Whether the AI sidebar checkbox should appear checked.
 * @param gitSidebarVisible - Whether the Git sidebar checkbox should appear checked.
 * @param requestEditorVisible - Whether the request editor checkbox should appear checked.
 * @param responseEditorVisible - Whether the response editor checkbox should appear checked.
 * @param shortcutsReferenceOpen - Whether the shortcuts reference modal checkbox should appear checked.
 * @param consoleVisible - Whether the console panel checkbox should appear checked.
 * @param variablesVisible - Whether the variables panel checkbox should appear checked.
 * @param mcpVisible - Whether the MCP panel checkbox should appear checked.
 * @param terminalVisible - Whether the terminal panel checkbox should appear checked.
 * @param accelerators - Resolved shortcut accelerators for menu items.
 * @returns A single parent menu item containing the panel visibility checkbox submenu.
 */
export function buildAppearanceMenuItems(
  window: BrowserWindow,
  sidebarVisible: boolean,
  aiSidebarVisible: boolean,
  gitSidebarVisible: boolean,
  requestEditorVisible: boolean,
  responseEditorVisible: boolean,
  shortcutsReferenceOpen: boolean,
  consoleVisible: boolean,
  variablesVisible: boolean,
  mcpVisible: boolean,
  terminalVisible: boolean,
  accelerators: Map<ShortcutId, string>
): MenuItemConstructorOptions {
  return {
    label: 'Appearance',
    submenu: [
      {
        label: 'Collections Sidebar',
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
        label: 'Git Sidebar',
        type: 'checkbox',
        checked: gitSidebarVisible,
        accelerator: acceleratorFor(accelerators, 'toggle-git-sidebar'),
        click: () => sendMenuAction(window, 'toggle-git-sidebar')
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
      { type: 'separator' },
      {
        label: 'Shortcuts',
        type: 'checkbox',
        checked: shortcutsReferenceOpen,
        accelerator: acceleratorFor(accelerators, 'shortcuts-reference'),
        click: () => sendMenuAction(window, 'shortcuts-reference')
      },
      {
        label: 'Console',
        type: 'checkbox',
        checked: consoleVisible,
        accelerator: acceleratorFor(accelerators, 'toggle-console'),
        click: () => sendMenuAction(window, 'toggle-console')
      },
      {
        label: 'Variables',
        type: 'checkbox',
        checked: variablesVisible,
        accelerator: acceleratorFor(accelerators, 'toggle-variables'),
        click: () => sendMenuAction(window, 'toggle-variables')
      },
      {
        label: 'MCP',
        type: 'checkbox',
        checked: mcpVisible,
        accelerator: acceleratorFor(accelerators, 'toggle-mcp'),
        click: () => sendMenuAction(window, 'toggle-mcp')
      },
      {
        label: 'Terminal',
        type: 'checkbox',
        checked: terminalVisible,
        accelerator: acceleratorFor(accelerators, 'toggle-terminal'),
        click: () => sendMenuAction(window, 'toggle-terminal')
      }
    ]
  };
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
 * Builds the application menu with File, Edit, View, Team, Git, and Help menus.
 *
 * @param window - Browser window that receives custom menu actions.
 * @param sidebarVisible - Whether the sidebar checkbox should appear checked.
 * @param aiSidebarVisible - Whether the AI sidebar checkbox should appear checked.
 * @param requestEditorVisible - Whether the request editor checkbox should appear checked.
 * @param responseEditorVisible - Whether the response editor checkbox should appear checked.
 * @param shortcutsReferenceOpen - Whether the shortcuts reference modal checkbox should appear checked.
 * @param consoleVisible - Whether the console panel checkbox should appear checked.
 * @param variablesVisible - Whether the variables panel checkbox should appear checked.
 * @param mcpVisible - Whether the MCP panel checkbox should appear checked.
 * @param terminalVisible - Whether the terminal panel checkbox should appear checked.
 * @param activeTheme - Appearance theme used to mark the active View menu checkmark.
 * @param pluginThemeOptions - Installed custom and plugin theme menu options.
 * @param onThemeMenuClick - Rebuilds the menu after a theme item click.
 * @param designerUndoRedoActive - Whether the Designer tab owns Edit menu undo/redo.
 * @param designerCanUndo - Whether Designer undo is currently available.
 * @param designerCanRedo - Whether Designer redo is currently available.
 * @param tabGroupAvailable - Whether at least one saved request tab is open for tab groups.
 * @param sidebarDeselectAllAvailable - Whether the collections sidebar has selection to clear.
 * @param gitCollectionActive - Whether the active collection is git-backed.
 * @returns The constructed application menu.
 */
export function buildMenu(
  window: BrowserWindow,
  sidebarVisible = true,
  aiSidebarVisible = false,
  gitSidebarVisible = false,
  requestEditorVisible = true,
  responseEditorVisible = true,
  shortcutsReferenceOpen = false,
  consoleVisible = false,
  variablesVisible = false,
  mcpVisible = false,
  terminalVisible = false,
  activeTheme: ThemeSource = 'system',
  pluginThemeOptions: ThemeMenuOption[] = [],
  onThemeMenuClick?: () => void,
  designerUndoRedoActive = false,
  designerCanUndo = false,
  designerCanRedo = false,
  tabGroupAvailable = false,
  sidebarDeselectAllAvailable = false,
  gitCollectionActive = false
): Menu {
  const accelerators = resolveAcceleratorMap(getShortcutOverrides());

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Collection',
          accelerator: acceleratorFor(accelerators, 'new-collection'),
          click: () => sendMenuAction(window, 'new-collection')
        },
        {
          label: 'New Request',
          accelerator: acceleratorFor(accelerators, 'new-request'),
          click: () => sendMenuAction(window, 'new-request')
        },
        {
          label: 'New Environment',
          click: () => sendMenuAction(window, 'new-environment')
        },
        {
          label: 'New Tab Group',
          enabled: tabGroupAvailable,
          click: () => sendMenuAction(window, 'create-tab-group')
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: acceleratorFor(accelerators, 'save'),
          click: () => sendMenuAction(window, 'save')
        },
        {
          label: 'Sync Storage',
          accelerator: acceleratorFor(accelerators, 'sync'),
          click: () => sendMenuAction(window, 'sync')
        },

        {
          label: 'Import',
          accelerator: acceleratorFor(accelerators, 'import'),
          click: () => sendMenuAction(window, 'import')
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
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        designerUndoRedoActive
          ? {
              label: 'Undo',
              accelerator: acceleratorFor(accelerators, 'undo'),
              enabled: designerCanUndo,
              click: () => sendMenuAction(window, 'undo')
            }
          : { role: 'undo', accelerator: acceleratorFor(accelerators, 'undo') },
        designerUndoRedoActive
          ? {
              label: 'Redo',
              accelerator: acceleratorFor(accelerators, 'redo'),
              enabled: designerCanRedo,
              click: () => sendMenuAction(window, 'redo')
            }
          : { role: 'redo', accelerator: acceleratorFor(accelerators, 'redo') },
        { type: 'separator' },
        { role: 'cut', accelerator: acceleratorFor(accelerators, 'cut') },
        { role: 'copy', accelerator: acceleratorFor(accelerators, 'copy') },
        { role: 'paste', accelerator: acceleratorFor(accelerators, 'paste') },
        { type: 'separator' },
        { role: 'selectAll', accelerator: acceleratorFor(accelerators, 'select-all') },
        {
          label: 'Deselect all',
          enabled: sidebarDeselectAllAvailable,
          click: () => sendMenuAction(window, 'deselect-all-sidebar')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Action menu',
          accelerator: acceleratorFor(accelerators, 'action-menu'),
          click: () => sendMenuAction(window, 'action-menu')
        },
        { type: 'separator' },
        buildAppearanceMenuItems(
          window,
          sidebarVisible,
          aiSidebarVisible,
          gitSidebarVisible,
          requestEditorVisible,
          responseEditorVisible,
          shortcutsReferenceOpen,
          consoleVisible,
          variablesVisible,
          mcpVisible,
          terminalVisible,
          accelerators
        ),
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
        { type: 'separator' },
        buildThemeMenuItems(window, activeTheme, pluginThemeOptions, onThemeMenuClick),
        ...(isDeveloperToolsEnabled()
          ? [
              { type: 'separator' as const },
              { label: 'Developer Tools', role: 'toggleDevTools' as const }
            ]
          : [])
      ]
    },
    {
      label: 'Team',
      submenu: [
        {
          label: 'Team Hub',
          accelerator: acceleratorFor(accelerators, 'team-hubs'),
          click: () => sendMenuAction(window, 'team-hubs')
        },
        {
          label: 'Accept Team Hub Invite',
          accelerator: acceleratorFor(accelerators, 'accept-team-hub-invite'),
          click: () => sendMenuAction(window, 'accept-team-hub-invite')
        },
        {
          label: 'Sharing Keys',
          accelerator: acceleratorFor(accelerators, 'sharing-keys'),
          click: () => sendMenuAction(window, 'sharing-keys')
        },
        {
          label: 'Accept Shared Collection',
          accelerator: acceleratorFor(accelerators, 'join-shared-collection'),
          click: () => sendMenuAction(window, 'join-shared-collection')
        }
      ]
    },
    {
      label: 'Git',
      submenu: [
        {
          label: 'New Collection',
          click: () => sendMenuAction(window, 'new-collection-git')
        },
        {
          label: 'Branches',
          enabled: gitCollectionActive,
          accelerator: acceleratorFor(accelerators, 'git-create-branch'),
          click: () => sendMenuAction(window, 'git-create-branch')
        },
        {
          label: 'Delete Branch',
          enabled: gitCollectionActive,
          accelerator: acceleratorFor(accelerators, 'git-delete-branch'),
          click: () => sendMenuAction(window, 'git-delete-branch')
        },
        { type: 'separator' },
        {
          label: 'Commit',
          enabled: gitCollectionActive,
          accelerator: acceleratorFor(accelerators, 'git-commit'),
          click: () => sendMenuAction(window, 'git-commit')
        },
        {
          label: 'Merge',
          enabled: gitCollectionActive,
          accelerator: acceleratorFor(accelerators, 'git-merge'),
          click: () => sendMenuAction(window, 'git-merge')
        },
        {
          label: 'Fetch',
          enabled: gitCollectionActive,
          accelerator: acceleratorFor(accelerators, 'git-fetch'),
          click: () => sendMenuAction(window, 'git-fetch')
        },
        {
          label: 'Pull',
          enabled: gitCollectionActive,
          accelerator: acceleratorFor(accelerators, 'git-pull'),
          click: () => sendMenuAction(window, 'git-pull')
        },
        {
          label: 'Push',
          enabled: gitCollectionActive,
          accelerator: acceleratorFor(accelerators, 'git-push'),
          click: () => sendMenuAction(window, 'git-push')
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: acceleratorFor(accelerators, 'git-settings'),
          click: () => sendMenuAction(window, 'git-settings')
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Getting Started',
          click: () => sendMenuAction(window, 'getting-started')
        },
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
