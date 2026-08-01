import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { newBrowserTab } from '#/renderer/src/store/slices/tabsSlice';
import { openTerminalWebLink } from './openTerminalWebLink';

vi.mock('#/renderer/src/ui/Modals/OpenExternalLinkModal/openExternalLinkWithConfirm', () => ({
  openExternalLinkWithConfirm: vi.fn()
}));

import { openExternalLinkWithConfirm } from '#/renderer/src/ui/Modals/OpenExternalLinkModal/openExternalLinkWithConfirm';

/**
 * Builds a stub getState used only for the external-link confirm path.
 *
 * @returns Minimal RootState getter.
 */
function stubGetState(): () => RootState {
  return () => ({}) as RootState;
}

describe('openTerminalWebLink', () => {
  const dispatch = vi.fn() as unknown as AppDispatch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens http URLs in a Live Page tab', () => {
    openTerminalWebLink(dispatch, stubGetState(), 'http://example.com/path');

    expect(dispatch).toHaveBeenCalledWith(
      newBrowserTab({ url: 'http://example.com/path', homeUrl: 'http://example.com/path' })
    );
    expect(openExternalLinkWithConfirm).not.toHaveBeenCalled();
  });

  it('opens https URLs in a Live Page tab', () => {
    openTerminalWebLink(dispatch, stubGetState(), 'https://example.com/');

    expect(dispatch).toHaveBeenCalledWith(
      newBrowserTab({ url: 'https://example.com/', homeUrl: 'https://example.com/' })
    );
    expect(openExternalLinkWithConfirm).not.toHaveBeenCalled();
  });

  it('routes non-http schemes through external-link confirm', () => {
    const getState = stubGetState();
    openTerminalWebLink(dispatch, getState, 'mailto:user@example.com');

    expect(dispatch).not.toHaveBeenCalled();
    expect(openExternalLinkWithConfirm).toHaveBeenCalledWith(
      dispatch,
      getState,
      'mailto:user@example.com'
    );
  });

  it('ignores invalid URIs', () => {
    openTerminalWebLink(dispatch, stubGetState(), 'not a url');

    expect(dispatch).not.toHaveBeenCalled();
    expect(openExternalLinkWithConfirm).not.toHaveBeenCalled();
  });
});
