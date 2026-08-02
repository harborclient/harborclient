import type { AiToolName } from '@harborclient/core/ai/tools';
import type { JSX } from 'react';
import { McpExposedToolsTable } from '#/renderer/src/ui/Shared/Mcp/McpExposedToolsTable';

interface Props {
  /**
   * Tool names currently exposed through the MCP server.
   */
  exposedTools: readonly AiToolName[];

  /**
   * Updates the draft allowlist before Save.
   */
  onChange: (exposedTools: AiToolName[]) => void;

  /**
   * Disables checkboxes while settings are saving.
   */
  disabled?: boolean;

  /**
   * Inline error from a failed save or load, shown above the table.
   */
  error?: string | null;
}

/**
 * MCP panel body that lets the user choose which Harbor AI tools are exposed.
 *
 * @param props - Draft allowlist, change handler, and optional error banner.
 */
export function McpToolsView({
  exposedTools,
  onChange,
  disabled = false,
  error = null
}: Props): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {error ? (
          <p className="m-0 mb-4 text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <p className="m-0 mb-3 text-muted">
          Unchecked tools are omitted from the MCP server. Save to apply changes; a running server
          restarts so connected clients pick up the new tool list.
        </p>
        <McpExposedToolsTable
          exposedTools={exposedTools}
          onChange={onChange}
          disabled={disabled}
          idPrefix="footer-mcp-tool"
        />
      </div>
    </div>
  );
}
