import type { JSX } from 'react';

import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectSettingsDraftLoadError } from '#/renderer/src/store/slices/settingsDraftSlice';

/**
 * Inline load/save error message for catalog-driven form sections and search results.
 */
export function SettingsDraftError(): JSX.Element | null {
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
