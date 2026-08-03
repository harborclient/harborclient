import type { JSX } from 'react';
import { GithubModelsExtra } from './GithubModelsExtra';
import { McpSettingsExtra } from './McpSettingsExtra';

/**
 * Trailing AI settings extras: GitHub Models above MCP enable and client settings.
 */
export function AiSettingsExtras(): JSX.Element {
  return (
    <div className="flex flex-col gap-8">
      <GithubModelsExtra />
      <McpSettingsExtra />
    </div>
  );
}
