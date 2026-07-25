// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResizeHandle } from './ResizeHandle.js';

const noop = vi.fn();

describe('ResizeHandle', () => {
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

  it('sets aria-valuetext for vertical orientation (width)', () => {
    act(() => {
      root.render(
        createElement(ResizeHandle, {
          orientation: 'vertical',
          value: 487,
          min: 200,
          max: 600,
          onResizeStart: noop,
          onKeyboardResize: noop,
          ariaLabel: 'Resize sidebar'
        })
      );
    });

    const separator = container.querySelector('[role="separator"]');
    expect(separator).not.toBeNull();
    expect(separator?.getAttribute('aria-valuetext')).toBe('Width 487 pixels');
    expect(separator?.getAttribute('aria-valuenow')).toBe('487');
  });

  it('sets aria-valuetext for horizontal orientation (height)', () => {
    act(() => {
      root.render(
        createElement(ResizeHandle, {
          orientation: 'horizontal',
          value: 320,
          min: 120,
          max: 480,
          onResizeStart: noop,
          onKeyboardResize: noop,
          ariaLabel: 'Resize panel'
        })
      );
    });

    const separator = container.querySelector('[role="separator"]');
    expect(separator).not.toBeNull();
    expect(separator?.getAttribute('aria-valuetext')).toBe('Height 320 pixels');
    expect(separator?.getAttribute('aria-valuenow')).toBe('320');
  });

  it('uses a custom formatValueText when provided', () => {
    act(() => {
      root.render(
        createElement(ResizeHandle, {
          orientation: 'vertical',
          value: 487,
          min: 200,
          max: 600,
          onResizeStart: noop,
          onKeyboardResize: noop,
          ariaLabel: 'Resize sidebar',
          formatValueText: (value, orientation) => `Sidebar ${orientation} size ${value}px`
        })
      );
    });

    const separator = container.querySelector('[role="separator"]');
    expect(separator).not.toBeNull();
    expect(separator?.getAttribute('aria-valuetext')).toBe('Sidebar vertical size 487px');
  });
});
