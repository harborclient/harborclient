/**
 * Returns whether the typed delete confirmation input enables the danger button.
 *
 * @param busy - True while a delete request is in flight.
 * @param value - Current confirmation input value.
 * @param confirmText - Required confirmation word.
 * @returns True when delete can be submitted.
 */
export function isDeleteConfirmationReady(
  busy: boolean,
  value: string,
  confirmText: string
): boolean {
  return !busy && value === confirmText;
}
