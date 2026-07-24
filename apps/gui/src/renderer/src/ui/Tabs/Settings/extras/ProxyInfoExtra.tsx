import { SettingSectionHeading } from '@harborclient/sdk/components';
import type { JSX } from 'react';

/**
 * Informational note about how the global HTTP proxy is applied and stored.
 */
export function ProxyInfoExtra(): JSX.Element {
  return (
    <SettingSectionHeading
      settingId="proxy.settings"
      title="HTTP Proxy"
      description="When enabled, HarborClient routes all outbound HTTP requests through the configured proxy server. Connect using HTTP or HTTPS, and turn on basic authentication when your network requires a username and password. Proxy settings are stored locally on this machine."
    />
  );
}
