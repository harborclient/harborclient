import { describe, expect, it } from 'vitest';
import requestBodySelectionsReducer, {
  setRequestBodySelection,
  type RequestBodySelectionsState
} from './requestBodySelectionsSlice';

describe('requestBodySelectionsSlice', () => {
  it('stores a raw-body selection snapshot keyed by reference token', () => {
    const initialState: RequestBodySelectionsState = { selectionSnapshots: {} };
    const token = '@body#10.42';
    const snapshot = {
      label: 'Raw multipart body',
      selectedText: 'selected raw body',
      startOffset: 10,
      endOffset: 42,
      startLine: 2,
      endLine: 3
    };

    const next = requestBodySelectionsReducer(
      initialState,
      setRequestBodySelection({ token, snapshot })
    );

    expect(next.selectionSnapshots[token]).toEqual(snapshot);
  });
});
