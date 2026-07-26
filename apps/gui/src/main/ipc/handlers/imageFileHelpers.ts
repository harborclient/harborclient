import { basename, extname } from 'path';

/**
 * Extension → MIME map for common image formats.
 */
const EXTENSION_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif'
};

/**
 * Detects an image MIME type from file magic bytes.
 *
 * @param buffer - File contents.
 * @returns MIME type when recognized, otherwise null.
 */
export function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 8) {
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x39 || buffer[4] === 0x37) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) {
    return 'image/bmp';
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x00 &&
    buffer[1] === 0x00 &&
    buffer[2] === 0x01 &&
    buffer[3] === 0x00
  ) {
    return 'image/x-icon';
  }

  const head = buffer.subarray(0, Math.min(buffer.length, 256)).toString('utf8').trimStart();
  if (head.startsWith('<svg') || head.startsWith('<?xml')) {
    if (head.includes('<svg')) {
      return 'image/svg+xml';
    }
  }

  return null;
}

/**
 * Resolves an image MIME type from magic bytes, falling back to the file extension.
 *
 * @param buffer - File contents.
 * @param filePath - Absolute path used for extension fallback.
 * @returns Image MIME type.
 * @throws When the file does not look like a supported image.
 */
export function resolveImageMime(buffer: Buffer, filePath: string): string {
  const sniffed = sniffImageMime(buffer);
  if (sniffed) {
    return sniffed;
  }

  const extension = extname(filePath).toLowerCase();
  const fromExtension = EXTENSION_MIME[extension];
  if (fromExtension) {
    return fromExtension;
  }

  throw new Error(`File is not a recognized image: ${basename(filePath)}`);
}

/**
 * Parses a data URL into binary bytes and MIME type.
 *
 * @param dataUrl - Full `data:` URL.
 * @returns Decoded buffer and MIME type.
 * @throws When the data URL is invalid.
 */
export function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string } {
  const trimmed = dataUrl.trim();
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/i.exec(trimmed);
  if (!match) {
    throw new Error('Invalid data URL.');
  }

  const mime = (match[1] ?? 'application/octet-stream').trim() || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? '';
  const buffer = isBase64
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'utf8');

  return { buffer, mime };
}

/**
 * Returns suggested save-dialog filters for an image filename.
 *
 * @param fileName - Suggested filename including extension.
 */
export function imageSaveFilters(fileName: string): Array<{ name: string; extensions: string[] }> {
  const extension = extname(fileName).replace(/^\./, '').toLowerCase();
  if (extension) {
    return [
      { name: 'Image', extensions: [extension] },
      { name: 'All Files', extensions: ['*'] }
    ];
  }
  return [{ name: 'All Files', extensions: ['*'] }];
}
