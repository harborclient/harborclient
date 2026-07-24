import { parseVariableTokens } from '@harborclient/sdk/variables';

/** CSS Custom Highlight registry name for {{variable}} tokens in rich text. */
export const VARIABLE_HIGHLIGHT_NAME = 'hc-variable-token';

/**
 * A {{variable}} token located in plain text with character offsets.
 */
export interface VariableTextMatch {
  key: string;
  start: number;
  end: number;
}

/**
 * A {{variable}} token mapped to a live DOM range for highlighting and hit-testing.
 */
export interface VariableHighlightMatch {
  key: string;
  range: Range;
}

/**
 * Finds variable placeholder keys and offsets in a plain string.
 *
 * @param text - Source text that may contain {{variable}} tokens.
 * @returns Ordered matches with keys and character offsets.
 */
export function findVariableKeysInText(text: string): VariableTextMatch[] {
  return parseVariableTokens(text).map((token) => ({
    key: token.key,
    start: token.start,
    end: token.end
  }));
}

/**
 * Walks text nodes under a root element and builds DOM ranges for each {{variable}} token.
 *
 * @param root - Root element containing editable text nodes.
 * @returns Highlight matches with live ranges.
 */
export function collectVariableHighlightMatches(root: Node): VariableHighlightMatch[] {
  const matches: VariableHighlightMatch[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

  let textNode = walker.nextNode();
  while (textNode) {
    const text = textNode.textContent ?? '';

    for (const token of parseVariableTokens(text)) {
      const range = document.createRange();
      range.setStart(textNode, token.start);
      range.setEnd(textNode, token.end);
      matches.push({ key: token.key, range });
    }

    textNode = walker.nextNode();
  }

  return matches;
}

/**
 * Applies CSS Custom Highlight ranges for {{variable}} tokens under the given root.
 *
 * @param root - Contenteditable root element, or null when unavailable.
 * @returns Matches used for hover hit-testing.
 */
export function applyVariableHighlights(root: HTMLElement | null): VariableHighlightMatch[] {
  if (!root) {
    return [];
  }

  const matches = collectVariableHighlightMatches(root);

  if (typeof CSS === 'undefined' || !('highlights' in CSS)) {
    return matches;
  }

  if (matches.length === 0) {
    CSS.highlights.delete(VARIABLE_HIGHLIGHT_NAME);
    return matches;
  }

  CSS.highlights.set(
    VARIABLE_HIGHLIGHT_NAME,
    new Highlight(...matches.map((entry) => entry.range))
  );

  return matches;
}

/**
 * Returns the variable highlight match under a viewport point, if any.
 *
 * @param matches - Active highlight matches from {@link applyVariableHighlights}.
 * @param clientX - Pointer X coordinate in viewport pixels.
 * @param clientY - Pointer Y coordinate in viewport pixels.
 * @returns Matching token, or null when the pointer is outside all tokens.
 */
export function findVariableHighlightAtPoint(
  matches: VariableHighlightMatch[],
  clientX: number,
  clientY: number
): VariableHighlightMatch | null {
  for (const match of matches) {
    for (const rect of match.range.getClientRects()) {
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return match;
      }
    }
  }

  return null;
}
