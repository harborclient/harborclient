// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { type ReactNode, act, createElement } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostReactDom } from '../../runtime/reactHost.js';
import { TabBar, type TabBarItem } from './index.js';

/**
 * Builds a minimal tab row for context-menu tests.
 *
 * @param id - Tab id.
 * @param active - Whether the tab is selected.
 * @returns Tab bar item fixture.
 */
function tabItem(id: string, active: boolean): TabBarItem<string> {
  return {
    id,
    active,
    accessibleName: `Tab ${id}`,
    closeAccessibleName: `Close tab ${id}`,
    title: `Tab ${id}`,
    dragLabel: `Tab ${id}`,
    content: createElement('span', null, `Tab ${id}`)
  };
}

describe('TabBar context menu lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installReact(React);
    setHostReactDom(ReactDOM);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('awaits beforeContextMenuOpen before showing the menu', async () => {
    let resolveGate: (() => void) | undefined;
    const beforeContextMenuOpen = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveGate = resolve;
        })
    );
    const onContextMenuClose = vi.fn();

    act(() => {
      root.render(
        createElement(TabBar, {
          tabs: [tabItem('1', true), tabItem('2', false)],
          activeId: '1',
          wrap: true,
          ariaLabel: 'Open tabs',
          tabIdPrefix: 'test-tab-',
          panelIdPrefix: 'test-tabpanel-',
          newTab: {
            ariaLabel: 'New tab',
            title: 'New tab',
            onClick: vi.fn()
          },
          onSelect: vi.fn(),
          onClose: vi.fn(),
          onReorder: vi.fn(),
          buildContextMenuGroups: () => [[{ label: 'Close', onSelect: vi.fn() }]],
          beforeContextMenuOpen,
          onContextMenuClose
        }) as ReactNode
      );
    });

    const tab = document.getElementById('test-tab-1');
    expect(tab).not.toBeNull();

    await act(async () => {
      tab?.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 20 })
      );
    });

    expect(beforeContextMenuOpen).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="menu"]')).toBeNull();

    await act(async () => {
      resolveGate?.();
    });

    expect(document.querySelector('[role="menu"]')).not.toBeNull();
    expect(document.querySelector('[role="menu"]')?.textContent).toContain('Close');
  });

  it('calls onContextMenuClose when the menu dismisses', async () => {
    const onContextMenuClose = vi.fn();

    act(() => {
      root.render(
        createElement(TabBar, {
          tabs: [tabItem('1', true)],
          activeId: '1',
          wrap: true,
          ariaLabel: 'Open tabs',
          tabIdPrefix: 'test-tab-',
          panelIdPrefix: 'test-tabpanel-',
          newTab: {
            ariaLabel: 'New tab',
            title: 'New tab',
            onClick: vi.fn()
          },
          onSelect: vi.fn(),
          onClose: vi.fn(),
          onReorder: vi.fn(),
          buildContextMenuGroups: () => [[{ label: 'Close', onSelect: vi.fn() }]],
          beforeContextMenuOpen: async () => undefined,
          onContextMenuClose
        }) as ReactNode
      );
    });

    const tab = document.getElementById('test-tab-1');
    await act(async () => {
      tab?.dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true, clientX: 40, clientY: 20 })
      );
    });

    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(onContextMenuClose).toHaveBeenCalled();
  });
});
