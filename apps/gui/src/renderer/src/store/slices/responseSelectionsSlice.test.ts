import { describe, expect, it } from 'vitest';
import responseSelectionsReducer, {
  setResponseSelection,
  type ResponseSelectionsState
} from './responseSelectionsSlice';

describe('responseSelectionsSlice', () => {
  it('stores a response-section snapshot keyed by reference token', () => {
    const initialState: ResponseSelectionsState = { selectionSnapshots: {} };
    const token = '@res.aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.body';
    const snapshot = {
      label: 'Response body',
      requestName: 'Echo',
      section: 'body' as const,
      status: 200,
      statusText: 'OK',
      content: '{"ok":true}'
    };

    const next = responseSelectionsReducer(initialState, setResponseSelection({ token, snapshot }));

    expect(next.selectionSnapshots[token]).toEqual(snapshot);
  });
});
