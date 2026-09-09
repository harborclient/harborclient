// @vitest-environment jsdom
import { type ReactElement, act, createElement, useState } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostReact } from '../../runtime/reactHost.js';
import { SegmentedTabs } from './index.js';
import type { TabItem } from './types.js';

type EditorTab = 'params' | 'body' | 'headers' | 'plugin';

interface FixtureProps {
  /**
   * Tab definitions, including temporarily hidden tabs.
   */
  tabs: TabItem<EditorTab>[];

  /**
   * Currently selected tab value.
   */
  value: EditorTab;

  /**
   * Called when SegmentedTabs requests a selection change.
   */
  onChange: (value: EditorTab) => void;
}

/**
 * Renders an editable request-editor-style tab strip for visibility tests.
 *
 * @param props - Controlled selection and tab definitions.
 * @returns SegmentedTabs element.
 */
function VisibilityFixture({ tabs, value, onChange }: FixtureProps): ReactElement {
  return createElement(SegmentedTabs<EditorTab>, {
    tabs,
    value,
    onChange,
    ariaLabel: 'Request editor sections'
  });
}

interface StatefulFixtureProps {
  /**
   * Tab definitions, including temporarily hidden tabs.
   */
  tabs: TabItem<EditorTab>[];

  /**
   * Initial selected tab before recovery or menu-driven selection changes.
   */
  initialValue: EditorTab;

  /**
   * Optional spy notified after local selection state updates.
   */
  onChange?: (value: EditorTab) => void;
}

/**
 * Holds selection in React state so empty-strip recovery can move the active tab.
 *
 * @param props - Tab list and initial selection.
 * @returns Stateful SegmentedTabs fixture.
 */
function StatefulVisibilityFixture({
  tabs,
  initialValue,
  onChange
}: StatefulFixtureProps): ReactElement {
  const [value, setValue] = useState<EditorTab>(initialValue);

  return createElement(VisibilityFixture, {
    tabs,
    value,
    onChange: (nextValue) => {
      setValue(nextValue);
      onChange?.(nextValue);
    }
  });
}

/**
 * Builds the Params / Body / Headers tab list used by the request editor.
 *
 * @param hideBody - When true, Body is temporarily unavailable (GET/HEAD/SSE).
 * @returns Tab definitions for the visibility fixture.
 */
function editorTabs(hideBody = false): TabItem<EditorTab>[] {
  return [
    { value: 'params', label: 'Params' },
    { value: 'body', label: 'Body', hidden: hideBody },
    { value: 'headers', label: 'Headers' }
  ];
}

/**
 * Returns the tab buttons currently rendered in the strip.
 *
 * @param container - Mounted fixture root.
 * @returns Tab values in strip order.
 */
function stripTabValues(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).map(
    (button) => button.dataset.tabValue ?? ''
  );
}

/**
 * Opens the VisibilityMenu and returns its checkbox items.
 *
 * @param container - Mounted fixture root.
 * @returns Menu checkbox buttons.
 */
function openVisibilityMenu(container: HTMLElement): HTMLButtonElement[] {
  const trigger = container.querySelector<HTMLButtonElement>(
    '[aria-label="Customize visible tabs"]'
  );
  if (trigger == null) {
    throw new Error('Visibility menu trigger was not found');
  }

  if (trigger.getAttribute('aria-expanded') !== 'true') {
    act(() => {
      trigger.click();
    });
  }

  return Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]'));
}

/**
 * Finds a VisibilityMenu checkbox by its visible label.
 *
 * @param items - Menu checkbox buttons.
 * @param label - Item label text.
 * @returns Matching checkbox button.
 */
function menuItemByLabel(items: HTMLButtonElement[], label: string): HTMLButtonElement {
  const item = items.find((button) => button.textContent?.includes(label));
  if (item == null) {
    throw new Error(`Visibility menu item "${label}" was not found`);
  }
  return item;
}

describe('SegmentedTabs visibility', () => {
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

  it('shows a tab that was hidden on mount once it becomes available', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        createElement(VisibilityFixture, {
          tabs: editorTabs(true),
          value: 'params',
          onChange
        })
      );
    });

    expect(stripTabValues(container)).toEqual(['params', 'headers']);
    expect(container.querySelector('[data-tab-value="body"]')).toBeNull();

    act(() => {
      root.render(
        createElement(VisibilityFixture, {
          tabs: editorTabs(false),
          value: 'params',
          onChange
        })
      );
    });

    expect(stripTabValues(container)).toEqual(['params', 'body', 'headers']);

    const bodyItem = menuItemByLabel(openVisibilityMenu(container), 'Body');
    expect(bodyItem.getAttribute('aria-checked')).toBe('true');
  });

  it('does not re-show a tab the user unchecked after it is hidden and shown again', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        createElement(VisibilityFixture, {
          tabs: editorTabs(false),
          value: 'params',
          onChange
        })
      );
    });

    const bodyItem = menuItemByLabel(openVisibilityMenu(container), 'Body');
    act(() => {
      bodyItem.click();
    });

    expect(stripTabValues(container)).toEqual(['params', 'headers']);
    expect(
      menuItemByLabel(openVisibilityMenu(container), 'Body').getAttribute('aria-checked')
    ).toBe('false');

    act(() => {
      root.render(
        createElement(VisibilityFixture, {
          tabs: editorTabs(true),
          value: 'params',
          onChange
        })
      );
    });

    act(() => {
      root.render(
        createElement(VisibilityFixture, {
          tabs: editorTabs(false),
          value: 'params',
          onChange
        })
      );
    });

    expect(stripTabValues(container)).toEqual(['params', 'headers']);
    expect(
      menuItemByLabel(openVisibilityMenu(container), 'Body').getAttribute('aria-checked')
    ).toBe('false');
  });

  it('shows a tab added after mount in the strip', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        createElement(VisibilityFixture, {
          tabs: editorTabs(false),
          value: 'params',
          onChange
        })
      );
    });

    expect(stripTabValues(container)).toEqual(['params', 'body', 'headers']);

    act(() => {
      root.render(
        createElement(VisibilityFixture, {
          tabs: [...editorTabs(false), { value: 'plugin', label: 'Plugin' }],
          value: 'params',
          onChange
        })
      );
    });

    expect(stripTabValues(container)).toEqual(['params', 'body', 'headers', 'plugin']);
    expect(
      menuItemByLabel(openVisibilityMenu(container), 'Plugin').getAttribute('aria-checked')
    ).toBe('true');
  });

  it('restores and selects another tab when the only visible tab becomes hidden', () => {
    const onChange = vi.fn();

    act(() => {
      root.render(
        createElement(StatefulVisibilityFixture, {
          tabs: editorTabs(false),
          initialValue: 'body',
          onChange
        })
      );
    });

    const menuItems = openVisibilityMenu(container);
    act(() => {
      menuItemByLabel(menuItems, 'Params').click();
    });
    act(() => {
      menuItemByLabel(openVisibilityMenu(container), 'Headers').click();
    });

    expect(stripTabValues(container)).toEqual(['body']);

    act(() => {
      root.render(
        createElement(StatefulVisibilityFixture, {
          tabs: editorTabs(true),
          initialValue: 'body',
          onChange
        })
      );
    });

    expect(stripTabValues(container)).toEqual(['params']);
    expect(
      container.querySelector('[data-tab-value="params"]')?.getAttribute('aria-selected')
    ).toBe('true');
    expect(onChange).toHaveBeenCalledWith('params');
  });
});
