import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { newBrowserTab } from '#/renderer/src/store/slices/tabsSlice';
import { openExternalLinkWithConfirm } from '#/renderer/src/ui/Modals/OpenExternalLinkModal/openExternalLinkWithConfirm';

/**
 * Opens a URL detected in the footer PTY terminal.
 *
 * http(s) links open in an in-app Live Page tab. Other schemes (for example
 * mailto) use the shared external-link confirm flow that opens the OS browser.
 *
 * @param dispatch - App dispatch used to open a Live Page or confirm dialog.
 * @param getState - Reads trusted-domain preferences for non-http(s) opens.
 * @param uri - Absolute URI from the xterm web-links addon.
 */
export function openTerminalWebLink(
  dispatch: AppDispatch,
  getState: () => RootState,
  uri: string
): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return;
  }

  if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
    dispatch(newBrowserTab({ url: uri, homeUrl: uri }));
    return;
  }

  void openExternalLinkWithConfirm(dispatch, getState, uri);
}
