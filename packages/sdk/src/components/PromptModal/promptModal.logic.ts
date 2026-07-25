/**
 * Returns whether a prompt modal value is non-empty after trimming whitespace.
 *
 * @param value - Draft text from the single-field input.
 * @returns True when the trimmed value has at least one character.
 */
export function defaultCanSubmitPromptValue(value: string): boolean {
  return value.trim().length > 0;
}
