import { Page } from '@harborclient/sdk/components';
import { useEffect, type JSX } from 'react';

import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectSettingsDraftLoadError } from '#/renderer/src/store/slices/settingsDraftSlice';
import { loadSettingsDraft } from '#/renderer/src/store/thunks/settingsDraft';
import type { SettingsSection } from '#/shared/types';

import { settingsSectionMeta } from '../constants';
import { SettingsSaveFooter } from '../components/SettingsSaveFooter';
import {
  fieldEntriesForSection,
  FORM_SECTION_DESCRIPTIONS,
  isFormSettingsSection,
  type FormSettingsSection
} from './catalog';
import {
  FORM_SECTION_EXTRAS,
  FORM_SECTION_LEADING_EXTRAS,
  isManagementSettingsSection,
  renderSettingFields,
  SETTINGS_SECTION_REGISTRY
} from './registry';

interface Props {
  /**
   * Built-in settings section to render in normal navigation mode.
   */
  section: SettingsSection;
}

/**
 * Renders optional leading content configured for a form section.
 *
 * @param section - Form settings section id.
 */
function FormSectionLeadingExtras({
  section
}: {
  section: FormSettingsSection;
}): JSX.Element | null {
  const ExtraComponent = FORM_SECTION_LEADING_EXTRAS[section];
  if (!ExtraComponent) {
    return null;
  }
  return <ExtraComponent />;
}

/**
 * Renders optional trailing content configured for a form section.
 *
 * @param section - Form settings section id.
 */
function FormSectionExtras({ section }: { section: FormSettingsSection }): JSX.Element | null {
  const ExtraComponent = FORM_SECTION_EXTRAS[section];
  if (!ExtraComponent) {
    return null;
  }
  return <ExtraComponent />;
}

/**
 * Inline load/save error message for catalog-driven form sections.
 */
function SettingsDraftError(): JSX.Element | null {
  const error = useAppSelector(selectSettingsDraftLoadError);
  if (!error) {
    return null;
  }

  return (
    <p className="mb-4 text-[14px] text-danger" role="alert">
      {error}
    </p>
  );
}

/**
 * Catalog-driven settings layout engine for section navigation.
 */
export function SettingsRenderer({ section }: Props): JSX.Element | null {
  const dispatch = useAppDispatch();

  /**
   * Loads the shared settings draft when a catalog-driven form section is shown.
   */
  useEffect(() => {
    if (isManagementSettingsSection(section)) {
      return;
    }
    void dispatch(loadSettingsDraft());
  }, [dispatch, section]);

  if (isManagementSettingsSection(section)) {
    const SectionComponent = SETTINGS_SECTION_REGISTRY[section];
    return <SectionComponent />;
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
          <SettingsSaveFooter />
        </div>
      </Page>
    );
  }

  return null;
}
