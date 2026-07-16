import { Page } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import type { SettingsSection } from '#/shared/types';

import { settingsSectionMeta } from '../../constants';
import { SettingsSaveFooter } from '../../components/SettingsSaveFooter';
import {
  fieldEntriesForSection,
  FORM_SECTION_DESCRIPTIONS,
  isFormSettingsSection
} from '../catalog';
import {
  isManagementSettingsSection,
  renderSettingFields,
  SETTINGS_SECTION_REGISTRY
} from '../registry';
import { SettingsDraftError } from '../SettingsDraftError';
import { FormSectionExtras } from './FormSectionExtras';
import { FormSectionLeadingExtras } from './FormSectionLeadingExtras';

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
   * When set, scrolls to the matching catalog group anchor in management sections that support it.
   */
  focusSettingId?: string;

  /**
   * Called after a requested group anchor has been scrolled into view.
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
    const { label, icon } = settingsSectionMeta(section);
    const fieldIds = fieldEntriesForSection(section).map((entry) => entry.id);

    return (
      <Page
        embedded
        className="mb-6 flex flex-col"
        title={label}
        icon={icon}
        description={FORM_SECTION_DESCRIPTIONS[section]}
      >
        <SettingsDraftError />
        <FormSectionLeadingExtras section={section} />
        <div className="mb-6 flex flex-col gap-6">{renderSettingFields(fieldIds)}</div>
        <FormSectionExtras section={section} />
        <div className="mt-2">
          <SettingsSaveFooter tabId={tabId} />
        </div>
      </Page>
    );
  }

  return null;
}
