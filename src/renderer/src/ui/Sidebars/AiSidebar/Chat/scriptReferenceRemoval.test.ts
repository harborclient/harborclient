import { Text } from '@codemirror/state';
import { describe, expect, it } from 'vitest';
import { getScriptReferenceRemovalRange } from './scriptReferenceRemoval';

/**
 * Wraps plain text in a CodeMirror {@link Text} document for removal-range tests.
 *
 * @param content - Document string.
 */
function doc(content: string): Text {
  return Text.of([content]);
}

describe('getScriptReferenceRemovalRange', () => {
  it('deletes only the reference when no separator follows', () => {
    const reference = '@3.post.2';
    const content = `hello ${reference}world`;
    const from = content.indexOf(reference);
    const to = from + reference.length;

    expect(getScriptReferenceRemovalRange(doc(content), from, to)).toEqual({ from, to });
  });

  it('also deletes one trailing space when present', () => {
    const reference = '@3.post.2';
    const content = `${reference} `;
    const from = 0;
    const to = reference.length;

    expect(getScriptReferenceRemovalRange(doc(content), from, to)).toEqual({
      from: 0,
      to: reference.length + 1
    });
  });

  it('also deletes one trailing newline when present', () => {
    const reference = '@3.post.2';
    const content = `${reference}\n`;
    const from = 0;
    const to = reference.length;

    expect(getScriptReferenceRemovalRange(doc(content), from, to)).toEqual({
      from: 0,
      to: reference.length + 1
    });
  });

  it('does not extend past the reference when the next character is non-whitespace', () => {
    const reference = '@3.post.2';
    const content = `${reference}x`;
    const from = 0;
    const to = reference.length;

    expect(getScriptReferenceRemovalRange(doc(content), from, to)).toEqual({ from, to });
  });
});
