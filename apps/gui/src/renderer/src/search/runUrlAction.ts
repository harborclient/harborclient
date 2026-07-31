import toast from 'react-hot-toast';
import { URL_ACTION_IDS } from '@harborclient/core/search';
import { openImageView } from '#/renderer/src/plugins/hostImageCommands';
import type { AppDispatch } from '#/renderer/src/store/redux';
import { closeActionMenuModal } from '#/renderer/src/store/slices/modalsSlice';
import { newBrowserTab } from '#/renderer/src/store/slices/tabsSlice';
import { importCollectionFromUrl } from '#/renderer/src/store/thunks/collections';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

/**
 * Runs an Action menu URL-paste action for the given absolute http(s) URL.
 *
 * @param dispatch - App dispatch used to close the menu and open tabs / import.
 * @param actionId - One of {@link URL_ACTION_IDS}.
 * @param url - Absolute URL from the Action menu input.
 */
export function runUrlAction(dispatch: AppDispatch, actionId: string, url: string): void {
  dispatch(closeActionMenuModal());

  switch (actionId) {
    case URL_ACTION_IDS.imageOpen:
      openImageView({ url });
      return;
    case URL_ACTION_IDS.importOpen:
      void dispatch(importCollectionFromUrl(url))
        .unwrap()
        .then((collection) => {
          if (collection != null) {
            toast.success('Collection imported');
          }
        })
        .catch((err: unknown) => {
          showAlert(dispatch, formatErrorMessage(err, 'Failed to import from URL'));
        });
      return;
    case URL_ACTION_IDS.livePageOpen:
      dispatch(newBrowserTab({ url, homeUrl: url }));
      return;
    default:
      return;
  }
}
