// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SortButton } from './index.js';

describe('SortButton', () => {
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

  it('renders an accessible toolbar button without an active indicator by default', () => {
    act(() => {
      root.render(
        createElement(SortButton, {
          'aria-label': 'Sort collections',
          onClick: vi.fn()
        })
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.getAttribute('aria-label')).toBe('Sort collections');
    expect(button?.getAttribute('title')).toBe('Sort collections');
    expect(container.querySelector('.hc-status-dot')).toBeNull();
    expect(container.textContent).not.toContain('Custom sort applied');
  });

  it('shows the accent indicator and screen-reader label when active', () => {
    act(() => {
      root.render(
        createElement(SortButton, {
          active: true,
          'aria-label': 'Sort collections',
          onClick: vi.fn()
        })
      );
    });

    expect(container.querySelector('.hc-status-dot')).not.toBeNull();
    expect(container.textContent).toContain('Custom sort applied');
  });

  it('forwards aria-expanded and aria-haspopup for listbox anchors', () => {
    act(() => {
      root.render(
        createElement(SortButton, {
          active: true,
          'aria-label': 'Sort collections',
          'aria-expanded': true,
          'aria-haspopup': 'listbox',
          onClick: vi.fn()
        })
      );
    });

    const button = container.querySelector('button');
    expect(button?.getAttribute('aria-expanded')).toBe('true');
    expect(button?.getAttribute('aria-haspopup')).toBe('listbox');
  });
});
