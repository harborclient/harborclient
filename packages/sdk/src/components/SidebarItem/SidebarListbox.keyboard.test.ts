// @vitest-environment jsdom
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { act, createElement, useState } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostReact, setHostReactDom } from '../../runtime/reactHost.js';
import { RowActionsMenu } from '../RowActionsMenu/index.js';
import { SidebarEnvironmentItem } from './SidebarEnvironmentItem.js';
import { SidebarListbox } from './SidebarListbox.js';
import { SidebarTree } from './SidebarTree.js';
import { SidebarTreeGroup } from './SidebarTreeGroup.js';

interface StatefulListProps {
  /**
   * Optional open-menu spy.
   */
  onOpenChange?: (id: string | null) => void;
}

/**
 * Controlled listbox with two environment rows and row action menus.
 *
 * @param props - Optional open-change spy.
 * @returns Listbox fixture for keyboard tests.
 */
function StatefulEnvironmentList({ onOpenChange }: StatefulListProps) {
  const [selectedId, setSelectedId] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  return createElement(SidebarListbox, {
    'aria-label': 'Environments',
    children: [1, 2].map((id) =>
      createElement(SidebarEnvironmentItem, {
        key: id,
        name: id === 1 ? 'Development' : 'Production',
        variableSummary: '2 variables',
        selected: selectedId === id,
        ariaCurrent: selectedId === id,
        onClick: () => setSelectedId(id),
        actions: createElement(RowActionsMenu, {
          menuId: `environment-${id}`,
          openMenuId,
          onOpenChange: (next) => {
            setOpenMenuId(next);
            onOpenChange?.(next);
          },
          triggerTabIndex: -1,
          groups: [[{ label: 'Delete', onSelect: () => undefined }]]
        })
      })
    )
  });
}

interface StatefulTreeProps {
  /**
   * Called when the parent expand state toggles.
   */
  onToggleExpand?: () => void;
}

/**
 * Controlled tree with one expandable parent and one child.
 *
 * @param props - Optional expand spy.
 * @returns Tree fixture for keyboard tests.
 */
function StatefulEnvironmentTree({ onToggleExpand }: StatefulTreeProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState(1);

  return createElement(SidebarTree, {
    'aria-label': 'Environments',
    children: createElement(SidebarEnvironmentItem, {
      name: 'Development',
      variableSummary: '2 variables',
      selected: selectedId === 1,
      hasChildren: true,
      expanded,
      childrenId: 'env-children',
      level: 0,
      setSize: 1,
      posInSet: 1,
      expandIcon: faChevronRight,
      collapseIcon: faChevronDown,
      onToggleExpand: () => {
        setExpanded((current) => !current);
        onToggleExpand?.();
      },
      onClick: () => setSelectedId(1),
      subtree: createElement(
        'div',
        null,
        expanded
          ? createElement(SidebarTreeGroup, {
              id: 'env-children',
              children: createElement(SidebarEnvironmentItem, {
                name: 'Local',
                variableSummary: '1 variable',
                selected: selectedId === 2,
                level: 1,
                setSize: 1,
                posInSet: 1,
                onClick: () => setSelectedId(2)
              })
            })
          : null
      )
    })
  });
}

describe('SidebarListbox keyboard', () => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * Mounts a fresh React root for each test.
   */
  beforeEach(() => {
    setHostReact(React);
    setHostReactDom(ReactDOM);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  /**
   * Tears down the React root and container.
   */
  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps a single Tab stop among options (roving tabindex)', () => {
    act(() => {
      root.render(createElement(StatefulEnvironmentList));
    });

    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(2);
    expect(options[0]?.getAttribute('tabindex')).toBe('0');
    expect(options[1]?.getAttribute('tabindex')).toBe('-1');
  });

  it('moves focus to the next option on ArrowDown', () => {
    act(() => {
      root.render(createElement(StatefulEnvironmentList));
    });

    const options = container.querySelectorAll('[role="option"]');
    const first = options[0] as HTMLElement;
    first.focus();

    act(() => {
      first.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      );
    });

    expect(document.activeElement).toBe(options[1]);
    expect(options[0]?.getAttribute('tabindex')).toBe('-1');
    expect(options[1]?.getAttribute('tabindex')).toBe('0');
  });

  it('keeps drag handles and action triggers out of the Tab order', () => {
    act(() => {
      root.render(createElement(StatefulEnvironmentList));
    });

    const triggers = container.querySelectorAll('.hc-row-actions-menu-trigger');
    expect(triggers.length).toBeGreaterThan(0);
    triggers.forEach((trigger) => {
      expect(trigger.getAttribute('tabindex')).toBe('-1');
    });
  });

  it('opens the row actions menu on Shift+F10', () => {
    const onOpenChange = vi.fn();

    act(() => {
      root.render(createElement(StatefulEnvironmentList, { onOpenChange }));
    });

    const first = container.querySelector('[role="option"]') as HTMLElement;
    first.focus();

    act(() => {
      first.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'F10',
          shiftKey: true,
          bubbles: true,
          cancelable: true
        })
      );
    });

    expect(onOpenChange).toHaveBeenCalledWith('environment-1');
  });
});

describe('SidebarTree keyboard', () => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * Mounts a fresh React root for each test.
   */
  beforeEach(() => {
    setHostReact(React);
    setHostReactDom(ReactDOM);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  /**
   * Tears down the React root and container.
   */
  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('expands a collapsed treeitem on ArrowRight', () => {
    const onToggleExpand = vi.fn();

    act(() => {
      root.render(createElement(StatefulEnvironmentTree, { onToggleExpand }));
    });

    const item = container.querySelector('[role="treeitem"]') as HTMLElement;
    expect(item.getAttribute('aria-expanded')).toBe('false');
    item.focus();

    act(() => {
      item.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
      );
    });

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });
});
