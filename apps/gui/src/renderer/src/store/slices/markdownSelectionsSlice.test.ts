import { describe, expect, it } from 'vitest';
import markdownSelectionsReducer, {
  setMarkdownSelection,
  type MarkdownSelectionsState
} from './markdownSelectionsSlice';

describe('markdownSelectionsSlice', () => {
  it('stores a markdown selection snapshot keyed by reference token', () => {
    const initialState: MarkdownSelectionsState = { selectionSnapshots: {} };
    const token = '@markdown.44444444-4444-4444-4444-444444444444#10.42';
    const snapshot = {
      label: 'Document: README.md',
      selectedText: 'selected markdown',
      startOffset: 10,
      endOffset: 42,
      startLine: 2,
      endLine: 3
    };

    const next = markdownSelectionsReducer(initialState, setMarkdownSelection({ token, snapshot }));

    expect(next.selectionSnapshots[token]).toEqual(snapshot);
  });
});
