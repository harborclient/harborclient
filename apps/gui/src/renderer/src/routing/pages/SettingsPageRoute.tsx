import type { JSX } from 'react';
import type { PageComponentProps } from '#/renderer/src/routing/types';
import { Settings } from '#/renderer/src/ui/Tabs/Settings';

/**
 * Route wrapper for the Settings page tab.
 *
 * @param props - Page identity carrying the initial section and focus targets.
 * @returns Settings page content.
 */
export function SettingsPageRoute({ page, tabId }: PageComponentProps<'settings'>): JSX.Element {
  return (
    <Settings
      key="settings"
      initialSection={page.section}
      focusVariableKey={page.focusVariableKey}
      focusSettingId={page.focusSettingId}
      tabId={tabId}
    />
  );
}
