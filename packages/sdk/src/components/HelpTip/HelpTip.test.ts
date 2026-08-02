// @vitest-environment jsdom
import { installReact } from '@harborclient/sdk';
import { act, createElement } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostReactDom } from '../../runtime/reactHost.js';
import { HELP_TIP_HIDE_DELAY_MS, HELP_TIP_SHOW_DELAY_MS, HelpTip } from './index.js';

describe('HelpTip', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    installReact(React);
    setHostReactDom(ReactDOM);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.querySelectorAll('.hc-help-tip-panel').forEach((node) => node.remove());
    vi.useRealTimers();
  });

  /**
   * Renders a HelpTip with sample help copy.
   */
  function renderTip(): void {
    act(() => {
      root.render(
        createElement(HelpTip, {
          ariaLabel: 'Run command help',
          children: 'Optional absolute binary and arguments.'
        })
      );
    });
  }

  /**
   * Returns the trigger button for the rendered tip.
   */
  function getTrigger(): HTMLButtonElement {
    const button = container.querySelector('button.hc-help-tip-trigger');
    expect(button).not.toBeNull();
    return button as HTMLButtonElement;
  }

  /**
   * Returns the portaled tip panel when present.
   */
  function getPanel(): HTMLElement | null {
    return document.body.querySelector('.hc-help-tip-panel');
  }

  /**
   * Dispatches a bubbling mouseover so React fires onMouseEnter.
   *
   * @param element - Element under the pointer.
   * @param clientX - Viewport X for tip placement.
   * @param clientY - Viewport Y for tip placement.
   */
  function mouseOver(element: Element, clientX = 40, clientY = 60): void {
    element.dispatchEvent(
      new MouseEvent('mouseover', { bubbles: true, clientX, clientY, relatedTarget: null })
    );
  }

  /**
   * Dispatches a bubbling mouseout so React fires onMouseLeave.
   *
   * @param element - Element the pointer is leaving.
   */
  function mouseOut(element: Element): void {
    element.dispatchEvent(
      new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body })
    );
  }

  it('renders an accessible question-mark trigger without an open tip', () => {
    renderTip();

    const trigger = getTrigger();
    expect(trigger.getAttribute('aria-label')).toBe('Run command help');
    expect(trigger.getAttribute('aria-describedby')).toBeNull();
    expect(getPanel()).toBeNull();
  });

  it('opens the tip after the show delay on hover', () => {
    renderTip();
    const trigger = getTrigger();

    act(() => {
      mouseOver(trigger);
    });
    expect(getPanel()).toBeNull();

    act(() => {
      vi.advanceTimersByTime(HELP_TIP_SHOW_DELAY_MS - 1);
    });
    expect(getPanel()).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    const panel = getPanel();
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('tooltip');
    expect(panel?.textContent).toContain('Optional absolute binary and arguments.');
    expect(trigger.getAttribute('aria-describedby')).toBe(panel?.id);
  });

  it('stays open when the pointer moves from the trigger onto the tip', () => {
    renderTip();
    const trigger = getTrigger();

    act(() => {
      mouseOver(trigger);
      vi.advanceTimersByTime(HELP_TIP_SHOW_DELAY_MS);
    });

    const panel = getPanel();
    expect(panel).not.toBeNull();

    act(() => {
      mouseOut(trigger);
    });
    expect(getPanel()).not.toBeNull();

    act(() => {
      mouseOver(panel!);
      vi.advanceTimersByTime(HELP_TIP_HIDE_DELAY_MS);
    });
    expect(getPanel()).not.toBeNull();
  });

  it('hides the tip after the hide delay when the pointer leaves the tip', () => {
    renderTip();
    const trigger = getTrigger();

    act(() => {
      mouseOver(trigger);
      vi.advanceTimersByTime(HELP_TIP_SHOW_DELAY_MS);
    });

    const panel = getPanel();
    expect(panel).not.toBeNull();

    act(() => {
      mouseOut(trigger);
      mouseOver(panel!);
      mouseOut(panel!);
    });
    expect(getPanel()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(HELP_TIP_HIDE_DELAY_MS - 1);
    });
    expect(getPanel()).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(getPanel()).toBeNull();
  });

  it('dismisses the tip immediately on Escape', () => {
    renderTip();
    const trigger = getTrigger();

    act(() => {
      mouseOver(trigger);
      vi.advanceTimersByTime(HELP_TIP_SHOW_DELAY_MS);
    });
    expect(getPanel()).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(getPanel()).toBeNull();
  });

  it('opens on keyboard focus after the show delay', () => {
    renderTip();
    const trigger = getTrigger();

    act(() => {
      trigger.focus();
    });
    expect(getPanel()).toBeNull();

    act(() => {
      vi.advanceTimersByTime(HELP_TIP_SHOW_DELAY_MS);
    });
    expect(getPanel()).not.toBeNull();
  });
});
