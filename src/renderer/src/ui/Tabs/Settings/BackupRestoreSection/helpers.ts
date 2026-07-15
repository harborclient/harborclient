/**
 * Reads every key/value pair from renderer localStorage for backup export.
 *
 * @returns Snapshot of all localStorage entries.
 */
export function collectLocalStorageSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {};

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === null) continue;
    const value = localStorage.getItem(key);
    if (value !== null) {
      snapshot[key] = value;
    }
  }

  return snapshot;
}

/**
 * Replaces renderer localStorage with values from a restored backup snapshot.
 *
 * @param snapshot - Key/value pairs to write before relaunching the app.
 */
export function applyLocalStorageSnapshot(snapshot: Record<string, string>): void {
  localStorage.clear();
  for (const [key, value] of Object.entries(snapshot)) {
    localStorage.setItem(key, value);
  }
}
