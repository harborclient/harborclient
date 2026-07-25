import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  advanceTypewriterReveal,
  prefersReducedMotion,
  typewriterRevealStep
} from './typewriterReveal';

describe('typewriterReveal', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 0 when nothing remains to reveal', () => {
    expect(typewriterRevealStep(0, 100)).toBe(0);
  });

  it('uses a single character step for short replies', () => {
    expect(typewriterRevealStep(40, 40)).toBe(1);
  });

  it('uses larger steps for longer replies', () => {
    expect(typewriterRevealStep(500, 500)).toBe(3);
    expect(typewriterRevealStep(2000, 2000)).toBe(6);
    expect(typewriterRevealStep(5000, 5000)).toBe(12);
  });

  it('never reveals more characters than remain', () => {
    expect(typewriterRevealStep(2, 5000)).toBe(2);
  });

  it('advances the visible length without exceeding the total', () => {
    expect(advanceTypewriterReveal(0, 10)).toBe(1);
    expect(advanceTypewriterReveal(9, 10)).toBe(10);
    expect(advanceTypewriterReveal(10, 10)).toBe(10);
  });

  it('detects prefers-reduced-motion', () => {
    // Tests run in a node environment, so window must be stubbed alongside
    // matchMedia for prefersReducedMotion() to see the media query result.
    vi.stubGlobal('window', {
      matchMedia: vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });

    expect(prefersReducedMotion()).toBe(true);
  });

  it('returns false when matchMedia is unavailable', () => {
    vi.stubGlobal('window', { matchMedia: undefined });
    expect(prefersReducedMotion()).toBe(false);
  });
});
