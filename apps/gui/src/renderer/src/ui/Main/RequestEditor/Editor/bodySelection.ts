import type { BodyType } from '@harborclient/core/types';

/**
 * Returns a display label for a request-body Copy to chat selection badge.
 *
 * @param bodyType - Active request body type.
 */
export function requestBodySelectionLabel(bodyType: BodyType): string {
  if (bodyType === 'multipart') {
    return 'Raw multipart body';
  }
  if (bodyType === 'urlencoded') {
    return 'Raw urlencoded body';
  }
  if (bodyType === 'json') {
    return 'JSON body';
  }
  if (bodyType === 'text') {
    return 'Text body';
  }
  return 'Raw body';
}

/**
 * Returns the editor text used for line-number calculation when copying a body selection.
 *
 * JSON and text selections are measured against the main `body` field. Multipart and
 * urlencoded selections use the Raw drawer text (`projectedRaw`).
 *
 * @param bodyType - Active request body type.
 * @param body - Structured / JSON / text body field from the draft.
 * @param projectedRaw - Raw drawer value (override or projection from rows).
 */
export function requestBodySelectionSourceText(
  bodyType: BodyType,
  body: string,
  projectedRaw: string
): string {
  if (bodyType === 'json' || bodyType === 'text') {
    return body;
  }
  return projectedRaw;
}

/**
 * Builds the `@body` reference token for a body text selection.
 *
 * @param startOffset - Start character offset in the body editor text.
 * @param endOffset - End character offset in the body editor text.
 * @returns Compact `@body` reference token for the chat composer.
 */
export function buildRequestBodyReferenceToken(startOffset: number, endOffset: number): string {
  return `@body#${startOffset}.${endOffset}`;
}
