import { SettingLabel } from '#/renderer/src/ui/Settings/components/SettingLabel';
import type { JSX } from 'react';

/**
 * Informational note about how syntax highlighting settings apply to editors.
 */
export function SyntaxInfoExtra(): JSX.Element {
  return (
    <div>
      <span className="text-[18px] font-medium text-text">
        <SettingLabel settingId="syntax.settings">Syntax Highlighting</SettingLabel>
      </span>
      <p className="m-0 mb-4 text-muted">
        Choose the CodeMirror color theme and editor behavior for request and response editors.
        Settings apply across HarborClient after you save. Use the preview below to see how your
        current draft looks before saving.
      </p>
    </div>
  );
}
