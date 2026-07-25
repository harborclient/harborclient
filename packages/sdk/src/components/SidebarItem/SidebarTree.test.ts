// @vitest-environment jsdom
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { installReact } from '@harborclient/sdk';
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarCommitItem } from './SidebarCommitItem.js';
import { SidebarFolderItem } from './SidebarFolderItem.js';
import { SidebarList } from './SidebarList.js';
import { SidebarRequestItem } from './SidebarRequestItem.js';
import { SidebarTree } from './SidebarTree.js';
import { SidebarTreeGroup } from './SidebarTreeGroup.js';

describe('SidebarTree', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installReact(React);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it('renders a tree container', () => {
    act(() => {
      root.render(
        createElement(SidebarTree, {
          'aria-label': 'Collections',
          children: createElement(SidebarFolderItem, {
            name: 'Auth',
            expanded: true,
            childrenId: 'auth-children',
            expandIcon: faChevronRight,
            collapseIcon: faChevronDown,
            onToggleExpand: vi.fn(),
            onNameClick: vi.fn(),
            sortable: { id: 'folder-1', dragHandleLabel: 'Reorder folder "Auth"' }
          })
        })
      );
    });

    expect(container.querySelector('[role="tree"]')).not.toBeNull();
    expect(container.querySelector('[role="tree"]')?.getAttribute('aria-label')).toBe(
      'Collections'
    );
  });

  it('exposes treeitem semantics on folder rows', () => {
    act(() => {
      root.render(
        createElement(SidebarTree, {
          'aria-label': 'Collections',
          children: createElement(SidebarFolderItem, {
            name: 'Auth',
            expanded: true,
            selected: true,
            childrenId: 'auth-children',
            level: 1,
            setSize: 2,
            posInSet: 1,
            ariaLabel: 'Auth folder',
            expandIcon: faChevronRight,
            collapseIcon: faChevronDown,
            onToggleExpand: vi.fn(),
            onNameClick: vi.fn(),
            sortable: { id: 'folder-1', dragHandleLabel: 'Reorder folder "Auth"' }
          })
        })
      );
    });

    const treeitem = container.querySelector('[role="treeitem"]');
    expect(treeitem).not.toBeNull();
    expect(treeitem?.getAttribute('aria-expanded')).toBe('true');
    expect(treeitem?.getAttribute('aria-controls')).toBe('auth-children');
    expect(treeitem?.getAttribute('aria-selected')).toBe('true');
    expect(treeitem?.getAttribute('aria-level')).toBe('1');
    expect(treeitem?.getAttribute('aria-setsize')).toBe('2');
    expect(treeitem?.getAttribute('aria-posinset')).toBe('1');
    expect(treeitem?.getAttribute('aria-label')).toBe('Auth folder');
  });

  it('does not set aria-expanded on the chevron button', () => {
    act(() => {
      root.render(
        createElement(SidebarTree, {
          'aria-label': 'Collections',
          children: createElement(SidebarFolderItem, {
            name: 'Auth',
            expanded: true,
            childrenId: 'auth-children',
            expandIcon: faChevronRight,
            collapseIcon: faChevronDown,
            onToggleExpand: vi.fn(),
            onNameClick: vi.fn(),
            sortable: { id: 'folder-1', dragHandleLabel: 'Reorder folder "Auth"' }
          })
        })
      );
    });

    const chevron = container.querySelector(
      '[role="treeitem"] button[aria-label="Collapse folder \\"Auth\\""]'
    );
    expect(chevron?.getAttribute('aria-expanded')).toBeNull();
    expect(chevron?.getAttribute('aria-label')).toBe('Collapse folder "Auth"');
    expect(chevron?.getAttribute('tabindex')).toBe('-1');
  });

  it('renders a group region for child rows', () => {
    act(() => {
      root.render(
        createElement(SidebarTree, {
          'aria-label': 'Collections',
          children: [
            createElement(SidebarFolderItem, {
              name: 'Auth',
              expanded: true,
              childrenId: 'auth-children',
              expandIcon: faChevronRight,
              collapseIcon: faChevronDown,
              onToggleExpand: vi.fn(),
              onNameClick: vi.fn(),
              sortable: { id: 'folder-1', dragHandleLabel: 'Reorder folder "Auth"' }
            }),
            createElement(SidebarTreeGroup, {
              id: 'auth-children',
              children: createElement(SidebarRequestItem, {
                method: 'POST',
                name: 'Login'
              })
            })
          ]
        })
      );
    });

    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    expect(group?.id).toBe('auth-children');
    expect(group?.querySelector('[role="option"]')).not.toBeNull();
  });

  it('activates the treeitem on Enter and Space', () => {
    const onNameClick = vi.fn();

    act(() => {
      root.render(
        createElement(SidebarTree, {
          'aria-label': 'Collections',
          children: createElement(SidebarFolderItem, {
            name: 'Auth',
            expanded: true,
            selected: true,
            childrenId: 'auth-children',
            expandIcon: faChevronRight,
            collapseIcon: faChevronDown,
            onToggleExpand: vi.fn(),
            onNameClick,
            sortable: { id: 'folder-1', dragHandleLabel: 'Reorder folder "Auth"' }
          })
        })
      );
    });

    const treeitem = container.querySelector('[role="treeitem"]');
    expect(treeitem).not.toBeNull();

    act(() => {
      treeitem?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });
    expect(onNameClick).toHaveBeenCalledTimes(1);

    act(() => {
      treeitem?.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
      );
    });
    expect(onNameClick).toHaveBeenCalledTimes(2);
  });
});

describe('SidebarList', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installReact(React);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it('renders a list container with listitem children', () => {
    act(() => {
      root.render(
        createElement(SidebarList, {
          'aria-label': 'Commits',
          children: createElement(SidebarCommitItem, {
            message: 'Fix auth',
            author: 'Alex',
            timestampLabel: '2 hours ago',
            icon: faChevronRight
          })
        })
      );
    });

    expect(container.querySelector('[role="list"]')).not.toBeNull();
    expect(container.querySelector('[role="list"]')?.getAttribute('aria-label')).toBe('Commits');
    expect(container.querySelector('li')).not.toBeNull();
    expect(container.querySelector('li button')).not.toBeNull();
  });
});
