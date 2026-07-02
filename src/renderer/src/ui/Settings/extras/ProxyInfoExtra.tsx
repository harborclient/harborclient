import { SettingLabel } from '#/renderer/src/ui/Settings/components/SettingLabel';
import type { JSX } from 'react';

/**
 * Informational note about how the global HTTP proxy is applied and stored.
 */
export function ProxyInfoExtra(): JSX.Element {
  return (
    <div>
      <span className="text-[18px] font-medium text-text">
        <SettingLabel settingId="proxy.settings">HTTP Proxy</SettingLabel>
      </span>
      <p className="m-0 mb-4 text-[16px] text-muted">
        When enabled, HarborClient routes all outbound HTTP requests through the configured proxy
        server. Connect using HTTP or HTTPS, and turn on basic authentication when your network
        requires a username and password. Proxy settings are stored locally on this machine.
      </p>
    </div>
  );
}
