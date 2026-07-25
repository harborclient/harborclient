// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { act, createElement, useState } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AutocompleteSource } from './types.js';
import { filterAutocompleteItems, useAutocomplete } from './useAutocomplete.js';

describe('filterAutocompleteItems', () => {
  it('treats undefined and null values as empty', () => {
    expect(filterAutocompleteItems(['Authorization', 'Accept'], undefined)).toEqual([
      'Authorization',
      'Accept'
    ]);
    expect(filterAutocompleteItems(['Authorization', 'Accept'], null)).toEqual([
      'Authorization',
      'Accept'
    ]);
  });

  it('excludes an exact case-insensitive match from suggestions', () => {
    expect(filterAutocompleteItems(['Authorization', 'Accept'], 'accept')).toEqual([]);
  });

  it('filters by substring when the input has content', () => {
    expect(filterAutocompleteItems(['Content-Type', 'Accept', 'Authorization'], 'auth')).toEqual([
      'Authorization'
    ]);
  });
});

describe('useAutocomplete close on select', () => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * Mounts a minimal combobox fixture backed by useAutocomplete.
   */
  function AutocompleteFixture({
    source,
    initialValue = ''
  }: {
    source: AutocompleteSource;
    initialValue?: string;
  }) {
    const [value, setValue] = useState(initialValue);
    const { open, items, anchorRef, onFocus, selectItem } = useAutocomplete({
      source,
      value,
      onSelect: setValue
    });

    return createElement(
      'div',
      null,
      createElement('input', {
        ref: anchorRef,
        value,
        'aria-expanded': open,
        onFocus,
        onChange: (event: Event) => {
          const target = event.target as HTMLInputElement;
          setValue(target.value);
        }
      }),
      open
        ? createElement(
            'ul',
            { role: 'listbox' },
            items.map((item) =>
              createElement(
                'li',
                {
                  key: item,
                  role: 'option',
                  onMouseDown: (event: MouseEvent) => {
                    event.preventDefault();
                    selectItem(item);
                  }
                },
                item
              )
            )
          )
        : null
    );
  }

  /**
   * Mounts the autocomplete fixture for interaction tests.
   */
  function renderAutocomplete(source: AutocompleteSource, initialValue = ''): HTMLInputElement {
    act(() => {
      root.render(createElement(AutocompleteFixture, { source, initialValue }));
    });

    const input = container.querySelector('input');
    if (!input) {
      throw new Error('Expected autocomplete input to render');
    }
    return input;
  }

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
    document.body.removeChild(container);
    document.body.innerHTML = '';
  });

  it('closes the suggestion list after mouse selection', async () => {
    const source: AutocompleteSource = {
      list: async () => ['Accept', 'Authorization'],
      add: async () => {}
    };

    const input = renderAutocomplete(source, 'Auth');

    await act(async () => {
      input.focus();
    });

    await act(async () => {
      await Promise.resolve();
    });

    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();

    await act(async () => {
      option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(input.value).toBe('Authorization');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('does not reopen after selection when a stale async open completes', async () => {
    let resolveList: (items: string[]) => void = () => {};
    const listPromise = new Promise<string[]>((resolve) => {
      resolveList = resolve;
    });

    const source: AutocompleteSource = {
      list: () => listPromise,
      add: async () => {}
    };

    const input = renderAutocomplete(source, 'Auth');

    await act(async () => {
      input.focus();
    });

    await act(async () => {
      input.blur();
    });

    await act(async () => {
      input.focus();
    });

    await act(async () => {
      resolveList(['Accept', 'Authorization']);
      await listPromise;
      await Promise.resolve();
    });

    const option = container.querySelector('[role="option"]');
    expect(option).not.toBeNull();

    await act(async () => {
      option!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(container.querySelector('[role="listbox"]')).toBeNull();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });
});
