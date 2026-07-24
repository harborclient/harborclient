import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUTOCOMPLETE_CATEGORY_HEADER_KEY, headerKeySource } from './sources';

describe('autocomplete sources', () => {
  const getAutocompleteValues = vi.fn<(category: string) => Promise<string[]>>();
  const addAutocompleteValue = vi.fn<(category: string, value: string) => Promise<void>>();

  beforeEach(() => {
    getAutocompleteValues.mockReset();
    addAutocompleteValue.mockReset();
    vi.stubGlobal('window', {
      api: {
        getAutocompleteValues,
        addAutocompleteValue
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty list when IPC list fails', async () => {
    getAutocompleteValues.mockRejectedValue(new Error('ipc unavailable'));

    await expect(headerKeySource.list()).resolves.toEqual([]);
  });

  it('returns an empty list when IPC list returns a non-array', async () => {
    getAutocompleteValues.mockResolvedValue('not-an-array' as unknown as string[]);

    await expect(headerKeySource.list()).resolves.toEqual([]);
  });

  it('persists values without throwing when IPC add fails', async () => {
    addAutocompleteValue.mockRejectedValue(new Error('ipc unavailable'));

    await expect(headerKeySource.add('Authorization')).resolves.toBeUndefined();
    expect(addAutocompleteValue).toHaveBeenCalledWith(
      AUTOCOMPLETE_CATEGORY_HEADER_KEY,
      'Authorization'
    );
  });
});
