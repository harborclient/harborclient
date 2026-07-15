import { describe, expect, it } from 'vitest';
import scriptClipboardReducer, {
  setCopiedScript,
  type ScriptClipboardState
} from './scriptClipboardSlice';

describe('scriptClipboardSlice', () => {
  it('stores an inline clipboard payload', () => {
    const initialState: ScriptClipboardState = { copied: null };
    const copied = {
      kind: 'inline' as const,
      code: 'console.log("test");',
      name: 'Auth helper',
      enabled: false,
      stage: 'main' as const
    };

    const next = scriptClipboardReducer(initialState, setCopiedScript(copied));

    expect(next.copied).toEqual(copied);
  });

  it('stores a snippet clipboard payload', () => {
    const initialState: ScriptClipboardState = { copied: null };
    const copied = {
      kind: 'snippet' as const,
      snippetUuid: 'snippet-uuid'
    };

    const next = scriptClipboardReducer(initialState, setCopiedScript(copied));

    expect(next.copied).toEqual(copied);
  });
});
