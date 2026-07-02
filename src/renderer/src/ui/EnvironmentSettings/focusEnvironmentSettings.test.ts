import { describe, expect, it, vi } from 'vitest';
import {
  ENVIRONMENT_SETTINGS_NAME_INPUT_ID,
  focusEnvironmentSettings
} from './focusEnvironmentSettings';

describe('focusEnvironmentSettings', () => {
  it('focuses and selects the environment name input when mounted', () => {
    const focus = vi.fn();
    const select = vi.fn();
    const getElementById = vi.fn((id: string) => {
      if (id === ENVIRONMENT_SETTINGS_NAME_INPUT_ID) {
        return { focus, select };
      }
      return null;
    });

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', { getElementById });

    focusEnvironmentSettings();

    expect(getElementById).toHaveBeenCalledWith(ENVIRONMENT_SETTINGS_NAME_INPUT_ID);
    expect(focus).toHaveBeenCalled();
    expect(select).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('no-ops when the name input is not mounted', () => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      getElementById: vi.fn(() => null)
    });

    expect(() => focusEnvironmentSettings()).not.toThrow();

    vi.unstubAllGlobals();
  });
});
