import { SettingLabel } from '#/renderer/src/ui/Settings/components/SettingLabel';
import type { JSX } from 'react';

/**
 * Informational note about how personal AI API keys are stored and used.
 */
export function AiInfoExtra(): JSX.Element {
  return (
    <div>
      <span className="text-[18px] font-medium text-text">
        <SettingLabel settingId="ai.settings">API Keys</SettingLabel>
      </span>
      <p className="m-0 mb-4 text-muted">
        Personal API keys are encrypted and stored locally on this machine. HarborClient uses the OS
        keychain when available, or a local encryption key otherwise. When a connected Team Hub
        offers the same model, HarborClient prefers the hub and uses these keys only as a fallback.
      </p>
    </div>
  );
}
