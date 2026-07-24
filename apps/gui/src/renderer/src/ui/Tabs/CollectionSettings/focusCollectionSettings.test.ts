import { describe, expect, it, vi } from 'vitest';
import {
  COLLECTION_SETTINGS_NAME_INPUT_ID,
  focusCollectionSettings
} from './focusCollectionSettings';

describe('focusCollectionSettings', () => {
  it('focuses and selects the collection name input when mounted', () => {
    const focus = vi.fn();
    const select = vi.fn();
    const getElementById = vi.fn((id: string) => {
      if (id === COLLECTION_SETTINGS_NAME_INPUT_ID) {
        return { focus, select };
      }
      return null;
    });

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', { getElementById });

    focusCollectionSettings();

    expect(getElementById).toHaveBeenCalledWith(COLLECTION_SETTINGS_NAME_INPUT_ID);
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

    expect(() => focusCollectionSettings()).not.toThrow();

    vi.unstubAllGlobals();
  });
});
