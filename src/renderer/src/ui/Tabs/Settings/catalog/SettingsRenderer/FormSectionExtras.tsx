import type { JSX } from 'react';

import type { FormSettingsSection } from '../catalog';
import { FORM_SECTION_EXTRAS } from '../registry';

interface Props {
  /**
   * Form settings section id whose trailing extras should render.
   */
  section: FormSettingsSection;
}

/**
 * Renders optional trailing content configured for a form section.
 */
export function FormSectionExtras({ section }: Props): JSX.Element | null {
  const ExtraComponent = FORM_SECTION_EXTRAS[section];
  if (!ExtraComponent) {
    return null;
  }
  return <ExtraComponent />;
}
