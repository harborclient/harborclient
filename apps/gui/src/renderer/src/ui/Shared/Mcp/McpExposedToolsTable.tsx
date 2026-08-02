import { Checkbox } from '@harborclient/sdk/components';
import { AI_TOOL_DEFINITIONS, AI_TOOL_NAMES, type AiToolName } from '@harborclient/core/ai/tools';
import { useEffect, useRef, type ChangeEvent, type JSX } from 'react';
import { toggleExposedTool } from './toggleExposedTool';

/**
 * Short descriptions keyed by Harbor AI tool name, sourced from the OpenAI tool
 * registry so the checklist stays aligned with MCP `tools/list`.
 */
const AI_TOOL_DESCRIPTIONS = Object.fromEntries(
  AI_TOOL_DEFINITIONS.flatMap((definition) => {
    if (definition.type !== 'function') {
      return [];
    }

    return [[definition.function.name, definition.function.description ?? '']];
  })
) as Record<AiToolName, string>;

interface Props {
  /**
   * Tool names currently exposed through the MCP server.
   */
  exposedTools: readonly AiToolName[];

  /**
   * Called with the next allowlist after a row or select-all toggle.
   */
  onChange: (exposedTools: AiToolName[]) => void;

  /**
   * Disables every checkbox while settings are saving.
   */
  disabled?: boolean;

  /**
   * Prefix for checkbox element ids so footer and settings can coexist.
   */
  idPrefix?: string;
}

/**
 * Checkbox table for choosing which Harbor AI tools the MCP server exposes.
 *
 * @param props - Allowlist value, change handler, and optional disabled state.
 */
export function McpExposedToolsTable({
  exposedTools,
  onChange,
  disabled = false,
  idPrefix = 'mcp-tool'
}: Props): JSX.Element {
  const toggleAllRef = useRef<HTMLInputElement>(null);
  const selected = new Set(exposedTools);
  const allEnabled = AI_TOOL_NAMES.every((name) => selected.has(name));
  const allDisabled = AI_TOOL_NAMES.every((name) => !selected.has(name));
  const toggleAllIndeterminate = !allEnabled && !allDisabled;

  /**
   * Mirrors the mixed selection state on the header checkbox because the SDK
   * Checkbox does not expose an indeterminate prop.
   */
  useEffect(() => {
    if (toggleAllRef.current) {
      toggleAllRef.current.indeterminate = toggleAllIndeterminate;
    }
  }, [toggleAllIndeterminate]);

  /**
   * Enables or disables every Harbor AI tool in one draft update.
   *
   * @param event - Native checkbox change event from the header control.
   */
  const handleToggleAll = (event: ChangeEvent<HTMLInputElement>): void => {
    onChange(event.target.checked ? [...AI_TOOL_NAMES] : []);
  };

  /**
   * Toggles a single tool in the draft allowlist.
   *
   * @param toolName - Harbor AI tool being checked or unchecked.
   */
  const handleRowChange =
    (toolName: AiToolName) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      onChange(toggleExposedTool(exposedTools, toolName, event.target.checked));
    };

  return (
    <div className="overflow-x-auto rounded-md border border-separator">
      <table className="w-full border-collapse text-[14px]">
        <caption className="sr-only">Exposed MCP tools</caption>
        <thead>
          <tr className="border-b border-separator bg-sidebar/40 text-left">
            <th scope="col" className="w-10 px-3 py-2">
              <Checkbox
                ref={toggleAllRef}
                checked={allEnabled}
                disabled={disabled}
                aria-label="Expose all MCP tools"
                onChange={handleToggleAll}
              />
            </th>
            <th scope="col" className="whitespace-nowrap px-3 py-2 font-medium text-text">
              Tool
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-text">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {AI_TOOL_NAMES.map((toolName) => {
            const checkboxId = `${idPrefix}-${toolName}`;
            const descriptionId = `${checkboxId}-description`;
            const description = AI_TOOL_DESCRIPTIONS[toolName];

            return (
              <tr key={toolName} className="border-b border-separator last:border-b-0">
                <td className="px-3 py-2 align-top">
                  <Checkbox
                    id={checkboxId}
                    checked={selected.has(toolName)}
                    disabled={disabled}
                    aria-labelledby={`${checkboxId}-label`}
                    aria-describedby={description ? descriptionId : undefined}
                    onChange={handleRowChange(toolName)}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2 align-top">
                  <label
                    id={`${checkboxId}-label`}
                    htmlFor={checkboxId}
                    className="block cursor-pointer font-mono text-text"
                  >
                    {toolName}
                  </label>
                </td>
                <td className="px-3 py-2 align-top text-muted">
                  {description ? (
                    <p id={descriptionId} className="m-0">
                      {description}
                    </p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
