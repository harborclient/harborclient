import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { patchGeneralSettings } from '#/renderer/src/store/thunks';
import {
  hostnameFromExternalUrl,
  shouldSkipExternalLinkConfirm,
  trustExternalDomain
} from './externalLinkTrust';
import { showOpenExternalLinkConfirm } from './openExternalLinkHelpers';

/**
 * Opens an external URL in the system browser, confirming first when the domain
 * is not already trusted and the user has not allowed every domain.
 *
 * @param dispatch - Redux dispatch for the confirm modal and settings patches.
 * @param getState - Reads trusted-domain preferences from the store.
 * @param url - Absolute URL to open.
 */
export async function openExternalLinkWithConfirm(
  dispatch: AppDispatch,
  getState: () => RootState,
  url: string
): Promise<void> {
  const { allowAllExternalDomains, trustedExternalDomains } = getState().settings.general;

  if (!shouldSkipExternalLinkConfirm(url, allowAllExternalDomains, trustedExternalDomains)) {
    const result = await showOpenExternalLinkConfirm(dispatch, url);
    if (!result.confirmed) {
      return;
    }

    if (result.allowAll) {
      await dispatch(patchGeneralSettings({ allowAllExternalDomains: true }));
    } else if (result.trustDomain) {
      const hostname = hostnameFromExternalUrl(url);
      if (hostname) {
        await dispatch(
          patchGeneralSettings({
            trustedExternalDomains: trustExternalDomain(trustedExternalDomains, hostname)
          })
        );
      }
    }
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}
