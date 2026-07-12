import { EditorState } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import type { AiScriptReferenceValidationContext } from '#/shared/ai/scriptReferences';
import type { ScriptRef } from '#/shared/types';
import { createScriptReferenceCompletionFilter } from './scriptReferenceCompletionFilter';

const REQUEST_ID = 5_000_000_692;

/**
 * Builds a minimal inline script row for completion-filter tests.
 *
 * @param overrides - Partial script fields to override.
 */
function inlineScript(overrides: Partial<ScriptRef> = {}): ScriptRef {
  return {
    id: 'script-1',
    enabled: true,
    kind: 'inline',
    ...overrides
  };
}

/**
 * Builds a validation context with one resolvable pre-request script row.
 */
function validationContext(): AiScriptReferenceValidationContext {
  return {
    hasActiveRequestTab: true,
    activeRequestId: REQUEST_ID,
    preScriptCount: 2,
    postScriptCount: 1,
    preScripts: [
      inlineScript({ id: 'pre-1', name: 'First script' }),
      inlineScript({ id: 'pre-2', name: 'Second script' })
    ],
    postScripts: [inlineScript({ id: 'post-1', name: 'Post script' })]
  };
}

/**
 * Creates an editor state wired with script-reference completion filtering.
 *
 * @param doc - Initial composer document text.
 */
function createCompletionState(doc = ''): EditorState {
  const context = validationContext();
  return EditorState.create({
    doc,
    extensions: [createScriptReferenceCompletionFilter(() => context)]
  });
}

describe('createScriptReferenceCompletionFilter', () => {
  it('inserts a trailing space when completing a valid reference in one transaction', () => {
    const prefix = `asdf @${REQUEST_ID}.pre.`;
    const state = createCompletionState(prefix);
    const insertPos = prefix.length;

    const nextState = state.update({
      changes: { from: insertPos, insert: '2' },
      selection: { anchor: insertPos + 1, head: insertPos + 1 }
    }).state;

    expect(nextState.doc.toString()).toBe(`asdf @${REQUEST_ID}.pre.2 `);
    expect(nextState.selection.main.head).toBe(`asdf @${REQUEST_ID}.pre.2 `.length);
  });

  it('does not insert an extra space when a separator already follows the reference', () => {
    const prefix = `asdf @${REQUEST_ID}.pre. `;
    const state = createCompletionState(prefix);
    const insertPos = prefix.length - 1;

    const nextState = state.update({
      changes: { from: insertPos, insert: '2' },
      selection: { anchor: insertPos + 1, head: insertPos + 1 }
    }).state;

    expect(nextState.doc.toString()).toBe(`asdf @${REQUEST_ID}.pre.2 `);
    expect(nextState.selection.main.head).toBe(`asdf @${REQUEST_ID}.pre.2`.length);
  });

  it('does not adjust text for unresolved script references', () => {
    const prefix = `asdf @${REQUEST_ID}.pre.`;
    const state = createCompletionState(prefix);
    const insertPos = prefix.length;

    const nextState = state.update({
      changes: { from: insertPos, insert: '9' },
      selection: { anchor: insertPos + 1, head: insertPos + 1 }
    }).state;

    expect(nextState.doc.toString()).toBe(`asdf @${REQUEST_ID}.pre.9`);
    expect(nextState.selection.main.head).toBe(`asdf @${REQUEST_ID}.pre.9`.length);
  });
});
