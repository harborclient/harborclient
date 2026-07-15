import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing';
import { Snippets } from '#/renderer/src/ui/Tabs/Snippets';

/**
 * Route wrapper for the Snippets page tab.
 *
 * @param _props - Page tab props (unused).
 * @returns Snippets page content.
 */
export function SnippetsPageRoute(_props: PageComponentProps<'snippets'>): JSX.Element {
  return <Snippets />;
}
