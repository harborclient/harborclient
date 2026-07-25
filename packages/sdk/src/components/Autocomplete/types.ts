/**
 * Async provider for autocomplete suggestions.
 *
 * {@link list} returns known values; {@link add} persists a new value when the user
 * commits text that is not already in the list.
 */
export interface AutocompleteSource {
  /**
   * Returns all known autocomplete values.
   */
  list(): Promise<string[]>;

  /**
   * Persists a new autocomplete value for future {@link list} calls.
   *
   * @param value - Trimmed value committed by the user.
   */
  add(value: string): Promise<void>;
}
