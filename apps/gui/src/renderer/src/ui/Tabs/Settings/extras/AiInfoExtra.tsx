import { SettingSectionHeading } from '@harborclient/sdk/components';
import type { JSX } from 'react';

/**
 * Informational note about how personal AI API keys are stored and used.
 */
export function AiInfoExtra(): JSX.Element {
  return (
    <SettingSectionHeading
      settingId="ai.settings"
      title="API Keys"
      description="Personal API keys are encrypted and stored locally on this machine. HarborClient uses the OS keychain when available, or a local encryption key otherwise. When a connected Team Hub offers the same model, HarborClient prefers the hub and uses these keys only as a fallback."
    />
  );
}
