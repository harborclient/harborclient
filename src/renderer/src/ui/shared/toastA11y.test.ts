import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TOAST_ARIA_PROPS,
  ERROR_TOAST_ARIA_PROPS,
  SUCCESS_TOAST_ARIA_PROPS,
  THEME_PROMPT_TOAST_LIVE_PROPS
} from '#/renderer/src/ui/shared/toastA11y';

describe('toastA11y', () => {
  it('uses polite status announcements for default and success toasts', () => {
    expect(DEFAULT_TOAST_ARIA_PROPS).toEqual({
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': true
    });
    expect(SUCCESS_TOAST_ARIA_PROPS).toEqual(DEFAULT_TOAST_ARIA_PROPS);
  });

  it('uses assertive alert announcements for error toasts', () => {
    expect(ERROR_TOAST_ARIA_PROPS).toEqual({
      role: 'alert',
      'aria-live': 'assertive',
      'aria-atomic': true
    });
  });

  it('defines live-region props for custom theme prompt toasts', () => {
    expect(THEME_PROMPT_TOAST_LIVE_PROPS).toEqual({
      role: 'status',
      'aria-live': 'polite',
      'aria-atomic': true
    });
  });
});
