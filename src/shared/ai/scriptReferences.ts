/**
 * Regex matching `@<request-id>.<pre|post>.<script-index>` script references in chat text.
 */
export const AI_SCRIPT_REFERENCE_PATTERN = /@(active|\d+)\.(pre|post)\.(\d+)(?!\d)/g;

/**
 * A parsed `@` script reference with character offsets in the source text.
 */
export interface ParsedAiScriptReference {
  /**
   * Saved request id from the reference, or the literal `active`.
   */
  requestId: number | 'active';

  /**
   * Script phase: pre-request or post-request.
   */
  phase: 'pre' | 'post';

  /**
   * 1-based index of the script in the phase array.
   */
  scriptIndex: number;

  /**
   * Start offset of the full `@` token in the source text.
   */
  start: number;

  /**
   * End offset (exclusive) of the full `@` token in the source text.
   */
  end: number;

  /**
   * Exact matched substring, including the leading `@`.
   */
  text: string;
}

/**
 * Active request tab state used to decide whether an `@` reference is highlightable.
 */
export interface AiScriptReferenceValidationContext {
  /**
   * Whether the active tab hosts a request editor draft.
   */
  hasActiveRequestTab: boolean;

  /**
   * Saved request id on the active draft, when the tab is saved.
   */
  activeRequestId?: number;

  /**
   * Number of pre-request scripts on the active draft.
   */
  preScriptCount: number;

  /**
   * Number of post-request scripts on the active draft.
   */
  postScriptCount: number;
}

/**
 * One render segment for the chat composer backdrop.
 */
export interface ChatComposerTextToken {
  /**
   * Substring from the composer draft.
   */
  text: string;

  /**
   * When true, the segment is a valid `@` script reference and should be highlighted.
   */
  highlight: boolean;
}

/**
 * Returns whether `@` at `index` is at a token boundary (start of text or after whitespace).
 *
 * @param text - Full composer draft.
 * @param index - Index of the `@` character.
 */
function isScriptReferenceBoundary(text: string, index: number): boolean {
  if (index === 0) {
    return true;
  }

  const previous = text[index - 1];
  return previous != null && /\s/.test(previous);
}

/**
 * Parses one regex match into a structured script reference.
 *
 * @param match - RegExp match for {@link AI_SCRIPT_REFERENCE_PATTERN}.
 */
function parseScriptReferenceMatch(match: RegExpMatchArray): ParsedAiScriptReference | null {
  const text = match[0];
  const start = match.index ?? 0;
  const requestIdRaw = match[1];
  const phase = match[2];
  const scriptIndexRaw = match[3];

  if (requestIdRaw == null || phase == null || scriptIndexRaw == null) {
    return null;
  }

  if (phase !== 'pre' && phase !== 'post') {
    return null;
  }

  const scriptIndex = Number(scriptIndexRaw);
  if (!Number.isInteger(scriptIndex) || scriptIndex < 1) {
    return null;
  }

  const requestId =
    requestIdRaw === 'active'
      ? 'active'
      : Number.isFinite(Number(requestIdRaw))
        ? Number(requestIdRaw)
        : null;

  if (requestId == null) {
    return null;
  }

  return {
    requestId,
    phase,
    scriptIndex,
    start,
    end: start + text.length,
    text
  };
}

/**
 * Finds syntactically valid `@` script reference candidates in plain text.
 *
 * @param text - Composer draft that may contain `@` references.
 */
export function findAiScriptReferenceCandidates(text: string): ParsedAiScriptReference[] {
  const matches: ParsedAiScriptReference[] = [];
  const pattern = new RegExp(AI_SCRIPT_REFERENCE_PATTERN.source, 'g');

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (!isScriptReferenceBoundary(text, start)) {
      continue;
    }

    const parsed = parseScriptReferenceMatch(match);
    if (parsed) {
      matches.push(parsed);
    }
  }

  return matches;
}

/**
 * Returns whether a parsed `@` reference resolves against the active request tab.
 *
 * Mirrors `update_request_script` validation in the AI tool executor.
 *
 * @param reference - Parsed `@` script reference.
 * @param context - Active tab script counts and request id.
 */
export function isValidAiScriptReference(
  reference: ParsedAiScriptReference,
  context: AiScriptReferenceValidationContext
): boolean {
  if (!context.hasActiveRequestTab) {
    return false;
  }

  if (reference.requestId !== 'active' && reference.requestId !== context.activeRequestId) {
    return false;
  }

  const scriptCount = reference.phase === 'pre' ? context.preScriptCount : context.postScriptCount;

  return reference.scriptIndex >= 1 && reference.scriptIndex <= scriptCount;
}

/**
 * Splits composer text into plain and highlightable `@` script reference segments.
 *
 * @param text - Composer draft.
 * @param context - Active tab state for semantic validation.
 */
export function tokenizeChatComposerText(
  text: string,
  context: AiScriptReferenceValidationContext
): ChatComposerTextToken[] {
  const candidates = findAiScriptReferenceCandidates(text);
  const tokens: ChatComposerTextToken[] = [];
  let lastIndex = 0;

  for (const candidate of candidates) {
    if (candidate.start < lastIndex) {
      continue;
    }

    const highlight = isValidAiScriptReference(candidate, context);

    if (candidate.start > lastIndex) {
      tokens.push({ text: text.slice(lastIndex, candidate.start), highlight: false });
    }

    tokens.push({ text: candidate.text, highlight });
    lastIndex = candidate.end;
  }

  if (lastIndex < text.length) {
    tokens.push({ text: text.slice(lastIndex), highlight: false });
  }

  return tokens;
}
