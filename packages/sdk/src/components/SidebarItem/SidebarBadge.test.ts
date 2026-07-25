// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SidebarBadge } from './SidebarBadge.js';

describe('SidebarBadge', () => {
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

  /**
   * Renders a badge and returns the root element.
   *
   * @param props - Props passed to {@link SidebarBadge}.
   * @returns The rendered badge element.
   */
  function renderBadge(props: React.ComponentProps<typeof SidebarBadge>): Element {
    act(() => {
      root.render(createElement(SidebarBadge, props));
    });
    return container.firstElementChild as Element;
  }

  it('renders a non-interactive info badge as a span', () => {
    const badge = renderBadge({ children: 'SQLite', variant: 'info', title: 'Stored in SQLite' });

    expect(badge.tagName).toBe('SPAN');
    expect(badge.textContent).toBe('SQLite');
    expect(badge.getAttribute('title')).toBe('Stored in SQLite');
    expect(badge.className).toContain('bg-info/15');
    expect(badge.className).toContain('h-[18px]');
    expect(badge.className).toContain('text-[14px]');
  });

  it('renders an interactive info badge as a button', () => {
    const badge = renderBadge({
      as: 'button',
      children: 'main',
      variant: 'info',
      'aria-label': 'Switch branch (currently main)'
    });

    expect(badge.tagName).toBe('BUTTON');
    expect((badge as HTMLButtonElement).type).toBe('button');
    expect(badge.className).toContain('hover:bg-info/25');
    expect(badge.className).toContain('app-no-drag');
  });

  it('renders a recessed count badge with rounded-full styling', () => {
    const badge = renderBadge({
      as: 'button',
      children: '2',
      variant: 'recessed',
      'aria-label': 'Open source control (2 uncommitted change(s))'
    });

    expect(badge.tagName).toBe('BUTTON');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('bg-selection');
    expect(badge.className).toContain('min-w-[22px]');
  });
});
