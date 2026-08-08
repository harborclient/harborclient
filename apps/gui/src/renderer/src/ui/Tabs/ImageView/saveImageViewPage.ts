import toast from 'react-hot-toast';
import type { PageRef } from '#/renderer/src/store/tabs';

/**
 * Saves an image-view page to a user-chosen file via the native save dialog.
 *
 * @param page - Image-view page tab identity.
 * @returns Whether the user completed the save dialog without canceling.
 */
export async function saveImageViewPage(
  page: Extract<PageRef, { type: 'image-view' }>
): Promise<{ canceled: boolean }> {
  try {
    let result: { canceled: boolean; path?: string };
    if (page.source.kind === 'path') {
      result = await window.api.copyFileToSaveDialog(page.source.path, page.fileName);
    } else if (page.source.kind === 'url') {
      result = await window.api.saveDataUrlToFile({
        url: page.source.url,
        defaultFileName: page.fileName
      });
    } else {
      result = await window.api.saveDataUrlToFile({
        dataUrl: page.source.dataUrl,
        defaultFileName: page.fileName
      });
    }

    if (!result.canceled) {
      toast.success('Image saved');
    }

    return { canceled: result.canceled };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(message);
    throw err;
  }
}
