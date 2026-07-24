import type { KeyValue } from './types/common';
/**
 * Builds an application/x-www-form-urlencoded wire string from enabled key-value rows.
 *
 * Mirrors {@link Body.buildUrlEncoded} so the Raw body drawer shows the same encoding
 * the structured editor would send when no raw override is active.
 *
 * @param rows - Key-value rows from the form-urlencoded editor.
 * @returns Encoded `k=v&k2=v2` string for enabled rows with a non-empty key.
 */
export declare function rowsToRawUrlEncoded(rows: KeyValue[]): string;
/**
 * Tolerantly parses a raw urlencoded body into key-value rows for the table preview.
 *
 * Never throws. Splits on `&` and takes the first `=` in each segment so unusual or
 * intentionally invalid fragments (missing values, bare keys, trailing `&`) remain
 * visible in the structured editor. All returned rows are enabled.
 *
 * @param text - Verbatim urlencoded body text from the Raw editor.
 * @returns Best-effort key-value rows; empty when `text` is blank.
 */
export declare function rawUrlEncodedToRows(text: string): KeyValue[];
//# sourceMappingURL=urlencodedRaw.d.ts.map