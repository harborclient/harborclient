/**
 * Result of building a multipart request body.
 */
export type BuildMultipartResult = { formData: FormData } | { error: string };

/**
 * Result of expanding a raw multipart body with optional file tokens.
 */
export type ExpandMultipartRawResult =
  | { body: Uint8Array; contentType: string }
  | { error: string };

/**
 * Request body encoding for multipart, urlencoded, and preview summaries.
 */
export interface IBody {
  /**
   * Builds a human-readable summary of multipart form parts for request preview.
   *
   * @param body - Serialized multipart form parts JSON.
   */
  summarizeFormParts(body: string): string;

  /**
   * Builds a FormData body from serialized multipart form parts.
   *
   * @param body - Serialized multipart form parts JSON.
   */
  buildMultipart(body: string): Promise<BuildMultipartResult>;

  /**
   * Expands a verbatim multipart raw body, replacing `<<file:/path>>` tokens with file bytes.
   *
   * Malformed multipart structure is preserved as typed. Only unreadable files produce an error.
   *
   * @param raw - Verbatim multipart body text from the Raw editor.
   */
  expandMultipartRaw(raw: string): Promise<ExpandMultipartRawResult>;

  /**
   * Builds an application/x-www-form-urlencoded body from serialized key-value rows.
   *
   * @param body - JSON array stored in the request body field.
   */
  buildUrlEncoded(body: string): string;
}
