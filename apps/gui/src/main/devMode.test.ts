import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsPackaged = vi.hoisted(() => ({ value: false }));

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value;
    }
  }
}));

import { isDevModeFlagEnabled, isDeveloperToolsEnabled } from './devMode';

describe('isDevModeFlagEnabled', () => {
  it('returns true when --dev-mode is present', () => {
    expect(isDevModeFlagEnabled(['electron', '--dev-mode'])).toBe(true);
  });

  it('returns false when --dev-mode is absent', () => {
    expect(isDevModeFlagEnabled(['electron', '--verbose'])).toBe(false);
  });
});

describe('isDeveloperToolsEnabled', () => {
  beforeEach(() => {
    mockIsPackaged.value = false;
  });

  it('returns true in unpackaged builds without the flag', () => {
    mockIsPackaged.value = false;
    expect(isDeveloperToolsEnabled(['electron'])).toBe(true);
  });

  it('returns true in packaged builds when --dev-mode is present', () => {
    mockIsPackaged.value = true;
    expect(isDeveloperToolsEnabled(['electron', '--dev-mode'])).toBe(true);
  });

  it('returns false in packaged builds without the flag', () => {
    mockIsPackaged.value = true;
    expect(isDeveloperToolsEnabled(['electron'])).toBe(false);
  });
});
