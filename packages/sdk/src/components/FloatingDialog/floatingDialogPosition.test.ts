import { describe, expect, it } from 'vitest';
import {
  FLOATING_DIALOG_VIEWPORT_MARGIN_PX,
  isFloatingDialogFullyOnScreen
} from './floatingDialogPosition.js';

describe('isFloatingDialogFullyOnScreen', () => {
  const size = { width: 288, height: 160 };
  const viewport = { width: 1200, height: 800 };

  it('returns true when the panel fits inside the viewport margin', () => {
    expect(isFloatingDialogFullyOnScreen({ left: 96, top: 96 }, size, viewport)).toBe(true);
  });

  it('returns false when the left edge is past the margin', () => {
    expect(
      isFloatingDialogFullyOnScreen(
        { left: FLOATING_DIALOG_VIEWPORT_MARGIN_PX - 1, top: 96 },
        size,
        viewport
      )
    ).toBe(false);
  });

  it('returns false when the top edge is past the margin', () => {
    expect(
      isFloatingDialogFullyOnScreen(
        { left: 96, top: FLOATING_DIALOG_VIEWPORT_MARGIN_PX - 1 },
        size,
        viewport
      )
    ).toBe(false);
  });

  it('returns false when the right edge overflows the viewport', () => {
    expect(isFloatingDialogFullyOnScreen({ left: 1000, top: 96 }, size, viewport)).toBe(false);
  });

  it('returns false when the bottom edge overflows the viewport', () => {
    expect(isFloatingDialogFullyOnScreen({ left: 96, top: 700 }, size, viewport)).toBe(false);
  });

  it('treats unknown panel size as on-screen so layout can measure first', () => {
    expect(
      isFloatingDialogFullyOnScreen({ left: 5000, top: 5000 }, { width: 0, height: 0 }, viewport)
    ).toBe(true);
  });
});
