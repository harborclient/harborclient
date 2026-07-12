import { SettingLabel } from '#/renderer/src/ui/Settings/components/SettingLabel';
import type { JSX } from 'react';

/**
 * Informational note about how general request and UI defaults are applied.
 */
export function GeneralInfoExtra(): JSX.Element {
  return (
    <div>
      <span className="text-[18px] font-medium text-text">
        <SettingLabel settingId="general.settings">General</SettingLabel>
      </span>
      <p className="m-0 mb-4 text-muted">
        These defaults apply to outbound HTTP requests sent from HarborClient. Control how long
        requests and pre/post scripts may run, how large responses may be, whether TLS certificates
        are verified, and whether redirects are followed automatically. You can also choose whether
        switching appearance themes asks for confirmation.
      </p>
    </div>
  );
}
