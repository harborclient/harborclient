import type { KeyValue } from './types/common';
/**
 * Base URL, query string (without leading ?), and hash fragment (without leading #).
 */
export interface SplitUrl {
    /**
     * URL portion before the query string and hash.
     */
    base: string;
    /**
     * Query string without a leading ?; empty when absent.
     */
    query: string;
    /**
     * Hash fragment without a leading #; empty when absent.
     */
    hash: string;
}
/**
 * Splits a URL into base path, query string, and hash fragment without re-encoding.
 *
 * @param url - Full request URL as typed in the editor.
 * @returns Lenient split preserving raw text including {{variables}}.
 */
export declare function splitUrl(url: string): SplitUrl;
/**
 * Parses the query string from a URL into key-value rows without decoding values.
 *
 * @param url - Full request URL as typed in the editor.
 * @returns Parsed rows with enabled set to true; empty keys are skipped.
 */
export declare function parseQueryString(url: string): KeyValue[];
/**
 * Appends enabled query parameters to a base URL for outbound sends.
 *
 * Matches `@harborclient/http` QueryString.buildUrl so renderer-side URL previews
 * (for example sidebar Copy) align with the URL the main process sends.
 *
 * @param baseUrl - Request URL before query string merging.
 * @param params - Key-value pairs to append as search params.
 * @returns URL with merged query parameters.
 */
export declare function buildSendUrl(baseUrl: string, params: KeyValue[]): string;
/**
 * Rebuilds a URL query string from enabled params without re-encoding raw text.
 *
 * @param url - Current request URL including any existing query and hash.
 * @param params - Params table rows from the request editor.
 * @returns URL with query string replaced from enabled params; hash preserved.
 */
export declare function applyParamsToUrl(url: string, params: KeyValue[]): string;
/**
 * Merges query params parsed from a URL with disabled rows from the current table.
 *
 * Enabled rows come from the URL (source of truth). Disabled non-empty rows from
 * the current table are kept at the end so they remain editable but stay out of the URL.
 *
 * @param url - Updated request URL from the URL bar.
 * @param currentParams - Existing params table rows.
 * @returns Params rows for the editor, ending with one blank trailing row.
 */
export declare function mergeParamsFromUrl(url: string, currentParams: KeyValue[]): KeyValue[];
//# sourceMappingURL=queryParams.d.ts.map