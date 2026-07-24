/** Default markdown seeded into empty request comments when opening the Comment tab. */
export const DEFAULT_REQUEST_COMMENT = 'Notes for this request';

/**
 * Returns whether the comment contains user-authored content beyond the seeded default.
 *
 * @param comment - Current comment markdown from the request draft.
 */
export function hasUserCommentContent(comment: string): boolean {
  const trimmed = comment.trim();
  return trimmed.length > 0 && trimmed !== DEFAULT_REQUEST_COMMENT;
}
