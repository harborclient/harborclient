import type { AppDispatch } from '#/renderer/src/store/redux';
import { setShowResponseEditor } from '#/renderer/src/store/slices/navigationSlice';

/** Stable id of the response editor root section in the main request editor. */
export const RESPONSE_EDITOR_SECTION_ID = 'response-editor';

/** Maximum animation frames to retry focusing after React updates. */
const FOCUS_MAX_ATTEMPTS = 6;

/**
 * Selector for native and custom tab stops inside the response editor.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ');

/**
 * Returns true when an element can receive keyboard focus in the current layout.
 *
 * @param element - Candidate focus target inside the response editor.
 * @returns Whether the element is visible and enabled for focus.
 */
function isVisibleFocusable(element: HTMLElement): boolean {
  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  if (element.closest('[hidden], [aria-hidden="true"]') != null) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.visibility === 'hidden' || style.display === 'none') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }

  return true;
}

/**
 * Finds the first visible focusable element inside the response editor section.
 *
 * @param container - Response editor root or a subtree to search.
 * @returns First focusable element in document order, or null when none exist.
 */
export function findFirstFocusableInResponseEditor(container: ParentNode): HTMLElement | null {
  for (const candidate of container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) {
    if (isVisibleFocusable(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Focuses the first focusable control in the mounted response editor.
 *
 * Uses plain {@link HTMLElement.focus} so Chromium applies `:focus:not(:focus-visible)`
 * styling for programmatic moves from keyboard shortcuts.
 *
 * @returns True when focus landed on a response editor control.
 */
export function focusFirstElementInResponseEditor(): boolean {
  const section = document.getElementById(RESPONSE_EDITOR_SECTION_ID);
  if (section == null) {
    return false;
  }

  const target = findFirstFocusableInResponseEditor(section);
  if (target == null || typeof target.focus !== 'function') {
    return false;
  }

  target.focus();
  if ('scrollIntoView' in target && typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  return document.activeElement === target;
}

/**
 * Retries focusing the response editor across animation frames until React commits.
 */
export function focusResponseEditorWhenMounted(): void {
  let attempts = 0;

  /**
   * Attempts to focus the first response control, scheduling another frame when needed.
   */
  const tryFocus = (): void => {
    if (focusFirstElementInResponseEditor() || attempts >= FOCUS_MAX_ATTEMPTS) {
      return;
    }

    attempts += 1;
    requestAnimationFrame(tryFocus);
  };

  requestAnimationFrame(tryFocus);
}

/**
 * Reveals the response editor and focuses its first focusable control.
 *
 * No-ops when the response editor is not mounted (for example on a settings tab).
 *
 * @param dispatch - Redux dispatch used to reveal the response editor panel.
 */
export function focusResponseEditor(dispatch: AppDispatch): void {
  dispatch(setShowResponseEditor(true));
  focusResponseEditorWhenMounted();
}
