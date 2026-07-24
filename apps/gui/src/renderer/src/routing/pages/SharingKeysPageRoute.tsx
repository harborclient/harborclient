import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { SharingKeys } from '#/renderer/src/ui/Tabs/SharingKeys';

/**
 * Route wrapper for the Sharing Keys page tab.
 *
 * @param _props - Page tab props (unused).
 * @returns Sharing Keys page content.
 */
export function SharingKeysPageRoute(_props: PageComponentProps<'sharing-keys'>): JSX.Element {
  void _props;
  return <SharingKeys />;
}
