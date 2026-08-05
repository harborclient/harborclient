/**
 * Formats an HTTP response body for CLI stdout.
 *
 * When `pretty` is true and the body is valid JSON, returns indented JSON with
 * a trailing newline. Otherwise returns the body as-is, ensuring a trailing
 * newline when the body is non-empty (matching historical CLI behavior).
 *
 * @param body - Raw response body text.
 * @param pretty - When true, attempt to pretty-print JSON.
 * @returns Text ready to write to stdout.
 */
export function formatResponseBody(body: string, pretty: boolean): string {
  if (pretty) {
    try {
      const value: unknown = JSON.parse(body);
      return `${JSON.stringify(value, null, 2)}\n`;
    } catch {
      // Fall through to raw passthrough when the body is not JSON.
    }
  }

  if (!body) {
    return body;
  }

  return body.endsWith('\n') ? body : `${body}\n`;
}
