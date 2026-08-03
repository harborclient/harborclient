import type { JSX } from 'react';

import type { SettingsSection } from '@harborclient/core/types';

import { isFormSettingsSection } from '../catalog';
import { isManagementSettingsSection, SETTINGS_SECTION_REGISTRY } from '../registry';
import { FormSettingsSectionPanel } from './FormSettingsSectionPanel';

interface Props {
  /**
   * Built-in settings section to render in normal navigation mode.
   */
  section: SettingsSection;

  /**
   * When set, focuses the matching variable row in management sections that support it.
   */
  focusVariableKey?: string;

  /**
   * When set, scrolls to the matching catalog field or group anchor.
   */
  focusSettingId?: string;

  /**
   * Called after a requested setting anchor has been scrolled into view.
   */
  onFocusSettingHandled?: () => void;

  /**
   * Hosting tab id so File → Save / Ctrl+S can persist form sections.
   */
  tabId?: string;
}

/**
 * Catalog-driven settings layout engine for section navigation.
 */
export function SettingsRenderer({
  section,
  focusVariableKey,
  focusSettingId,
  onFocusSettingHandled,
  tabId
}: Props): JSX.Element | null {
  if (isManagementSettingsSection(section)) {
    const SectionComponent = SETTINGS_SECTION_REGISTRY[section];
    return (
      <SectionComponent
        focusVariableKey={focusVariableKey}
        focusSettingId={focusSettingId}
        onFocusSettingHandled={onFocusSettingHandled}
        tabId={tabId}
      />
    );
  }

  if (isFormSettingsSection(section)) {
    return (
      <FormSettingsSectionPanel
        section={section}
        focusSettingId={focusSettingId}
        onFocusSettingHandled={onFocusSettingHandled}
        tabId={tabId}
      />
    );
  }

  return null;
}
