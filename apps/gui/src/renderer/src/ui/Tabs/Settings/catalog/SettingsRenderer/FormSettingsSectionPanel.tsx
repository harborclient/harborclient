import { Page } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import type { MainFormSettingsSection } from '@harborclient/core/search/settingsCatalog';

import { SettingsSaveAction } from '../../components/SettingsSaveAction';
import { settingsSectionMeta } from '../../constants';
import { useFocusSettingAnchor } from '../../hooks/useFocusSettingAnchor';
import { fieldEntriesForSection, FORM_SECTION_DESCRIPTIONS } from '../catalog';
import { renderSettingFields } from '../registry';
import { SettingsDraftError } from '../SettingsDraftError';
import { FormSectionExtras } from './FormSectionExtras';
import { FormSectionLeadingExtras } from './FormSectionLeadingExtras';

interface Props {
  /**
   * Form settings section to render.
   */
  section: MainFormSettingsSection;

  /**
   * When set, scrolls to and focuses the matching catalog field control.
   */
  focusSettingId?: string;

  /**
   * Called after a requested field anchor has been scrolled into view.
   */
  onFocusSettingHandled?: () => void;

  /**
   * Hosting tab id so File → Save / Ctrl+S can persist form sections.
   */
  tabId?: string;
}

/**
 * Renders one form settings section and focuses a pending catalog field when
 * requested by search or a harborclient://settings deep link.
 *
 * @param props - Section id, optional focus target, and save-action tab id.
 */
export function FormSettingsSectionPanel({
  section,
  focusSettingId,
  onFocusSettingHandled,
  tabId
}: Props): JSX.Element {
  useFocusSettingAnchor(focusSettingId, onFocusSettingHandled);

  const { label, icon } = settingsSectionMeta(section);
  const fieldIds = fieldEntriesForSection(section).map((entry) => entry.id);
  const showSave = section !== 'appearance';

  return (
    <Page
      embedded
      className="mb-6 flex flex-col"
      title={label}
      icon={icon}
      description={FORM_SECTION_DESCRIPTIONS[section]}
      actions={showSave ? <SettingsSaveAction tabId={tabId} /> : undefined}
    >
      <SettingsDraftError />
      <FormSectionLeadingExtras section={section} />
      <div className="mb-6 flex flex-col gap-6">{renderSettingFields(fieldIds)}</div>
      <FormSectionExtras section={section} />
    </Page>
  );
}
