import { Button, Checkbox, FormGroup, Input } from '@harborclient/sdk/components';
import { type JSX, type ReactNode, useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import type { McpServerSettings, McpServerStatus } from '@harborclient/core/types';

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

  /**
   * When false, hides the Enable checkbox (footer panel uses Start/Stop instead).
   * Defaults to true for Settings.
   */
  showEnableToggle?: boolean;
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
  afterBearerToken,
  showEnableToggle = true
}: Props): JSX.Element {
  const nameId = `${idPrefix}-name`;
  const logoId = `${idPrefix}-logo`;
  const hostId = `${idPrefix}-host`;
  const portId = `${idPrefix}-port`;
  const endpointId = `${idPrefix}-endpoint`;
  const tokenId = `${idPrefix}-token`;
  const [endpointCopied, setEndpointCopied] = useState(false);

  const bindHostWarning =
    settings.host.trim() !== '127.0.0.1' && settings.host.trim() !== 'localhost';

  const endpointUrl = status.running
    ? `http://${status.host ?? settings.host}:${status.port ?? settings.port}/mcp`
    : 'Server stopped';

  /**
   * Copies the live MCP endpoint URL to the clipboard and briefly shows a Copied label.
   */
  const handleCopyEndpoint = useCallback((): void => {
    if (!status.running) {
      return;
    }
    void navigator.clipboard.writeText(endpointUrl).then(
      () => {
        setEndpointCopied(true);
        window.setTimeout(() => {
          setEndpointCopied(false);
        }, 2000);
      },
      () => {
        toast.error('Failed to copy');
      }
    );
  }, [endpointUrl, status.running]);

  return (
    <div className="flex flex-col gap-4">
      {showEnableToggle ? (
        <FormGroup label="Enable MCP server" layout="checkbox">
          <Checkbox
            checked={settings.enabled}
            disabled={saving}
            onChange={(event) => onChange({ ...settings, enabled: event.target.checked })}
          />
        </FormGroup>
      ) : null}

      <FormGroup label="Keep logs" layout="checkbox">
        <Checkbox
          checked={settings.keepLogs}
          disabled={saving}
          onChange={(event) => onChange({ ...settings, keepLogs: event.target.checked })}
        />
      </FormGroup>

      <div className="grid grid-cols-2 gap-4">
        <FormGroup label="Name" htmlFor={nameId}>
          <Input
            id={nameId}
            type="text"
            value={settings.name}
            disabled={saving}
            onChange={(event) => onChange({ ...settings, name: event.target.value })}
          />
        </FormGroup>

        <FormGroup label="Logo" htmlFor={logoId}>
          <Input
            id={logoId}
            type="url"
            value={settings.logoUrl}
            disabled={saving}
            onChange={(event) => onChange({ ...settings, logoUrl: event.target.value })}
          />
        </FormGroup>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormGroup label="Bind host" htmlFor={hostId}>
          <Input
            id={hostId}
            type="text"
            value={settings.host}
            disabled={saving}
            onChange={(event) => onChange({ ...settings, host: event.target.value })}
          />
        </FormGroup>

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
      </div>
      {bindHostWarning ? (
        <p className="m-0 text-[14px] text-danger" role="status">
          Binding to a non-loopback address exposes Harbor tools on your network. The bearer token
          is the only gate — use a strong token and expose only the tools you need.
        </p>
      ) : null}

      <FormGroup label="Endpoint" htmlFor={endpointId}>
        <div className="flex gap-2">
          <Input
            id={endpointId}
            type="text"
            readOnly
            className="min-w-0 flex-1"
            value={endpointUrl}
            onFocus={(event) => event.target.select()}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!status.running}
            aria-label="Copy MCP endpoint URL"
            onClick={handleCopyEndpoint}
          >
            {endpointCopied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </FormGroup>

      <FormGroup label="Bearer token" htmlFor={tokenId}>
        <Input id={tokenId} type="password" value={settings.token} readOnly disabled={saving} />
      </FormGroup>
      {afterBearerToken}
    </div>
  );
}
