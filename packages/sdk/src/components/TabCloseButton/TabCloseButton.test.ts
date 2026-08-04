// @vitest-environment jsdom
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostReact } from '../../runtime/reactHost.js';
import { TabCloseButton } from './index.js';

describe('TabCloseButton', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setHostReact(React);
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

  it('forwards tabIndex to the underlying button', () => {
    act(() => {
      root.render(
        createElement(TabCloseButton, {
          ariaLabel: 'Close Example tab',
          tabIndex: -1,
          onClick: vi.fn()
        })
      );
    });

    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    expect(button?.tabIndex).toBe(-1);
  });
});
