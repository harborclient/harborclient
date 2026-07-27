/**
 * Built-in response viewer sub-tab identifiers that can be opened in a full page.
 */
export const RESPONSE_VIEWER_TABS = [
  'body',
  'preview',
  'headers',
  'timing',
  'console',
  'redirects',
  'tests'
] as const;

/**
 * Built-in response viewer sub-tab id.
 */
export type ResponseViewerTab = (typeof RESPONSE_VIEWER_TABS)[number];

/**
 * Human-readable labels for built-in response viewer tabs.
 */
export const RESPONSE_VIEWER_TAB_LABELS: Record<ResponseViewerTab, string> = {
  body: 'Body',
  preview: 'Preview',
  headers: 'Headers',
  timing: 'Timing',
  console: 'Console',
  redirects: 'Redirects',
  tests: 'Tests'
};

/**
 * Whether a viewer tab id is a built-in expand-supported response tab.
 *
 * @param tab - Candidate tab id from the response editor.
 * @returns True when the tab can be opened in a response-viewer page.
 */
export function isResponseViewerTab(tab: string): tab is ResponseViewerTab {
  return (RESPONSE_VIEWER_TABS as readonly string[]).includes(tab);
}
