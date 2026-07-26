/**
 * One selectable row in a {@link SortMenu} listbox.
 */
export interface SortOption {
  /**
   * Stable id used as the controlled value and option key.
   */
  id: string;

  /**
   * Visible label for the option row.
   */
  label: string;
}
