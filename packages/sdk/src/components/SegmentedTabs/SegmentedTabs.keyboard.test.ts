// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { act, createElement, useState } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SegmentedTabPanel, SegmentedTabs, SegmentedTabsGroup } from './index.js';

type TabValue = 'a' | 'b';

interface GroupFixtureProps {
  value: TabValue;
  onChange: (value: TabValue) => void;
}

/**
 * Renders a segmented tab group with two panels for keyboard navigation tests.
 */
function GroupFixture({ value, onChange }: GroupFixtureProps) {
  return createElement(SegmentedTabsGroup, {
    value,
    onChange: (nextValue: string) => onChange(nextValue as TabValue),
    ariaLabel: 'Test tabs',
    children: [
      createElement(SegmentedTabs, {
        tabs: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' }
        ],
        editable: false
      }),
      createElement(SegmentedTabPanel, {
        value: 'a',
        children: createElement('input', { type: 'text', id: 'panel-a-input' })
      }),
      createElement(SegmentedTabPanel, {
        value: 'b',
        children: createElement('input', { type: 'text', id: 'panel-b-input' })
      })
    ]
  });
}

/**
 * Renders a stateful tab group fixture for tests that change the active tab.
 */
function StatefulGroupFixture({ onChange }: { onChange: (value: TabValue) => void }) {
  const [value, setValue] = useState<TabValue>('a');

  return createElement(GroupFixture, {
    value,
    onChange: (nextValue) => {
      setValue(nextValue);
      onChange(nextValue);
    }
  });
}

describe('SegmentedTabs keyboard', () => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * Mounts SegmentedTabs into a fresh DOM container for each test.
   */
  beforeEach(() => {
    installReact(React);
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

  it('puts every enabled tab in the Tab order', () => {
    act(() => {
      root.render(
        createElement(SegmentedTabs, {
          tabs: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C', disabled: true }
          ],
          value: 'b',
          onChange: vi.fn(),
          editable: false,
          ariaLabel: 'Test tabs'
        })
      );
    });

    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[2]?.getAttribute('tabindex')).toBe('-1');
  });

  it('activates a focused unselected tab', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        createElement(SegmentedTabs, {
          tabs: [
            { value: 'a', label: 'A' },
            { value: 'b', label: 'B' },
            { value: 'c', label: 'C' }
          ],
          value: 'a',
          onChange,
          editable: false,
          ariaLabel: 'Test tabs'
        })
      );
    });

    const headersTab = container.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement;
    headersTab.focus();

    act(() => {
      headersTab.click();
    });

    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('moves focus into the tab panel when ArrowDown is pressed on a focused tab', () => {
    const onChange = vi.fn();
    const rafCallbacks: FrameRequestCallback[] = [];

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });

    act(() => {
      root.render(
        createElement(GroupFixture, {
          value: 'a',
          onChange
        })
      );
    });

    const tabA = container.querySelectorAll('[role="tab"]')[0] as HTMLButtonElement;
    tabA.focus();

    act(() => {
      tabA.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      );
      rafCallbacks.shift()?.(0);
    });

    expect(document.activeElement?.id).toBe('panel-a-input');

    vi.restoreAllMocks();
  });

  it('selects and focuses an unselected tab panel when ArrowDown is pressed on it', () => {
    const onChange = vi.fn();
    const rafCallbacks: FrameRequestCallback[] = [];

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });

    act(() => {
      root.render(createElement(StatefulGroupFixture, { onChange }));
    });

    const tabB = container.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement;
    tabB.focus();

    act(() => {
      tabB.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      );
      rafCallbacks.shift()?.(0);
    });

    expect(onChange).toHaveBeenCalledWith('b');

    act(() => {
      rafCallbacks.shift()?.(0);
    });

    expect(document.activeElement?.id).toBe('panel-b-input');

    vi.restoreAllMocks();
  });

  it('returns focus to the tab when ArrowUp is pressed inside the panel', () => {
    const onChange = vi.fn();
    const rafCallbacks: FrameRequestCallback[] = [];

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });

    act(() => {
      root.render(
        createElement(GroupFixture, {
          value: 'a',
          onChange
        })
      );
    });

    const tabA = container.querySelectorAll('[role="tab"]')[0] as HTMLButtonElement;
    tabA.focus();

    act(() => {
      tabA.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
      );
      rafCallbacks.shift()?.(0);
    });

    expect(document.activeElement?.id).toBe('panel-a-input');

    act(() => {
      (document.activeElement as HTMLElement).dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })
      );
    });

    expect(document.activeElement).toBe(tabA);

    vi.restoreAllMocks();
  });
});
