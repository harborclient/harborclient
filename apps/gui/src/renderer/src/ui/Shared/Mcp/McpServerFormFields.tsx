import { Checkbox, FormGroup, Input } from '@harborclient/sdk/components';
import { type JSX, type ReactNode } from 'react';
import type { McpServerSettings, McpServerStatus } from '#/shared/types';

interface Props {
  /**
   * Current MCP server settings being edited.
   */
  settings: McpServerSettings;

  /**
   * Runtime MCP server listener status.
   */
  status: McpServerStatus;

  /**
   * When true, form controls are disabled while a save is in flight.
   */
  saving: boolean;

  /**
   * Called when any server field changes.
   *
   * @param settings - Updated MCP server settings.
   */
  onChange: (settings: McpServerSettings) => void;

  /**
   * Prefix for input element ids to avoid duplicate ids when rendered in multiple panels.
   */
  idPrefix?: string;

  /**
   * Optional content rendered directly under the bearer token field.
   */
  afterBearerToken?: ReactNode;
}

/**
 * Core MCP server settings fields shared by Settings and the footer slide-up panel.
 */
export function McpServerFormFields({
  settings,
  status,
  saving,
  onChange,
  idPrefix = 'mcp-server',
  afterBearerToken
}: Props): JSX.Element {
  const hostId = `${idPrefix}-host`;
  const portId = `${idPrefix}-port`;
  const tokenId = `${idPrefix}-token`;

  const bindHostWarning =
    settings.host.trim() !== '127.0.0.1' && settings.host.trim() !== 'localhost';

  return (
    <div className="flex flex-col gap-4">
      <FormGroup label="Enable MCP server" layout="checkbox">
        <Checkbox
          checked={settings.enabled}
          disabled={saving}
          onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
        />
      </FormGroup>

      <FormGroup label="Bind host" htmlFor={hostId}>
        <Input
          id={hostId}
          type="text"
          value={settings.host}
          disabled={saving}
          onChange={(event) => onChange({ ...settings, host: event.target.value })}
        />
      </FormGroup>
      {bindHostWarning ? (
        <p className="m-0 text-[14px] text-danger" role="status">
          Binding to a non-loopback address exposes Harbor tools on your network. The bearer token
          is the only gate — use a strong token and expose only the tools you need.
        </p>
      ) : null}

      <FormGroup label="Port" htmlFor={portId}>
        <Input
          id={portId}
          type="number"
          min={1}
          value={String(settings.port)}
          disabled={saving}
          onChange={(event) =>
            onChange({
              ...settings,
              port: Number.parseInt(event.target.value, 10) || settings.port
            })
          }
        />
      </FormGroup>

      <p className="m-0 text-[14px] text-muted" role="status">
        {status.running
          ? `Running at http://${status.host ?? settings.host}:${status.port ?? settings.port}/mcp`
          : 'Server stopped'}
      </p>

      <FormGroup label="Bearer token" htmlFor={tokenId}>
        <Input id={tokenId} type="password" value={settings.token} readOnly disabled={saving} />
      </FormGroup>
      {afterBearerToken}
    </div>
  );
}
