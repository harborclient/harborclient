/**
 * Default placeholder shown in empty pre-request script editors.
 */
export const PRE_REQUEST_SCRIPT_PLACEHOLDER = `// hc.request.url = 'https://example.com';
// hc.variables.set('token', 'abc');`;

/**
 * Default placeholder shown in empty post-request script editors.
 */
export const POST_REQUEST_SCRIPT_PLACEHOLDER = `// hc.test("status is 200", () => {
//   hc.expect(hc.response.code).to.equal(200);
// });`;

/**
 * Default placeholder for collection-level pre-request script editors.
 */
export const COLLECTION_PRE_REQUEST_SCRIPT_PLACEHOLDER = `// hc.variables.set('token', 'abc');`;

/**
 * Documentation URL for request scripting help.
 */
export const REQUEST_SCRIPTS_HELP_URL = 'https://harborclient.com/request-scripts';

/**
 * Normalizes placeholder text so literal \\n sequences render as line breaks in CodeMirror.
 *
 * @param placeholder - Placeholder string from props or shared constants.
 * @returns Placeholder with escape sequences expanded to real newlines.
 */
export function normalizeEditorPlaceholder(placeholder: string): string {
  return placeholder.replace(/\\n/g, '\n');
}
