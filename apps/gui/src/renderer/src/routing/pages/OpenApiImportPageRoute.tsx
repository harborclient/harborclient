import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { OpenApiImport } from '#/renderer/src/ui/Tabs/OpenApiImport';

/**
 * Route wrapper for the built-in OpenAPI import preview page tab.
 *
 * @param _props - Page tab props (unused).
 * @returns OpenAPI import page content.
 */
export function OpenApiImportPageRoute(_props: PageComponentProps<'openapi-import'>): JSX.Element {
  void _props;
  return <OpenApiImport />;
}
