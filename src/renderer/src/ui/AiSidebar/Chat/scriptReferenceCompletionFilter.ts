import {
  ChangeSet,
  EditorState,
  type Extension,
  type Transaction,
  type TransactionSpec
} from '@codemirror/state';
import {
  AI_SCRIPT_REFERENCE_PATTERN,
  findAiScriptReferenceCandidates,
  resolveAiScriptReferenceName,
  type AiScriptReferenceValidationContext,
  type ParsedAiScriptReference
} from '#/shared/ai/scriptReferences';

const ANCHORED_REFERENCE_PATTERN = new RegExp(`^${AI_SCRIPT_REFERENCE_PATTERN.source}`);

/**
 * Parses a script reference match anchored at the start of `text`, ignoring the leading
 * word-boundary requirement so a caret-adjacent reference can be detected and repaired.
 *
 * @param text - Document substring starting at the candidate `@` token.
 */
function parseAnchoredReference(text: string): ParsedAiScriptReference | null {
  const match = ANCHORED_REFERENCE_PATTERN.exec(text);
  if (match == null) {
    return null;
  }

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

  return { requestId, phase, scriptIndex, start: 0, end: match[0].length, text: match[0] };
}

/**
 * Extends a transaction so the caret sits after a completed script reference badge,
 * inserting a trailing space when needed so typing cannot extend the hidden `@` token.
 *
 * @param tr - Transaction that just completed or landed inside a script reference.
 * @param candidate - Parsed `@` script reference in {@link Transaction.newDoc}.
 * @returns Replacement transaction spec merged into the same dispatch.
 */
function withCaretAfterReference(
  tr: Transaction,
  candidate: ParsedAiScriptReference
): TransactionSpec | readonly TransactionSpec[] {
  const doc = tr.newDoc;
  const hasSeparator =
    candidate.end < doc.length && /\s/.test(doc.sliceString(candidate.end, candidate.end + 1));

  if (hasSeparator) {
    return {
      changes: tr.changes,
      selection: { anchor: candidate.end, head: candidate.end }
    };
  }

  const insertSpace = ChangeSet.of([{ from: candidate.end, insert: ' ' }], tr.newDoc.length);

  return {
    changes: tr.changes.compose(insertSpace),
    selection: { anchor: candidate.end + 1, head: candidate.end + 1 }
  };
}

/**
 * Folds script-reference caret correction into the same transaction as the user's edit.
 *
 * Avoids a second `view.dispatch()` from an update listener, which races with
 * `@uiw/react-codemirror`'s controlled-value sync and can revert badge text.
 *
 * @param context - Active tab state for semantic validation.
 */
export function createScriptReferenceCompletionFilter(
  context: AiScriptReferenceValidationContext
): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) {
      return tr;
    }

    const head = tr.newSelection.main.head;
    const afterDocUncorrected = tr.newDoc.toString();
    const candidates = findAiScriptReferenceCandidates(afterDocUncorrected);

    // Deletions must never have boundary characters re-inserted: the repair logic below exists
    // to fix separators eroded by typing into/against a reference, not to resist removing them.
    // Letting deletes through unmodified allows backspace to progress into the atomic reference
    // itself (CodeMirror's atomic-range handling in @codemirror/commands then removes it whole).
    if (tr.isUserEvent('delete')) {
      return tr;
    }

    for (const candidate of candidates) {
      const resolvedName = resolveAiScriptReferenceName(candidate, context);
      if (resolvedName == null) {
        continue;
      }

      const hasSeparator =
        candidate.end < tr.newDoc.length &&
        /\s/.test(tr.newDoc.sliceString(candidate.end, candidate.end + 1));

      if (head > candidate.start && head < candidate.end) {
        return withCaretAfterReference(tr, candidate);
      }

      if (!hasSeparator) {
        let editTouchesReferenceEnd = false;
        tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
          if (fromB <= candidate.end && toB >= candidate.end) {
            editTouchesReferenceEnd = true;
          }
        });

        if (editTouchesReferenceEnd) {
          return withCaretAfterReference(tr, candidate);
        }
      }
    }

    const hasLeadingBoundary = head === 0 || /\s/.test(tr.newDoc.sliceString(head - 1, head));
    if (!hasLeadingBoundary) {
      const anchored = parseAnchoredReference(tr.newDoc.sliceString(head));
      if (anchored != null) {
        const shifted: ParsedAiScriptReference = {
          ...anchored,
          start: head,
          end: head + anchored.end
        };
        const resolvedName = resolveAiScriptReferenceName(shifted, context);
        if (resolvedName != null) {
          const insertSpace = ChangeSet.of([{ from: head, insert: ' ' }], tr.newDoc.length);
          return {
            changes: tr.changes.compose(insertSpace),
            selection: { anchor: head, head }
          };
        }
      }
    }

    return tr;
  });
}
