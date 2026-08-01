// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearTerminalFindToggle,
  isTerminalFindContextActive,
  registerTerminalFindToggle,
  TERMINAL_PANEL_ID,
  tryToggleTerminalFind
} from './terminalFindShortcut';

describe('terminalFindShortcut', () => {
  /**
   * Clears the toggle registration and restores document focus between cases.
   */
  afterEach(() => {
    clearTerminalFindToggle();
    document.body.innerHTML = '';
    document.body.focus();
  });

  it('reports inactive context when the terminal panel is not in the DOM', () => {
    expect(isTerminalFindContextActive()).toBe(false);
  });

  it('reports active context when focus is inside the terminal panel', () => {
    const panel = document.createElement('div');
    panel.id = TERMINAL_PANEL_ID;
    const input = document.createElement('input');
    panel.appendChild(input);
    document.body.appendChild(panel);
    input.focus();

    expect(isTerminalFindContextActive()).toBe(true);
  });

  it('reports inactive context when focus is outside the terminal panel', () => {
    const panel = document.createElement('div');
    panel.id = TERMINAL_PANEL_ID;
    document.body.appendChild(panel);
    const outside = document.createElement('input');
    document.body.appendChild(outside);
    outside.focus();

    expect(isTerminalFindContextActive()).toBe(false);
  });

  it('invokes the registered toggle when find context is active', () => {
    const panel = document.createElement('div');
    panel.id = TERMINAL_PANEL_ID;
    const input = document.createElement('input');
    panel.appendChild(input);
    document.body.appendChild(panel);
    input.focus();

    const toggle = vi.fn();
    registerTerminalFindToggle(toggle);

    expect(tryToggleTerminalFind()).toBe(true);
    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('does not invoke the toggle when find context is inactive', () => {
    const toggle = vi.fn();
    registerTerminalFindToggle(toggle);

    expect(tryToggleTerminalFind()).toBe(false);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('stops invoking after the disposer clears the registration', () => {
    const panel = document.createElement('div');
    panel.id = TERMINAL_PANEL_ID;
    const input = document.createElement('input');
    panel.appendChild(input);
    document.body.appendChild(panel);
    input.focus();

    const toggle = vi.fn();
    const dispose = registerTerminalFindToggle(toggle);
    dispose();

    expect(tryToggleTerminalFind()).toBe(false);
    expect(toggle).not.toHaveBeenCalled();
  });

  it('does not clear a newer registration when an older disposer runs', () => {
    const panel = document.createElement('div');
    panel.id = TERMINAL_PANEL_ID;
    const input = document.createElement('input');
    panel.appendChild(input);
    document.body.appendChild(panel);
    input.focus();

    const first = vi.fn();
    const second = vi.fn();
    const disposeFirst = registerTerminalFindToggle(first);
    registerTerminalFindToggle(second);
    disposeFirst();

    expect(tryToggleTerminalFind()).toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
