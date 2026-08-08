/**
 * Classification of an image `srcURL` from a guest context-menu event.
 */
export type BrowserGuestImageSrcKind = 'http' | 'data' | 'blob' | 'unsupported';

/**
 * Returns the last path segment of a URL pathname or filesystem-like path.
 *
 * @param value - Absolute path or URL pathname.
 * @returns Basename without trailing separators, or an empty string.
 */
function basenameFromPath(value: string): string {
  const trimmed = value.trim().replace(/[/\\]+$/, '');
  if (!trimmed) {
    return '';
  }
  const segments = trimmed.split(/[/\\]/);
  return segments[segments.length - 1] ?? '';
}

/**
 * Classifies a guest image `srcURL` for open/save handling.
 *
 * @param srcURL - Image source from Electron `ContextMenuParams.srcURL`.
 * @returns Kind used to choose resolution and IPC payload shape.
 */
export function classifyBrowserGuestImageSrc(srcURL: string): BrowserGuestImageSrcKind {
  const trimmed = srcURL.trim();
  if (!trimmed) {
    return 'unsupported';
  }

  if (trimmed.toLowerCase().startsWith('data:')) {
    return 'data';
  }

  if (trimmed.toLowerCase().startsWith('blob:')) {
    return 'blob';
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return 'http';
    }
  } catch {
    return 'unsupported';
  }

  return 'unsupported';
}

/**
 * Derives a display/save filename from a guest image `srcURL`.
 *
 * Prefers the last URL path segment when present; falls back to `image.png`.
 * Data URLs and blob URLs have no useful path, so they use the fallback.
 *
 * @param srcURL - Image source from Electron `ContextMenuParams.srcURL`.
 * @returns Non-empty filename suitable for save dialogs and image-view tabs.
 */
export function deriveImageFileNameFromSrcUrl(srcURL: string): string {
  const trimmed = srcURL.trim();
  if (!trimmed) {
    return 'image.png';
  }

  const kind = classifyBrowserGuestImageSrc(trimmed);
  if (kind === 'data' || kind === 'blob') {
    return 'image.png';
  }

  if (kind === 'http') {
    try {
      const parsed = new URL(trimmed);
      const fromUrl = basenameFromPath(parsed.pathname);
      if (fromUrl) {
        return decodeURIComponent(fromUrl);
      }
    } catch {
      // Fall through to generic fallback.
    }
  }

  return 'image.png';
}

/**
 * Returns whether a guest context-menu event targets an image with a usable `srcURL`.
 *
 * @param mediaType - Electron `ContextMenuParams.mediaType`.
 * @param srcURL - Electron `ContextMenuParams.srcURL`.
 * @returns True when Open image in tab / Save image items should appear.
 */
export function isBrowserGuestImageContext(mediaType: string, srcURL: string): boolean {
  return mediaType === 'image' && srcURL.trim().length > 0;
}

/**
 * Builds guest JavaScript that fetches a `blob:` URL and returns a data URL string.
 *
 * The script is evaluated with `webContents.executeJavaScript`. The `srcURL` is
 * JSON-stringified so it is safe to embed in the expression.
 *
 * @param srcURL - Blob URL that exists only in the guest document.
 * @returns JavaScript source that resolves to a `data:` URL string.
 */
export function buildBlobSrcToDataUrlScript(srcURL: string): string {
  const encoded = JSON.stringify(srcURL.trim());
  return `(async () => {
  const res = await fetch(${encoded});
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
})()`;
}
