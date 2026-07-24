import { describe, expect, it, vi } from 'vitest';
import { setShowRequestEditor } from '#/renderer/src/store/slices/navigationSlice';
import { focusRequestUrl } from './focusRequestUrl';

describe('focusRequestUrl', () => {
  it('dispatches navigation actions to reveal the request URL field', () => {
    const dispatch = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal('document', {
      getElementById: vi.fn()
    });

    focusRequestUrl(dispatch);

    expect(dispatch).toHaveBeenCalledWith(setShowRequestEditor(true));

    vi.unstubAllGlobals();
  });
});
