// @vitest-environment jsdom
import { faFolder, faGlobe, faTrash } from '@fortawesome/free-solid-svg-icons';
import { installReact } from '@harborclient/sdk';
import { act, createElement, useState } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarRail, type SidebarRailItemData } from './index.js';

const railItems: SidebarRailItemData[] = [
  { id: 'collections', icon: faFolder, label: 'Collections' },
  { id: 'environments', icon: faGlobe, label: 'Environments', badge: true },
  { id: 'trash', icon: faTrash, label: 'Trash' }
];

interface FixtureProps {
  /**
   * Initial selected rail item id.
   */
  initialActiveId?: string;

  /**
   * Whether the rail starts expanded.
   */
  initialExpanded?: boolean;

  /**
   * Optional select spy invoked after local state updates.
   */
  onSelect?: (id: string) => void;

  /**
   * Optional expand spy invoked after local state updates.
   */
  onExpandedChange?: (expanded: boolean) => void;

  /**
   * Optional panel id for aria-controls wiring.
   */
  panelId?: string;
}

/**
 * Stateful SidebarRail wrapper so keyboard selection updates activeId/tabIndex.
 *
 * @param props - Initial state and optional spies.
 * @returns Controlled SidebarRail for keyboard tests.
 */
function StatefulRail({
  initialActiveId = 'collections',
  initialExpanded = false,
  onSelect,
  onExpandedChange,
  panelId
}: FixtureProps) {
  const [activeId, setActiveId] = useState(initialActiveId);
  const [expanded, setExpanded] = useState(initialExpanded);

  return createElement(SidebarRail, {
    items: railItems,
    activeId,
    expanded,
    panelId,
    ariaLabel: 'Sidebar modes',
    onSelect: (id: string) => {
      setActiveId(id);
      onSelect?.(id);
    },
    onExpandedChange: (next: boolean) => {
      setExpanded(next);
      onExpandedChange?.(next);
    }
  });
}

describe('SidebarRail keyboard', () => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * Mounts SidebarRail into a fresh DOM container for each test.
   */
  beforeEach(() => {
    installReact(React);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  /**
   * Unmounts the React tree and removes the test container.
   */
  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps a single Tab stop on the selected rail tab (roving tabindex)', () => {
    act(() => {
      root.render(createElement(StatefulRail, { initialActiveId: 'environments' }));
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[2]?.getAttribute('tabindex')).toBe('-1');
  });

  it('exposes a vertical tablist and selected tab semantics', () => {
    act(() => {
      root.render(
        createElement(StatefulRail, {
          initialActiveId: 'collections',
          panelId: 'hc-sidebar-rail-panel'
        })
      );
    });

    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist?.getAttribute('aria-orientation')).toBe('vertical');
    expect(tablist?.getAttribute('aria-label')).toBe('Sidebar modes');

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('false');
    expect(tabs[0]?.getAttribute('aria-controls')).toBe('hc-sidebar-rail-panel');
  });

  it('selects and focuses the next tab on ArrowDown, wrapping at the end', () => {
    const onSelect = vi.fn();

    act(() => {
      root.render(createElement(StatefulRail, { initialActiveId: 'trash', onSelect }));
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    const trashTab = tabs[2] as HTMLButtonElement;
    trashTab.focus();

    act(() => {
      trashTab.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      );
    });

    expect(onSelect).toHaveBeenCalledWith('collections');
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[2]?.getAttribute('tabindex')).toBe('-1');
  });

  it('selects and focuses the previous tab on ArrowUp, wrapping at the start', () => {
    const onSelect = vi.fn();

    act(() => {
      root.render(createElement(StatefulRail, { initialActiveId: 'collections', onSelect }));
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    const firstTab = tabs[0] as HTMLButtonElement;
    firstTab.focus();

    act(() => {
      firstTab.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
      );
    });

    expect(onSelect).toHaveBeenCalledWith('trash');
    expect(document.activeElement).toBe(tabs[2]);
  });

  it('jumps to first and last tabs with Home and End', () => {
    const onSelect = vi.fn();

    act(() => {
      root.render(createElement(StatefulRail, { initialActiveId: 'environments', onSelect }));
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    const middleTab = tabs[1] as HTMLButtonElement;
    middleTab.focus();

    act(() => {
      middleTab.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })
      );
    });

    expect(onSelect).toHaveBeenCalledWith('collections');
    expect(document.activeElement).toBe(tabs[0]);

    act(() => {
      (tabs[0] as HTMLButtonElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })
      );
    });

    expect(onSelect).toHaveBeenCalledWith('trash');
    expect(document.activeElement).toBe(tabs[2]);
  });

  it('does not include the expand control in the tablist arrow ring', () => {
    act(() => {
      root.render(createElement(StatefulRail, { initialActiveId: 'collections' }));
    });

    const tablist = container.querySelector('[role="tablist"]');
    const expand = container.querySelector('.hc-sidebar-rail-expand');
    expect(expand).not.toBeNull();
    expect(tablist?.contains(expand)).toBe(false);
  });

  it('announces badge status in the collapsed accessible name', () => {
    act(() => {
      root.render(createElement(StatefulRail, { initialActiveId: 'environments' }));
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[1]?.getAttribute('aria-label')).toBe('Environments, notification');
    expect(tabs[1]?.querySelector('.hc-sidebar-rail-item-badge')).not.toBeNull();
    expect(tabs[1]?.querySelector('.hc-sidebar-rail-item-badge')?.className).toContain('bg-accent');
  });

  it('announces a success badge as running with a green indicator', () => {
    const itemsWithSuccessBadge: SidebarRailItemData[] = [
      { id: 'collections', icon: faFolder, label: 'Collections' },
      {
        id: 'servers',
        icon: faGlobe,
        label: 'Servers',
        badge: true,
        badgeVariant: 'success'
      }
    ];

    act(() => {
      root.render(
        createElement(SidebarRail, {
          items: itemsWithSuccessBadge,
          activeId: 'servers',
          expanded: false,
          onExpandedChange: () => undefined,
          onSelect: () => undefined,
          ariaLabel: 'Sidebar modes'
        })
      );
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[1]?.getAttribute('aria-label')).toBe('Servers, running');
    expect(tabs[1]?.querySelector('.hc-sidebar-rail-item-badge')?.className).toContain(
      'bg-success'
    );
  });

  it('uses visible labels when expanded and omits redundant aria-label', () => {
    act(() => {
      root.render(
        createElement(StatefulRail, {
          initialActiveId: 'collections',
          initialExpanded: true
        })
      );
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[0]?.hasAttribute('aria-label')).toBe(false);
    expect(tabs[0]?.textContent).toContain('Collections');
    expect(tabs[1]?.textContent).toContain(', notification');
  });

  it('applies focus-visible outline classes on active and inactive tabs', () => {
    act(() => {
      root.render(createElement(StatefulRail, { initialActiveId: 'collections' }));
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs[0]?.className).toContain('focus-visible:outline-accent');
    expect(tabs[1]?.className).toContain('focus-visible:outline-accent');

    const expand = container.querySelector('.hc-sidebar-rail-expand');
    expect(expand?.className).toContain('focus-visible:outline-accent');
  });

  it('keeps decorative separators out of the accessibility tree', () => {
    act(() => {
      root.render(createElement(StatefulRail));
    });

    const separators = container.querySelectorAll('.hc-sidebar-rail-separator');
    expect(separators.length).toBeGreaterThan(0);
    separators.forEach((separator) => {
      expect(separator.getAttribute('aria-hidden')).toBe('true');
      expect(separator.hasAttribute('role')).toBe(false);
    });
  });
});
