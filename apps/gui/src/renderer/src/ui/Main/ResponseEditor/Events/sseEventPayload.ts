/**
 * Formatted SSE event data payload for display or Diff comparison.
 */
export interface FormattedPayload {
  /**
   * Text shown in the detail payload block.
   */
  text: string;

  /**
   * Whether the payload parsed as JSON and was pretty-printed.
   */
  isJson: boolean;
}

/**
 * Pretty-prints JSON payloads while leaving non-JSON SSE data untouched.
 *
 * @param payload - Event data from the SSE message.
 * @returns Display text and whether JSON formatting was applied.
 */
export function formatEventPayload(payload: string): FormattedPayload {
  const trimmedPayload = payload.trim();

  if (!trimmedPayload) {
    return { text: '(empty)', isJson: false };
  }

  try {
    return { text: JSON.stringify(JSON.parse(trimmedPayload), null, 2), isJson: true };
  } catch {
    return { text: payload, isJson: false };
  }
}
