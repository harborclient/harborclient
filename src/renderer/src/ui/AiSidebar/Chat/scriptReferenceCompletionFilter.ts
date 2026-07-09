import {
  ChangeSet,
  EditorState,
  type Extension,
  type Transaction,
  type TransactionSpec
} from '@codemirror/state';
import {
  findAiScriptReferenceCandidates,
  resolveAiScriptReferenceName,
  type AiScriptReferenceValidationContext,
  type ParsedAiScriptReference
} from '#/shared/ai/scriptReferences';

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
    const beforeDoc = tr.startState.doc.toString();
    const afterDocUncorrected = tr.newDoc.toString();
    const candidates = findAiScriptReferenceCandidates(afterDocUncorrected);

    for (const candidate of candidates) {
      const resolvedName = resolveAiScriptReferenceName(candidate, context);
      if (resolvedName == null) {
        continue;
      }

      const hasSeparator =
        candidate.end < tr.newDoc.length &&
        /\s/.test(tr.newDoc.sliceString(candidate.end, candidate.end + 1));

      if (head > candidate.start && head < candidate.end) {
        // #region agent log
        fetch('http://127.0.0.1:7634/ingest/c3368b90-dc8c-409b-b6ba-5e08697b30c9', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e65097' },
          body: JSON.stringify({
            sessionId: 'e65097',
            location: 'scriptReferenceCompletionFilter.ts:filter',
            message: 'action=caret-inside-reference',
            data: { beforeDoc, afterDocUncorrected, head, candidate, resolvedName },
            timestamp: Date.now(),
            hypothesisId: 'H4'
          })
        }).catch(() => {});
        // #endregion agent log
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
          // #region agent log
          fetch('http://127.0.0.1:7634/ingest/c3368b90-dc8c-409b-b6ba-5e08697b30c9', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e65097' },
            body: JSON.stringify({
              sessionId: 'e65097',
              location: 'scriptReferenceCompletionFilter.ts:filter',
              message: 'action=insert-space-and-caret',
              data: { beforeDoc, afterDocUncorrected, head, candidate, resolvedName },
              timestamp: Date.now(),
              hypothesisId: 'H4'
            })
          }).catch(() => {});
          // #endregion agent log
          return withCaretAfterReference(tr, candidate);
        }
      }
    }

    // #region agent log
    if (afterDocUncorrected !== beforeDoc) {
      fetch('http://127.0.0.1:7634/ingest/c3368b90-dc8c-409b-b6ba-5e08697b30c9', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e65097' },
        body: JSON.stringify({
          sessionId: 'e65097',
          location: 'scriptReferenceCompletionFilter.ts:filter',
          message: 'action=none',
          data: { beforeDoc, afterDocUncorrected, head, candidates },
          timestamp: Date.now(),
          hypothesisId: 'H4'
        })
      }).catch(() => {});
    }
    // #endregion agent log
    return tr;
  });
}
