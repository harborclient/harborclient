import {
  Menu,
  type BrowserWindow,
  type MenuItemConstructorOptions,
  type WebContentsView
} from 'electron';

import { toViewSourceUrl } from '#/browser/browserUrl';
import { isBrowserGuestImageContext } from '#/browser/browserGuestImageContext';
import { isDeveloperToolsEnabled } from '#/main/devMode';

/**
 * Visible label for the guest context-menu Copy to chat item.
 *
 * Kept as a local string so the main process does not import SDK UI/icon modules.
 * Must stay in sync with `COPY_TO_CHAT_LABEL` in `@harborclient/sdk`.
 */
export const BROWSER_GUEST_COPY_TO_CHAT_LABEL = 'Copy to chat';

/**
 * Callbacks that perform guest navigation and page actions from context-menu items.
 */
export interface BrowserGuestContextMenuActions {
  /**
   * Navigates back in guest history when possible.
   */
  onBack: () => void;

  /**
   * Navigates forward in guest history when possible.
   */
  onForward: () => void;

  /**
   * Navigates the guest to its home URL.
   */
  onHome: () => void;

  /**
   * Opens a view-source tab for the current guest page.
   */
  onViewSource: () => void;

  /**
   * Inserts an `@webpage.<tabId>#x.y` chat pointer for the click point.
   *
   * @param x - Pointer X in guest viewport CSS pixels.
   * @param y - Pointer Y in guest viewport CSS pixels.
   */
  onCopyToChat?: (x: number, y: number) => void;

  /**
   * Opens the right-clicked image in a HarborClient Image View tab.
   *
   * @param srcURL - Image source from Electron `ContextMenuParams.srcURL`.
   */
  onOpenImageInTab?: (srcURL: string) => void;

  /**
   * Saves the right-clicked image via a native save dialog.
   *
   * @param srcURL - Image source from Electron `ContextMenuParams.srcURL`.
   */
  onSaveImage?: (srcURL: string) => void;

  /**
   * Opens guest DevTools and inspects the element at the given viewport point.
   *
   * When omitted, {@link attachBrowserGuestContextMenu} uses the guest
   * webContents inspect / openDevTools APIs directly.
   *
   * @param x - Pointer X in guest viewport pixels.
   * @param y - Pointer Y in guest viewport pixels.
   */
  onInspectElement?: (x: number, y: number) => void;
}

/**
 * Enablement flags for navigation and page items at popup time.
 */
export interface BrowserGuestContextMenuNavigationState {
  /**
   * Whether the guest has history to go back to.
   */
  canGoBack: boolean;

  /**
   * Whether the guest has history to go forward to.
   */
  canGoForward: boolean;

  /**
   * Whether View Source is available for the current guest URL.
   */
  canViewSource: boolean;
}

/**
 * Builds the right-click context menu template for an embedded browser guest.
 *
 * Navigation items (Back, Forward, Home) match the browser chrome toolbar.
 * When the click targets an image, Open image in tab and Save image appear before View Source.
 * View Source opens a Chromium view-source tab when the page is http(s).
 * Copy to chat inserts an `@webpage.<tabId>#x.y` pointer for the click point.
 * Inspect Element is appended only when developer tooling is enabled.
 *
 * @param navigation - History and View Source enablement.
 * @param actions - Click handlers for each menu item.
 * @param includeInspectElement - Whether to append Inspect Element.
 * @param clickX - Viewport X for Copy to chat / Inspect Element.
 * @param clickY - Viewport Y for Copy to chat / Inspect Element.
 * @param imageSrcURL - When set, adds Open image in tab / Save image items for this source.
 * @returns Menu template consumed by {@link Menu.buildFromTemplate}.
 */
export function buildBrowserGuestContextMenuTemplate(
  navigation: BrowserGuestContextMenuNavigationState,
  actions: BrowserGuestContextMenuActions,
  includeInspectElement = false,
  clickX = 0,
  clickY = 0,
  imageSrcURL?: string
): MenuItemConstructorOptions[] {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Back',
      enabled: navigation.canGoBack,
      click: () => {
        actions.onBack();
      }
    },
    {
      label: 'Forward',
      enabled: navigation.canGoForward,
      click: () => {
        actions.onForward();
      }
    },
    {
      label: 'Home',
      enabled: true,
      click: () => {
        actions.onHome();
      }
    },
    { type: 'separator' }
  ];

  const trimmedImageSrc = imageSrcURL?.trim() ?? '';
  if (trimmedImageSrc) {
    template.push(
      {
        label: 'Open image in tab',
        enabled: true,
        click: () => {
          actions.onOpenImageInTab?.(trimmedImageSrc);
        }
      },
      {
        label: 'Save image',
        enabled: true,
        click: () => {
          actions.onSaveImage?.(trimmedImageSrc);
        }
      },
      { type: 'separator' }
    );
  }

  template.push(
    {
      label: 'View Source',
      enabled: navigation.canViewSource,
      click: () => {
        actions.onViewSource();
      }
    },
    {
      label: BROWSER_GUEST_COPY_TO_CHAT_LABEL,
      enabled: true,
      click: () => {
        actions.onCopyToChat?.(clickX, clickY);
      }
    }
  );

  if (includeInspectElement) {
    template.push(
      { type: 'separator' },
      {
        label: 'Inspect Element',
        click: () => {
          actions.onInspectElement?.(clickX, clickY);
        }
      }
    );
  }

  return template;
}

/**
 * Attaches a right-click context menu to an embedded browser guest view.
 *
 * Enablement for Back / Forward / View Source is read from the guest at popup
 * time. Navigation actions are provided by the caller so they can reuse
 * BrowserViewManager methods (including pre-request scripts). When the click
 * targets an image, Open image in tab and Save image are included. Copy to chat reports the
 * click coordinates to the renderer. Inspect Element opens detached DevTools on
 * the guest webContents when developer tooling is on.
 *
 * @param view - Guest WebContentsView that receives right-clicks.
 * @param getWindow - Resolves the main window used as the menu popup parent.
 * @param actions - Navigation and page-action callbacks invoked from menu items.
 */
export function attachBrowserGuestContextMenu(
  view: WebContentsView,
  getWindow: () => BrowserWindow | null,
  actions: BrowserGuestContextMenuActions
): void {
  const { webContents } = view;

  webContents.on('context-menu', (_event, params) => {
    if (webContents.isDestroyed()) {
      return;
    }

    const window = getWindow();
    if (!window || window.isDestroyed()) {
      return;
    }

    const imageSrcURL = isBrowserGuestImageContext(params.mediaType, params.srcURL)
      ? params.srcURL.trim()
      : undefined;

    const template = buildBrowserGuestContextMenuTemplate(
      {
        canGoBack: webContents.navigationHistory.canGoBack(),
        canGoForward: webContents.navigationHistory.canGoForward(),
        canViewSource: toViewSourceUrl(webContents.getURL()) != null
      },
      {
        ...actions,
        onInspectElement: (x, y) => {
          if (actions.onInspectElement) {
            actions.onInspectElement(x, y);
            return;
          }
          if (webContents.isDestroyed()) {
            return;
          }
          webContents.inspectElement(x, y);
          if (!webContents.isDevToolsOpened()) {
            webContents.openDevTools({ mode: 'detach' });
          }
        }
      },
      isDeveloperToolsEnabled(),
      params.x,
      params.y,
      imageSrcURL
    );

    const menu = Menu.buildFromTemplate(template);
    menu.popup({ window });
  });
}
