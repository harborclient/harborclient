import type { JSX } from 'react';

import type { FormSettingsSection } from '../catalog';
import { FORM_SECTION_LEADING_EXTRAS } from '../registry';

interface Props {
  /**
   * Form settings section id whose leading extras should render.
   */
  section: FormSettingsSection;
}

/**
 * Renders optional leading content configured for a form section.
 */
export function FormSectionLeadingExtras({ section }: Props): JSX.Element | null {
  const ExtraComponent = FORM_SECTION_LEADING_EXTRAS[section];
  if (!ExtraComponent) {
    return null;
  }
  return <ExtraComponent />;
}
