import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { ResponseViewerPage } from '#/renderer/src/ui/Tabs/ResponseViewer';

/**
 * Route wrapper for the response viewer page tab.
 *
 * @param props - Page tab identity and hosting tab id.
 * @returns Response viewer page content.
 */
export function ResponseViewerPageRoute(props: PageComponentProps<'response-viewer'>): JSX.Element {
  return <ResponseViewerPage page={props.page} tabId={props.tabId} />;
}
