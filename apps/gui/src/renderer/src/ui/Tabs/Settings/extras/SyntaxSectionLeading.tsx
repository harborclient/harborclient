import type { JSX } from 'react';

import { SyntaxInfoExtra } from './SyntaxInfoExtra';
import { SyntaxPreviewExtra } from './SyntaxPreviewExtra';

/**
 * Leading content for the Scripting settings section: heading plus live preview.
 */
export function SyntaxSectionLeading(): JSX.Element {
  return (
    <>
      <SyntaxInfoExtra />
      <SyntaxPreviewExtra />
    </>
  );
}
