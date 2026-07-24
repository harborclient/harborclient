import { SettingSectionHeading } from '@harborclient/sdk/components';
import type { JSX } from 'react';

/**
 * Informational note about how syntax highlighting settings apply to editors.
 */
export function SyntaxInfoExtra(): JSX.Element {
  return (
    <SettingSectionHeading
      settingId="syntax.settings"
      title="Syntax Highlighting"
      description="Choose the CodeMirror color theme and editor behavior for request and response editors. Settings apply across HarborClient after you save. Use the preview below to see how your current draft looks before saving."
    />
  );
}
