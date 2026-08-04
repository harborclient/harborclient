import { type JSX } from 'react';
import { PluginHost } from '#/renderer/src/plugins/PluginHost';
import { PluginThemePrompt } from '#/renderer/src/plugins/PluginThemePrompt';
import { ScriptLivePageHost } from '#/renderer/src/scripting/ScriptLivePageHost';
import { McpHost } from '#/renderer/src/store/ai/McpHost';

/**
 * Invisible runtime hosts mounted for the app shell (plugins, MCP, live pages, themes).
 */
export function Hosts(): JSX.Element {
  return (
    <>
      <PluginHost />
      <McpHost />
      <ScriptLivePageHost />
      <PluginThemePrompt />
    </>
  );
}
