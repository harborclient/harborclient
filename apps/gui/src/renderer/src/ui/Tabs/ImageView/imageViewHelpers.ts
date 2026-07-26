import type { OpenImageViewPayload } from '@harborclient/sdk';
import { HARD_MAX_RESPONSE_SIZE_MB } from '@harborclient/http/settings';
import type { PageRef } from '#/renderer/src/store/tabs';

/**
 * Maximum character length for inline image payloads (data URL / base64), aligned
 * with the IPC request-body ceiling.
 */
export const MAX_IMAGE_VIEW_INLINE_CHARS = HARD_MAX_RESPONSE_SIZE_MB * 1024 * 1024;

/**
 * Default maximum length for shortened tab labels (including ellipsis and extension).
 */
export const DEFAULT_IMAGE_TAB_LABEL_MAX = 24;

/**
 * Image source stored on an image-view page tab.
 */
export type ImageViewSource = Extract<PageRef, { type: 'image-view' }>['source'];

/**
 * Returns the last path segment of a filesystem path or URL path.
 *
 * @param value - Absolute path or URL pathname.
 * @returns Basename without trailing separators, or an empty string.
 */
export function basenameFromPath(value: string): string {
  const trimmed = value.trim().replace(/[/\\]+$/, '');
  if (!trimmed) {
    return '';
  }
  const segments = trimmed.split(/[/\\]/);
  return segments[segments.length - 1] ?? '';
}

/**
 * Derives a display filename from an open-image-view payload.
 *
 * Prefers an explicit `fileName`, then path basename, then the last URL path
 * segment, then a generic fallback.
 *
 * @param payload - SDK open-image-view payload.
 * @returns Non-empty display filename.
 */
export function deriveFileName(payload: OpenImageViewPayload): string {
  if ('fileName' in payload && typeof payload.fileName === 'string') {
    const explicit = payload.fileName.trim();
    if (explicit) {
      return explicit;
    }
  }

  if ('path' in payload && typeof payload.path === 'string') {
    const fromPath = basenameFromPath(payload.path);
    if (fromPath) {
      return fromPath;
    }
  }

  if ('url' in payload && typeof payload.url === 'string') {
    try {
      const parsed = new URL(payload.url);
      const fromUrl = basenameFromPath(parsed.pathname);
      if (fromUrl) {
        return decodeURIComponent(fromUrl);
      }
    } catch {
      const fromRaw = basenameFromPath(payload.url.split('?')[0] ?? payload.url);
      if (fromRaw) {
        return fromRaw;
      }
    }
  }

  return 'Image';
}

/**
 * Shortens a filename for the tab bar with a middle ellipsis while preserving
 * the file extension when present.
 *
 * @param fileName - Full display filename.
 * @param maxLength - Maximum label length including the ellipsis character.
 * @returns Shortened label, or the original when already short enough.
 */
export function shortenFileName(
  fileName: string,
  maxLength: number = DEFAULT_IMAGE_TAB_LABEL_MAX
): string {
  const trimmed = fileName.trim();
  if (trimmed.length <= maxLength || maxLength < 5) {
    return trimmed || 'Image';
  }

  const lastDot = trimmed.lastIndexOf('.');
  const hasExtension = lastDot > 0 && lastDot < trimmed.length - 1;
  const extension = hasExtension ? trimmed.slice(lastDot) : '';
  const stem = hasExtension ? trimmed.slice(0, lastDot) : trimmed;
  const ellipsis = '…';
  const budget = maxLength - extension.length - ellipsis.length;

  if (budget < 2) {
    return `${trimmed.slice(0, maxLength - 1)}${ellipsis}`;
  }

  const headLength = Math.ceil(budget / 2);
  const tailLength = Math.floor(budget / 2);
  return `${stem.slice(0, headLength)}${ellipsis}${stem.slice(-tailLength)}${extension}`;
}

/**
 * Builds a stable, non-cryptographic hash string for deduplicating data-URL tabs.
 *
 * @param value - Data URL or other large string to fingerprint.
 * @returns Hex-like fingerprint string.
 */
export function hashForDedupeKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Returns the stable route/tab dedupe key suffix for an image source.
 *
 * @param source - Normalized image source on the page ref.
 * @returns Location string used after `image-view:${kind}:`.
 */
export function imageViewSourceKey(source: ImageViewSource): string {
  switch (source.kind) {
    case 'path':
      return source.path;
    case 'url':
      return source.url;
    case 'data':
      return hashForDedupeKey(source.dataUrl);
  }
}

/**
 * Returns the clipboard / “location” string for an image-view source.
 *
 * @param source - Normalized image source on the page ref.
 * @returns Path, URL, or data URL to copy.
 */
export function imageViewLocation(source: ImageViewSource): string {
  switch (source.kind) {
    case 'path':
      return source.path;
    case 'url':
      return source.url;
    case 'data':
      return source.dataUrl;
  }
}

/**
 * Normalizes a base64 payload into a `data:` URL.
 *
 * @param base64 - Raw or data-URL-prefixed base64 payload.
 * @param contentType - MIME type for the image.
 * @returns Data URL suitable for an `<img src>`.
 */
export function toDataUrl(base64: string, contentType: string): string {
  const mime = contentType.split(';')[0]?.trim() || 'image/*';
  const trimmed = base64.trim();
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }
  return `data:${mime};base64,${trimmed}`;
}

/**
 * Validates and converts an SDK open-image-view payload into a page ref.
 *
 * @param payload - Raw payload from a plugin host call.
 * @returns Page reference ready for `openPageTab`.
 * @throws When the payload is missing, ambiguous, or exceeds size limits.
 */
export function pageRefFromOpenImageViewPayload(
  payload: unknown
): Extract<PageRef, { type: 'image-view' }> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('harborclient.openImageView requires a payload object.');
  }

  const record = payload as Record<string, unknown>;
  const hasPath = typeof record.path === 'string' && record.path.trim().length > 0;
  const hasUrl = typeof record.url === 'string' && record.url.trim().length > 0;
  const hasDataUrl = typeof record.dataUrl === 'string' && record.dataUrl.trim().length > 0;
  const hasBase64 =
    typeof record.base64 === 'string' &&
    record.base64.trim().length > 0 &&
    typeof record.contentType === 'string' &&
    record.contentType.trim().length > 0;

  const sourceCount = [hasPath, hasUrl, hasDataUrl, hasBase64].filter(Boolean).length;
  if (sourceCount !== 1) {
    throw new Error(
      'harborclient.openImageView requires exactly one of path, url, dataUrl, or base64+contentType.'
    );
  }

  let source: ImageViewSource;
  if (hasPath) {
    source = { kind: 'path', path: (record.path as string).trim() };
  } else if (hasUrl) {
    source = { kind: 'url', url: (record.url as string).trim() };
  } else if (hasDataUrl) {
    const dataUrl = (record.dataUrl as string).trim();
    if (dataUrl.length > MAX_IMAGE_VIEW_INLINE_CHARS) {
      throw new Error('harborclient.openImageView dataUrl exceeds the maximum allowed size.');
    }
    source = { kind: 'data', dataUrl };
  } else {
    const base64 = (record.base64 as string).trim();
    const contentType = (record.contentType as string).trim();
    const dataUrl = toDataUrl(base64, contentType);
    if (dataUrl.length > MAX_IMAGE_VIEW_INLINE_CHARS) {
      throw new Error(
        'harborclient.openImageView base64 payload exceeds the maximum allowed size.'
      );
    }
    source = { kind: 'data', dataUrl };
  }

  const typedPayload = payload as OpenImageViewPayload;
  const fileName = deriveFileName(typedPayload);
  return {
    type: 'image-view',
    fileName,
    shortLabel: shortenFileName(fileName),
    source
  };
}
