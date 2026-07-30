// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { act, createElement } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostReactDom } from '../../runtime/reactHost.js';
import { AnchorMenuPanel } from './index.js';

describe('AnchorMenuPanel', () => {
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

  it('renders a disabled-only empty-state placeholder', () => {
    act(() => {
      root.render(
        createElement(AnchorMenuPanel, {
          menuId: 'browser-downloads',
          groups: [[{ label: 'No file history', disabled: true, onSelect: vi.fn() }]],
          anchor: { x: 10, y: 10 },
          onDismiss: vi.fn()
        })
      );
    });

    const panel = document.getElementById('browser-downloads-menu');
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain('No file history');

    const placeholder = panel?.querySelector('button[aria-disabled="true"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder?.textContent).toContain('No file history');
  });

  it('returns null when there are no items', () => {
    act(() => {
      root.render(
        createElement(AnchorMenuPanel, {
          menuId: 'empty-menu',
          groups: [[]],
          anchor: { x: 10, y: 10 },
          onDismiss: vi.fn()
        })
      );
    });

    expect(document.getElementById('empty-menu-menu')).toBeNull();
  });
});
