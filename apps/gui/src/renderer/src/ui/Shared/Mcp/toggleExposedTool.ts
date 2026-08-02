import { AI_TOOL_NAMES, type AiToolName } from '@harborclient/core/ai/tools';

/**
 * Adds or removes a single tool from an MCP expose allowlist.
 *
 * Result order always matches {@link AI_TOOL_NAMES}.
 *
 * @param exposedTools - Current allowlist.
 * @param toolName - Tool to enable or disable.
 * @param enabled - Whether the tool should be exposed.
 * @returns Updated allowlist in registry order.
 */
export function toggleExposedTool(
  exposedTools: readonly AiToolName[],
  toolName: AiToolName,
  enabled: boolean
): AiToolName[] {
  const selected = new Set(exposedTools);
  if (enabled) {
    selected.add(toolName);
  } else {
    selected.delete(toolName);
  }

  return AI_TOOL_NAMES.filter((name) => selected.has(name));
}
