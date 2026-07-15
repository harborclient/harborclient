import type { JSX } from 'react';

import { useAppSelector } from '#/renderer/src/store/hooks';
import type { SettingsSectionComponentProps } from '../catalog/registry';
import { GlobalsSectionForm } from './GlobalsSectionForm';
import { serializeGlobalsForm } from './serializeGlobalsForm';

/**
 * App-wide global variables managed from Settings → Globals.
 */
export function GlobalsSection({ focusVariableKey }: SettingsSectionComponentProps): JSX.Element {
  const savedVariables = useAppSelector((state) => state.settings.general.globalVariables);
  return (
    <GlobalsSectionForm
      key={serializeGlobalsForm(savedVariables)}
      savedVariables={savedVariables}
      focusVariableKey={focusVariableKey}
    />
  );
}
