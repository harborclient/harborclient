// @vitest-environment jsdom
import { type JSX, act, createElement } from 'react';
import * as React from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHostReact } from '../../runtime/reactHost.js';
import { type UseResizableResult, useResizable } from './useResizable.js';

/**
 * Builds a matchMedia stub for prefers-reduced-motion tests.
 *
 * @param reduced - Whether reduced motion should match.
 * @returns A matchMedia-compatible function.
 */
function createMatchMedia(reduced: boolean): typeof window.matchMedia {
  return (query: string) =>
    ({
      matches: reduced && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }) as MediaQueryList;
}

describe('useResizable', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseResizableResult | null;
  let rafQueue: FrameRequestCallback[];
  let nextRafId: number;
  let onPersist: ReturnType<typeof vi.fn<(size: number) => void>>;

  /**
   * Mounts a fixture that exposes useResizable through DOM data attributes.
   */
  function ResizableFixture({
    defaultSize = 200,
    minSize = 100
  }: {
    defaultSize?: number;
    minSize?: number;
  }): JSX.Element {
    const result = useResizable({
      axis: 'x',
      direction: 1,
      defaultSize,
      minSize,
      onPersist
    });
    latest = result;

    return createElement('div', {
      role: 'separator',
      'data-size': String(result.size),
      onMouseDown: result.onResizeStart,
      onKeyDown: result.onKeyboardResize
    });
  }

  /**
   * Renders the fixture and returns the separator element.
   *
   * @param props - Optional fixture props.
   * @returns The mounted separator element.
   */
  function renderFixture(props?: { defaultSize?: number; minSize?: number }): HTMLElement {
    act(() => {
      root.render(createElement(ResizableFixture, props ?? {}));
    });
    const el = container.querySelector('[role="separator"]');
    if (!el) {
      throw new Error('Expected separator to render');
    }
    return el as HTMLElement;
  }

  /**
   * Runs all queued requestAnimationFrame callbacks once.
   */
  function flushRaf(): void {
    const queued = rafQueue.splice(0);
    act(() => {
      for (const cb of queued) {
        cb(performance.now());
      }
    });
  }

  /**
   * Starts a resize drag at the given client X.
   *
   * @param el - Separator element.
   * @param clientX - Pointer X at drag start.
   */
  function startDrag(el: HTMLElement, clientX: number): void {
    act(() => {
      el.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, clientX, clientY: 0, button: 0 })
      );
    });
  }

  /**
   * Dispatches a window mousemove at the given client X.
   *
   * @param clientX - Pointer X during drag.
   */
  function movePointer(clientX: number): void {
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY: 0 }));
    });
  }

  /**
   * Ends the active resize drag.
   */
  function endDrag(): void {
    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
  }

  beforeEach(() => {
    setHostReact(React);
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
    onPersist = vi.fn();
    rafQueue = [];
    nextRafId = 1;

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      rafQueue.push(cb);
      return nextRafId++;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
      void id;
      rafQueue = [];
    });
    vi.stubGlobal('matchMedia', createMatchMedia(false));
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = '';
    delete document.body.dataset.hcResizing;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('eases size toward the pointer target across animation frames', () => {
    const el = renderFixture({ defaultSize: 200 });
    expect(el.getAttribute('data-size')).toBe('200');

    startDrag(el, 100);
    movePointer(200);

    // Target is 300 (200 + 100), but size should not jump all the way yet.
    expect(el.getAttribute('data-size')).toBe('200');
    expect(rafQueue).toHaveLength(1);

    flushRaf();
    // 200 + (300 - 200) * 0.22 = 222
    expect(Number(el.getAttribute('data-size'))).toBeCloseTo(222, 5);
    expect(Number(el.getAttribute('data-size'))).toBeLessThan(300);
    expect(rafQueue).toHaveLength(1);
  });

  it('updates size immediately when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', createMatchMedia(true));
    const el = renderFixture({ defaultSize: 200 });

    startDrag(el, 100);
    movePointer(200);

    expect(el.getAttribute('data-size')).toBe('300');
    expect(rafQueue).toHaveLength(0);
  });

  it('snaps to the pointer target and persists on mouseup', () => {
    const el = renderFixture({ defaultSize: 200 });

    startDrag(el, 100);
    movePointer(200);
    flushRaf();
    expect(Number(el.getAttribute('data-size'))).toBeCloseTo(222, 5);

    endDrag();

    expect(el.getAttribute('data-size')).toBe('300');
    expect(onPersist).toHaveBeenCalledWith(300);
    expect(rafQueue).toHaveLength(0);
    expect(document.body.dataset.hcResizing).toBeUndefined();
  });

  it('applies keyboard nudges instantly without waiting for animation frames', () => {
    const el = renderFixture({ defaultSize: 200 });

    act(() => {
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
      );
    });

    expect(el.getAttribute('data-size')).toBe('210');
    expect(onPersist).toHaveBeenCalledWith(210);
    expect(rafQueue).toHaveLength(0);
    expect(latest?.size).toBe(210);
  });
});
