// @vitest-environment jsdom
import { act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostReact } from '../../runtime/reactHost.js';
import { SegmentedTabs } from './index.js';

describe('SegmentedTabs context menu', () => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * Mounts SegmentedTabs into a fresh DOM container for each test.
   */
  beforeEach(() => {
    setHostReact(React);
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

  it('calls onTabContextMenu with the tab value and prevents the default menu', () => {
    const onTabContextMenu = vi.fn();

    act(() => {
      root.render(
        createElement(SegmentedTabs, {
          tabs: [
            { value: 'body', label: 'Body' },
            { value: 'headers', label: 'Headers' }
          ],
          value: 'body',
          onChange: () => undefined,
          editable: false,
          onTabContextMenu,
          ariaLabel: 'Response view'
        })
      );
    });

    const headersTab = container.querySelector<HTMLButtonElement>('[data-tab-value="headers"]');
    expect(headersTab).not.toBeNull();

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => {
      headersTab?.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(onTabContextMenu).toHaveBeenCalledTimes(1);
    expect(onTabContextMenu.mock.calls[0]?.[0]).toBe('headers');
  });
});
