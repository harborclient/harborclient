// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProgressBar } from './index.js';

describe('ProgressBar', () => {
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

  it('sets progressbar aria attributes from value and max', () => {
    act(() => {
      root.render(createElement(ProgressBar, { value: 3, max: 10, label: 'Sync progress' }));
    });

    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-valuemin')).toBe('0');
    expect(bar?.getAttribute('aria-valuemax')).toBe('10');
    expect(bar?.getAttribute('aria-valuenow')).toBe('3');
    expect(bar?.getAttribute('aria-label')).toBe('Sync progress');
  });

  it('sets fill width from value and max', () => {
    act(() => {
      root.render(createElement(ProgressBar, { value: 3, max: 10, label: 'Progress' }));
    });

    const fill = container.querySelector('.hc-progress-bar-fill') as HTMLElement | null;
    expect(fill?.style.width).toBe('30%');
  });

  it('renders 0% fill when max is zero', () => {
    act(() => {
      root.render(createElement(ProgressBar, { value: 0, max: 0, label: 'Progress' }));
    });

    const fill = container.querySelector('.hc-progress-bar-fill') as HTMLElement | null;
    expect(fill?.style.width).toBe('0%');
  });
});
