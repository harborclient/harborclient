import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { ImageViewPage } from '#/renderer/src/ui/Tabs/ImageView';

/**
 * Route wrapper for the image viewer page tab.
 *
 * @param props - Page tab identity and hosting tab id.
 * @returns Image view page content.
 */
export function ImageViewPageRoute(props: PageComponentProps<'image-view'>): JSX.Element {
  return <ImageViewPage page={props.page} />;
}
