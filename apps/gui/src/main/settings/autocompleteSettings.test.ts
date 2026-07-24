import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn()
}));

/** Mutable backing store used by mocked electron-store get/set. */
let autocompleteStore: Record<string, string[]> = {};

vi.mock('electron-store', () => ({
  default: class MockStore {
    get = mockGet;
    set = mockSet;
  }
}));

describe('autocompleteSettings', () => {
  beforeEach(async () => {
    vi.resetModules();
    autocompleteStore = {};
    mockGet.mockReset();
    mockSet.mockReset();
    mockGet.mockImplementation((key: string, defaultValue: unknown) => {
      if (key === 'autocomplete') {
        return autocompleteStore;
      }
      return defaultValue;
    });
    mockSet.mockImplementation((key: string, value: unknown) => {
      if (key === 'autocomplete' && typeof value === 'object' && value !== null) {
        autocompleteStore = value as Record<string, string[]>;
      }
    });
    const { resetAutocompleteSettingsStoreForTesting } =
      await import('#/main/settings/autocompleteSettings');
    resetAutocompleteSettingsStoreForTesting();
  });

  it('returns an empty list when a category is unset', async () => {
    const { getAutocompleteValues } = await import('#/main/settings/autocompleteSettings');

    expect(getAutocompleteValues('header.key')).toEqual([]);
    expect(mockGet).toHaveBeenCalledWith('autocomplete', {});
  });

  it('returns persisted values for a category', async () => {
    autocompleteStore = {
      'header.key': ['Authorization', 'Content-Type']
    };
    const { getAutocompleteValues } = await import('#/main/settings/autocompleteSettings');

    expect(getAutocompleteValues('header.key')).toEqual(['Authorization', 'Content-Type']);
  });

  it('trims values and ignores empty strings', async () => {
    const { addAutocompleteValue, getAutocompleteValues } =
      await import('#/main/settings/autocompleteSettings');

    addAutocompleteValue('url', '   ');
    addAutocompleteValue('url', '  https://example.com  ');

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockSet).toHaveBeenCalledWith('autocomplete', {
      url: ['https://example.com']
    });
    expect(getAutocompleteValues('url')).toEqual(['https://example.com']);
  });

  it('prepends new values and de-duplicates case-insensitively', async () => {
    autocompleteStore = {
      'header.key': ['Authorization', 'content-type']
    };
    const { addAutocompleteValue } = await import('#/main/settings/autocompleteSettings');

    addAutocompleteValue('header.key', 'Content-Type');
    addAutocompleteValue('header.key', 'Accept');

    expect(mockSet).toHaveBeenNthCalledWith(1, 'autocomplete', {
      'header.key': ['Content-Type', 'Authorization']
    });
    expect(mockSet).toHaveBeenNthCalledWith(2, 'autocomplete', {
      'header.key': ['Accept', 'Content-Type', 'Authorization']
    });
  });

  it('caps each category list at the maximum entry count', async () => {
    const { AUTOCOMPLETE_MAX_ENTRIES, addAutocompleteValue } =
      await import('#/main/settings/autocompleteSettings');
    const existing = Array.from(
      { length: AUTOCOMPLETE_MAX_ENTRIES },
      (_, index) => `item-${index}`
    );
    autocompleteStore = { 'param.key': existing };

    addAutocompleteValue('param.key', 'new-param');

    expect(mockSet).toHaveBeenCalledWith('autocomplete', {
      'param.key': ['new-param', ...existing.slice(0, AUTOCOMPLETE_MAX_ENTRIES - 1)]
    });
  });
});
