import type { OpenImageViewPayload } from '@harborclient/sdk';
import { store } from '#/renderer/src/store/redux';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { registerCommand } from './createPluginContext';
import { pageRefFromOpenImageViewPayload } from '#/renderer/src/ui/Tabs/ImageView/imageViewHelpers';

const HOST_PLUGIN_ID = 'harborclient';

/**
 * Opens or focuses an image viewer page tab from a plugin host payload.
 *
 * @param payload - Image source and optional display filename.
 */
export function openImageView(payload: OpenImageViewPayload): void {
  const page = pageRefFromOpenImageViewPayload(payload);
  store.dispatch(openPageTab(page));
}

/**
 * Registers host commands that let plugins open the image viewer tab.
 *
 * @returns Disposer that unregisters the host image commands.
 */
export function registerHostImageCommands(): () => void {
  const disposables = [
    registerCommand(HOST_PLUGIN_ID, 'openImageView', (payload) => {
      openImageView(payload as OpenImageViewPayload);
    })
  ];

  return () => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  };
}
