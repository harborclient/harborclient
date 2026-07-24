/** localStorage key for Getting Started task-list checkbox state. */
export const GETTING_STARTED_CHECKED_STORAGE_KEY = 'harborclient:gettingStartedChecked';

/**
 * Builds a stable storage key for one task-list checkbox in a getting-started doc.
 *
 * @param docPath - Relative markdown path, e.g. `index.md`.
 * @param index - Zero-based occurrence index of the checkbox within that document.
 * @returns Stable key used in localStorage.
 */
export function checkedItemKey(docPath: string, index: number): string {
  return `${docPath}#${index}`;
}

/**
 * Reads persisted checked task-list keys from localStorage.
 *
 * @returns Parsed keys from localStorage, or an empty set when unset or invalid.
 */
export function readCheckedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(GETTING_STARTED_CHECKED_STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed.filter((entry): entry is string => typeof entry === 'string'));
  } catch {
    return new Set();
  }
}

/**
 * Persists one task-list checkbox as checked or unchecked.
 *
 * @param itemKey - Stable key from {@link checkedItemKey}.
 * @param checked - Whether the checkbox should be stored as checked.
 */
export function setChecked(itemKey: string, checked: boolean): void {
  const keys = readCheckedKeys();
  if (checked) {
    keys.add(itemKey);
  } else {
    keys.delete(itemKey);
  }
  localStorage.setItem(GETTING_STARTED_CHECKED_STORAGE_KEY, JSON.stringify([...keys]));
}
