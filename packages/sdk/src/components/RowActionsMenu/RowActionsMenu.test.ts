// @vitest-environment jsdom
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import { installReact } from '@harborclient/sdk';
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RowActionsMenu } from './index.js';

describe('RowActionsMenu', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installReact(React);
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
   * Renders an icon-only menu with the given trigger variant.
   *
   * @param triggerVariant - Optional Button variant for the icon trigger.
   */
  function renderIconTrigger(triggerVariant?: 'toolbar' | 'icon'): void {
    act(() => {
      root.render(
        createElement(RowActionsMenu, {
          menuId: 'test-filter',
          openMenuId: null,
          onOpenChange: vi.fn(),
          triggerVariant,
          triggerIcon: faFilter,
          triggerAriaLabel: 'Filter by collection',
          groups: [[{ label: 'All', onSelect: vi.fn() }]]
        })
      );
    });
  }

  it('defaults icon-only triggers to the icon button variant', () => {
    renderIconTrigger();

    const button = container.querySelector('button.hc-row-actions-menu-trigger');
    expect(button).not.toBeNull();
    expect(button?.className).toContain('size-[30px]');
    expect(button?.getAttribute('aria-label')).toBe('Filter by collection');
  });

  it('honors triggerVariant="toolbar" for icon-only triggers', () => {
    renderIconTrigger('toolbar');

    const button = container.querySelector('button.hc-row-actions-menu-trigger');
    expect(button).not.toBeNull();
    expect(button?.className).toContain('min-h-[32px]');
    expect(button?.className).not.toContain('size-[30px]');
  });
});
