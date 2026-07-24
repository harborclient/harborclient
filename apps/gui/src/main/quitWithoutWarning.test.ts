import { describe, expect, it } from 'vitest';
import { isQuitWithoutWarningFlagEnabled } from './quitWithoutWarning';

describe('isQuitWithoutWarningFlagEnabled', () => {
  it('returns true when --quit-without-warning is present', () => {
    expect(isQuitWithoutWarningFlagEnabled(['electron', '--quit-without-warning'])).toBe(true);
  });

  it('returns false when --quit-without-warning is absent', () => {
    expect(isQuitWithoutWarningFlagEnabled(['electron', '--verbose'])).toBe(false);
  });
});
