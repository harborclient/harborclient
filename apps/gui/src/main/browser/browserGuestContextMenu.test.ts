import { describe, expect, it, vi } from 'vitest';
import type { MenuItem, MenuItemConstructorOptions } from 'electron';

import {
  BROWSER_GUEST_COPY_TO_CHAT_LABEL,
  buildBrowserGuestContextMenuTemplate,
  type BrowserGuestContextMenuActions
} from './browserGuestContextMenu';

/**
 * Invokes a menu item click handler with placeholder Electron arguments.
 *
 * @param entry - Menu template entry whose click handler should run.
 */
function invokeMenuClick(entry: MenuItemConstructorOptions | undefined): void {
  entry?.click?.({} as MenuItem, undefined, {} as KeyboardEvent);
}

/**
 * Returns mock navigation action callbacks for template tests.
 *
 * @returns Actions object with vitest spies.
 */
function createMockActions(): BrowserGuestContextMenuActions & {
  onBack: ReturnType<typeof vi.fn<() => void>>;
  onForward: ReturnType<typeof vi.fn<() => void>>;
  onHome: ReturnType<typeof vi.fn<() => void>>;
  onViewSource: ReturnType<typeof vi.fn<() => void>>;
  onCopyToChat: ReturnType<typeof vi.fn<(x: number, y: number) => void>>;
  onInspectElement: ReturnType<typeof vi.fn<(x: number, y: number) => void>>;
} {
  return {
    onBack: vi.fn<() => void>(),
    onForward: vi.fn<() => void>(),
    onHome: vi.fn<() => void>(),
    onViewSource: vi.fn<() => void>(),
    onCopyToChat: vi.fn<(x: number, y: number) => void>(),
    onInspectElement: vi.fn<(x: number, y: number) => void>()
  };
}

/**
 * Returns a navigation state with all items enabled unless overridden.
 *
 * @param overrides - Partial navigation flags to merge.
 * @returns Full navigation state for template tests.
 */
function createNavigationState(
  overrides: Partial<{
    canGoBack: boolean;
    canGoForward: boolean;
    canViewSource: boolean;
  }> = {}
): {
  canGoBack: boolean;
  canGoForward: boolean;
  canViewSource: boolean;
} {
  return {
    canGoBack: true,
    canGoForward: true,
    canViewSource: true,
    ...overrides
  };
}

describe('buildBrowserGuestContextMenuTemplate', () => {
  it('orders Back, Forward, Home, View Source, and Copy to chat', () => {
    const template = buildBrowserGuestContextMenuTemplate(
      createNavigationState(),
      createMockActions()
    );

    expect(template.map((entry) => entry.label ?? entry.type)).toEqual([
      'Back',
      'Forward',
      'Home',
      'separator',
      'View Source',
      BROWSER_GUEST_COPY_TO_CHAT_LABEL
    ]);
  });

  it('disables Back, Forward, and View Source when unavailable', () => {
    const template = buildBrowserGuestContextMenuTemplate(
      createNavigationState({
        canGoBack: false,
        canGoForward: false,
        canViewSource: false
      }),
      createMockActions()
    );

    expect(template[0]?.enabled).toBe(false);
    expect(template[1]?.enabled).toBe(false);
    expect(template[2]?.enabled).toBe(true);
    expect(template[4]?.enabled).toBe(false);
    expect(template[5]?.enabled).toBe(true);
  });

  it('enables Back, Forward, and View Source when available', () => {
    const template = buildBrowserGuestContextMenuTemplate(
      createNavigationState(),
      createMockActions()
    );

    expect(template[0]?.enabled).toBe(true);
    expect(template[1]?.enabled).toBe(true);
    expect(template[4]?.enabled).toBe(true);
  });

  it('invokes navigation, View Source, and Copy to chat callbacks when items are clicked', () => {
    const actions = createMockActions();
    const template = buildBrowserGuestContextMenuTemplate(
      createNavigationState(),
      actions,
      false,
      12,
      34
    );

    invokeMenuClick(template[0]);
    invokeMenuClick(template[1]);
    invokeMenuClick(template[2]);
    invokeMenuClick(template[4]);
    invokeMenuClick(template[5]);

    expect(actions.onBack).toHaveBeenCalledTimes(1);
    expect(actions.onForward).toHaveBeenCalledTimes(1);
    expect(actions.onHome).toHaveBeenCalledTimes(1);
    expect(actions.onViewSource).toHaveBeenCalledTimes(1);
    expect(actions.onCopyToChat).toHaveBeenCalledWith(12, 34);
  });

  it('omits Inspect Element unless developer tooling is included', () => {
    const template = buildBrowserGuestContextMenuTemplate(
      createNavigationState(),
      createMockActions(),
      false
    );

    expect(template.map((entry) => entry.label ?? entry.type)).toEqual([
      'Back',
      'Forward',
      'Home',
      'separator',
      'View Source',
      BROWSER_GUEST_COPY_TO_CHAT_LABEL
    ]);
  });

  it('appends Inspect Element and invokes it with coordinates', () => {
    const actions = createMockActions();
    const template = buildBrowserGuestContextMenuTemplate(
      createNavigationState(),
      actions,
      true,
      12,
      34
    );

    expect(template.map((entry) => entry.label ?? entry.type)).toEqual([
      'Back',
      'Forward',
      'Home',
      'separator',
      'View Source',
      BROWSER_GUEST_COPY_TO_CHAT_LABEL,
      'separator',
      'Inspect Element'
    ]);

    invokeMenuClick(template[7]);
    expect(actions.onInspectElement).toHaveBeenCalledWith(12, 34);
  });
});
