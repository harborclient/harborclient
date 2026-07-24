import { describe, expect, it, vi } from 'vitest';
import { setShowResponseEditor } from '#/renderer/src/store/slices/navigationSlice';
import {
  findFirstFocusableInResponseEditor,
  focusFirstElementInResponseEditor,
  focusResponseEditor,
  RESPONSE_EDITOR_SECTION_ID
} from './focusResponseEditor';

/**
 * Builds a minimal HTMLElement stub for focusability checks in unit tests.
 *
 * @param options - Visibility and attribute state for the stub element.
 * @returns HTMLElement-like object accepted by focus helpers.
 */
function createFocusableStub(options: {
  hidden?: boolean;
  ariaHidden?: boolean;
  visible?: boolean;
  hasSize?: boolean;
}): HTMLElement {
  const element = {
    focus: vi.fn(),
    scrollIntoView: vi.fn(),
    getAttribute: (name: string) => {
      if (name === 'aria-hidden') {
        return options.ariaHidden === true ? 'true' : null;
      }
      return null;
    },
    closest: (selector: string) => {
      if (options.hidden === true && selector.includes('hidden')) {
        return element;
      }
      return null;
    },
    getBoundingClientRect: () => ({
      width: options.hasSize === false ? 0 : 10,
      height: options.hasSize === false ? 0 : 10
    })
  };

  return element as unknown as HTMLElement;
}

describe('findFirstFocusableInResponseEditor', () => {
  it('returns the first visible focusable element in document order', () => {
    const hiddenButton = createFocusableStub({ hidden: true });
    const status = createFocusableStub({});
    const container = {
      querySelectorAll: () => [hiddenButton, status] as unknown as NodeListOf<HTMLElement>
    };

    vi.stubGlobal('window', {
      getComputedStyle: vi.fn(() => ({ visibility: 'visible', display: 'block' }))
    });

    expect(findFirstFocusableInResponseEditor(container as unknown as ParentNode)).toBe(status);

    vi.unstubAllGlobals();
  });
});

describe('focusFirstElementInResponseEditor', () => {
  it('focuses the first focusable element in the response editor section', () => {
    const status = createFocusableStub({});
    const section = {
      querySelectorAll: () => [status] as unknown as NodeListOf<HTMLElement>
    };

    vi.stubGlobal('window', {
      getComputedStyle: vi.fn(() => ({ visibility: 'visible', display: 'block' }))
    });
    vi.stubGlobal('document', {
      getElementById: vi.fn((id: string) => (id === RESPONSE_EDITOR_SECTION_ID ? section : null)),
      activeElement: status
    });

    expect(focusFirstElementInResponseEditor()).toBe(true);
    expect(status.focus).toHaveBeenCalledWith();

    vi.unstubAllGlobals();
  });
});

describe('focusResponseEditor', () => {
  it('dispatches navigation actions to reveal the response editor', () => {
    const dispatch = vi.fn();

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      getElementById: vi.fn()
    });

    focusResponseEditor(dispatch);

    expect(dispatch).toHaveBeenCalledWith(setShowResponseEditor(true));

    vi.unstubAllGlobals();
  });
});
