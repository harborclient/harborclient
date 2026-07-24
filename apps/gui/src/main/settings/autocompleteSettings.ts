import Store from 'electron-store';

const STORE_KEY = 'autocomplete';

/** Maximum number of suggestions retained per category. */
export const AUTOCOMPLETE_MAX_ENTRIES = 100;

type AutocompleteStore = Record<string, string[]>;

let store: Store<{ autocomplete: AutocompleteStore }> | null = null;

/**
 * Returns the lazy electron-store instance for autocomplete suggestions.
 */
function getStore(): Store<{ autocomplete: AutocompleteStore }> {
  if (!store) {
    store = new Store<{ autocomplete: AutocompleteStore }>({
      name: 'settings',
      defaults: {
        autocomplete: {}
      }
    });
  }
  return store;
}

/**
 * Normalizes a raw autocomplete store snapshot.
 *
 * @param raw - Stored category-to-values map.
 * @returns Sanitized map with string arrays only.
 */
function normalizeStore(raw: unknown): AutocompleteStore {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }

  const result: AutocompleteStore = {};
  for (const [category, values] of Object.entries(raw)) {
    if (typeof category !== 'string' || category.length === 0 || !Array.isArray(values)) {
      continue;
    }
    const normalized = values.filter((item): item is string => typeof item === 'string');
    if (normalized.length > 0) {
      result[category] = normalized;
    }
  }
  return result;
}

/**
 * Returns persisted autocomplete values for a category.
 *
 * @param category - Autocomplete pool id (e.g. `header.key`, `url`).
 * @returns Known values for the category, or an empty array when unset.
 */
export function getAutocompleteValues(category: string): string[] {
  const stored = getStore().get(STORE_KEY, {});
  const normalized = normalizeStore(stored);
  return normalized[category] ?? [];
}

/**
 * Persists a new autocomplete value for a category when not already present.
 *
 * Trims the value, ignores empty strings, de-duplicates case-insensitively, prepends
 * the most recent entry, and caps the list at {@link AUTOCOMPLETE_MAX_ENTRIES}.
 *
 * @param category - Autocomplete pool id.
 * @param value - User-committed value to remember.
 */
export function addAutocompleteValue(category: string, value: string): void {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }

  const stored = getStore().get(STORE_KEY, {});
  const normalized = normalizeStore(stored);
  const existing = normalized[category] ?? [];
  const lower = trimmed.toLowerCase();
  const withoutDuplicate = existing.filter((item) => item.toLowerCase() !== lower);
  const next = [trimmed, ...withoutDuplicate].slice(0, AUTOCOMPLETE_MAX_ENTRIES);

  getStore().set(STORE_KEY, {
    ...normalized,
    [category]: next
  });
}

/**
 * Clears the lazy store singleton so tests can reinitialize with a fresh mock.
 */
export function resetAutocompleteSettingsStoreForTesting(): void {
  store = null;
}
