import type { FormDataPart } from './types/common';
/**
 * Regex matching a path-embedded multipart file token on its own line.
 */
export declare const MULTIPART_FILE_TOKEN_RE: RegExp;
/**
 * Result of tolerantly parsing a raw multipart body into structured parts.
 */
export interface ParseMultipartRawResult {
    /**
     * Best-effort form parts derived from the raw text.
     */
    parts: FormDataPart[];
    /**
     * False when the raw text cannot cleanly map to structured rows (still sendable).
     */
    representable: boolean;
    /**
     * Boundary string detected in the raw text, when present.
     */
    boundary?: string;
}
/**
 * Generates a unique multipart boundary for rendering the Raw body drawer.
 *
 * @returns Boundary string suitable for `multipart/form-data; boundary=…`.
 */
export declare function generateMultipartBoundary(): string;
/**
 * Builds a path-embedded file token for a multipart raw body line.
 *
 * @param filePath - Absolute file path to embed.
 * @returns Token line content such as `<<file:/abs/path>>`.
 */
export declare function multipartFileToken(filePath: string): string;
/**
 * Returns whether raw multipart text contains at least one file token.
 *
 * Used at send time to choose between the verbatim text path and the
 * token-expanding encoder that reads file bytes from disk.
 *
 * @param text - Verbatim multipart body from the Raw editor.
 * @returns True when a `<<file:…>>` token is present.
 */
export declare function multipartRawHasFileTokens(text: string): boolean;
/**
 * Renders structured multipart form parts as editable raw wire-like text.
 *
 * File payloads are replaced with `<<file:/abs/path>>` tokens so binary bytes
 * never enter the text editor. The boundary is caller-supplied so Content-Type
 * and body stay in sync when no raw override is active.
 *
 * @param parts - Multipart form parts from the structured editor.
 * @param boundary - Boundary string without leading dashes.
 * @returns Multipart body text with CRLF line endings.
 */
export declare function renderMultipartRaw(parts: FormDataPart[], boundary: string): string;
/**
 * Detects the multipart boundary from the first `--…` line in raw text.
 *
 * @param text - Verbatim multipart body.
 * @returns Boundary without leading dashes, or undefined when not found.
 */
export declare function detectMultipartBoundary(text: string): string | undefined;
/**
 * Builds a Content-Type header value for a raw multipart body.
 *
 * @param text - Verbatim multipart body (used to detect the boundary).
 * @returns `multipart/form-data; boundary=…`, or without boundary when undetectable.
 */
export declare function multipartRawContentType(text: string): string;
/**
 * Tolerantly parses a raw multipart body into structured form parts.
 *
 * Never throws and never blocks sending. Returns `representable: false` when the
 * text cannot cleanly map to rows (missing boundary, broken part headers, etc.)
 * so the UI can detach the table while still sending the verbatim raw override.
 *
 * File tokens (`<<file:/abs/path>>`) resolve to file parts with that path.
 *
 * @param text - Verbatim multipart body from the Raw editor.
 * @returns Best-effort parts plus whether they cleanly represent the raw text.
 */
export declare function parseMultipartRaw(text: string): ParseMultipartRawResult;
//# sourceMappingURL=multipartRaw.d.ts.map