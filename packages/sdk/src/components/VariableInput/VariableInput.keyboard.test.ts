// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { act, createElement, useState } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Variable } from '../../types.js';
import { VariableInput } from './index.js';

const sampleVariables: Variable[] = [
  {
    key: 'baseUrl',
    value: 'https://api.example.com',
    defaultValue: '',
    enabled: true,
    share: false
  },
  { key: 'host', value: 'localhost', defaultValue: '', enabled: true, share: false }
];

interface FixtureProps {
  value: string;
  onChange?: (value: string) => void;
  onEditVariable?: (key: string) => void;
}

/**
 * Renders a controlled VariableInput for keyboard interaction tests.
 */
function Fixture({ value, onChange, onEditVariable }: FixtureProps) {
  const [currentValue, setCurrentValue] = useState(value);

  return createElement(VariableInput, {
    value: currentValue,
    onChange: onChange ?? setCurrentValue,
    variables: sampleVariables,
    onEditVariable,
    'aria-label': 'Test variable input'
  });
}

describe('VariableInput keyboard', () => {
  let container: HTMLDivElement;
  let root: Root;

  /**
   * Mounts VariableInput into a fresh DOM container for each test.
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

  it('puts variable tokens in the Tab order before the text input', () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}/{{host}}/v1' }));
    });

    const tokenButtons = container.querySelectorAll('.hc-variable-input-token-variable');
    expect(tokenButtons).toHaveLength(2);
    expect(tokenButtons[0]?.getAttribute('tabindex')).toBe('0');
    expect(tokenButtons[1]?.getAttribute('tabindex')).toBe('0');

    const input = container.querySelector('.hc-variable-input-field') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(
      tokenButtons[0]?.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('opens a focus tooltip when a variable token receives focus', () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}/path' }));
    });

    const token = container.querySelector('.hc-variable-input-token-variable') as HTMLButtonElement;

    act(() => {
      token.focus();
    });

    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();
    expect(token.getAttribute('aria-expanded')).toBe('true');
    expect(token.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('does not move focus into the tooltip when Tab is pressed on a focused token', () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}' }));
    });

    const token = container.querySelector('.hc-variable-input-token-variable') as HTMLButtonElement;

    act(() => {
      token.focus();
    });

    const tooltip = container.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tooltip).toBeTruthy();

    const valueField = tooltip.querySelector('input[readonly]') as HTMLInputElement;
    expect(valueField).toBeTruthy();

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    });

    act(() => {
      document.dispatchEvent(tabEvent);
    });

    expect(tabEvent.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(token);
    expect(document.activeElement).not.toBe(valueField);
  });

  it('moves Enter from a focused token into the tooltip', async () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}' }));
    });

    const token = container.querySelector('.hc-variable-input-token-variable') as HTMLButtonElement;

    act(() => {
      token.focus();
    });

    const tooltip = container.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tooltip).toBeTruthy();

    const valueField = tooltip.querySelector('input[readonly]') as HTMLInputElement;
    expect(valueField).toBeTruthy();

    act(() => {
      token.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(valueField);
  });

  it('renders a close button in the tooltip', () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}' }));
    });

    const token = container.querySelector('.hc-variable-input-token-variable') as HTMLButtonElement;

    act(() => {
      token.focus();
    });

    const closeButton = container.querySelector(
      'button[aria-label^="Close tooltip"]'
    ) as HTMLButtonElement;
    expect(closeButton).toBeTruthy();
    expect(closeButton.getAttribute('tabindex')).not.toBe('-1');
  });

  it('reaches the close button in the Tab cycle after Enter enters the tooltip', async () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}' }));
    });

    const token = container.querySelector('.hc-variable-input-token-variable') as HTMLButtonElement;

    act(() => {
      token.focus();
    });

    const tooltip = container.querySelector('[role="tooltip"]') as HTMLElement;
    const valueField = tooltip.querySelector('input[readonly]') as HTMLInputElement;
    const copyButton = tooltip.querySelector(
      'button[aria-label^="Copy value"]'
    ) as HTMLButtonElement;
    const closeButton = tooltip.querySelector(
      'button[aria-label^="Close tooltip"]'
    ) as HTMLButtonElement;

    act(() => {
      token.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(valueField);

    act(() => {
      copyButton.focus();
    });

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    });

    act(() => {
      document.dispatchEvent(tabEvent);
    });

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeButton);
  });

  it('closes the focus tooltip and returns focus to the token when close is activated', async () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}' }));
    });

    const token = container.querySelector('.hc-variable-input-token-variable') as HTMLButtonElement;

    act(() => {
      token.focus();
    });

    const closeButton = container.querySelector(
      'button[aria-label^="Close tooltip"]'
    ) as HTMLButtonElement;
    expect(closeButton).toBeTruthy();

    act(() => {
      closeButton.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    expect(document.activeElement).toBe(token);
    expect(token.getAttribute('aria-expanded')).toBeNull();
  });

  it('traps Tab within the tooltip controls after Enter enters the tooltip', async () => {
    act(() => {
      root.render(
        createElement(Fixture, {
          value: '{{baseUrl}}',
          onEditVariable: vi.fn()
        })
      );
    });

    const token = container.querySelector('.hc-variable-input-token-variable') as HTMLButtonElement;

    act(() => {
      token.focus();
    });

    const tooltip = container.querySelector('[role="tooltip"]') as HTMLElement;
    expect(tooltip).toBeTruthy();

    const valueField = tooltip.querySelector('input[readonly]') as HTMLInputElement;
    const copyButton = tooltip.querySelector(
      'button[aria-label^="Copy value"]'
    ) as HTMLButtonElement;
    const editButton = tooltip.querySelector(
      '.hc-variable-input-tooltip-edit'
    ) as HTMLButtonElement;
    expect(valueField).toBeTruthy();
    expect(copyButton).toBeTruthy();
    expect(editButton).toBeTruthy();

    act(() => {
      token.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.activeElement).toBe(valueField);

    act(() => {
      editButton.focus();
    });

    const tabEvent = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true
    });

    act(() => {
      document.dispatchEvent(tabEvent);
    });

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(tooltip.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(valueField);
    expect(document.activeElement).not.toBe(token);
  });

  it('closes the focus tooltip on Escape and returns focus to the token', () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}' }));
    });

    const token = container.querySelector('.hc-variable-input-token-variable') as HTMLButtonElement;

    act(() => {
      token.focus();
    });

    const tooltip = container.querySelector('[role="tooltip"]');
    expect(tooltip).toBeTruthy();

    act(() => {
      token.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
    });

    expect(container.querySelector('[role="tooltip"]')).toBeNull();
    expect(document.activeElement).toBe(token);
    expect(token.getAttribute('aria-expanded')).toBeNull();
  });

  it('advances to the next variable token after Escape and Tab', () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}/{{host}}' }));
    });

    const tokens = container.querySelectorAll(
      '.hc-variable-input-token-variable'
    ) as NodeListOf<HTMLButtonElement>;
    const first = tokens[0];
    const second = tokens[1];

    act(() => {
      first.focus();
    });

    act(() => {
      first.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
    });

    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    act(() => {
      second.focus();
    });

    expect(container.querySelector('[role="tooltip"]')).toBeTruthy();
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute('aria-expanded')).toBe('true');
  });

  it('does not open a tooltip for a range-selected input and clears on blur', async () => {
    act(() => {
      root.render(createElement(Fixture, { value: '{{baseUrl}}/path' }));
    });

    const tokens = container.querySelectorAll(
      '.hc-variable-input-token-variable'
    ) as NodeListOf<HTMLButtonElement>;
    const lastToken = tokens[tokens.length - 1];
    const input = container.querySelector('.hc-variable-input-field') as HTMLInputElement;
    const outside = document.createElement('button');
    outside.type = 'button';
    outside.textContent = 'Outside';
    document.body.appendChild(outside);

    act(() => {
      lastToken.focus();
    });

    act(() => {
      lastToken.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
    });

    act(() => {
      input.focus();
      input.setSelectionRange(0, input.value.length);
      input.dispatchEvent(new Event('select', { bubbles: true }));
    });

    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    await act(async () => {
      outside.focus();
      await Promise.resolve();
    });

    expect(container.querySelector('[role="tooltip"]')).toBeNull();

    outside.remove();
  });
});
