/**
 * Maximum number of bytes sampled when detecting binary content.
 */
const BINARY_SAMPLE_BYTES = 8192;

/**
 * Returns whether a byte buffer should be treated as binary for diff output.
 *
 * @param bytes - File contents from HEAD, the index, or the working tree.
 */
export function isBinaryContent(bytes: Uint8Array): boolean {
  const sample = bytes.slice(0, BINARY_SAMPLE_BYTES);
  return sample.includes(0);
}

/**
 * Decodes blob bytes as UTF-8 text when the content is textual.
 *
 * @param bytes - Raw blob bytes, or null when the blob is absent at the commit.
 * @returns Decoded text, null when binary or invalid UTF-8, or undefined when absent.
 */
export function decodeBlobText(bytes: Uint8Array | null): string | null | undefined {
  if (bytes == null) {
    return undefined;
  }
  if (bytes.length === 0) {
    return '';
  }
  if (isBinaryContent(bytes)) {
    return null;
  }
  try {
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Decodes file bytes as UTF-8 text when not binary, treating absent blobs as empty.
 *
 * @param bytes - Raw file bytes, or null when the file is absent.
 * @returns Decoded text, empty string when absent or empty, or null when binary or invalid UTF-8.
 */
export function decodeTextContent(bytes: Uint8Array | null): string | null {
  const decoded = decodeBlobText(bytes);
  if (decoded === undefined) {
    return '';
  }
  return decoded;
}
