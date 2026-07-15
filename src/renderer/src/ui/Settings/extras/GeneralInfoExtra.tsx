import { SettingSectionHeading } from '@harborclient/sdk/components';
import type { JSX } from 'react';

/**
 * Informational note about how general request and UI defaults are applied.
 */
export function GeneralInfoExtra(): JSX.Element {
  return (
    <SettingSectionHeading
      settingId="general.settings"
      title="General"
      description="These defaults apply to outbound HTTP requests sent from HarborClient. Control how long requests and pre/post scripts may run, how large responses may be, whether TLS certificates are verified, and whether redirects are followed automatically. You can also choose whether switching appearance themes asks for confirmation."
    />
  );
}
