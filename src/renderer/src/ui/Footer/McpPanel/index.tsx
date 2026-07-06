import { Button, Resizable } from '@harborclient/sdk/components';
import { useEffect, useState, type FormEvent, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { McpServerSettings, McpServerStatus } from '#/shared/types';
import { McpServerFormFields } from '#/renderer/src/ui/shared/McpServerFormFields';
import { buildMcpConfigSnippet } from '#/renderer/src/ui/shared/buildMcpConfigSnippet';
import { formatIpcErrorMessage } from '#/renderer/src/ui/modals/dialogHelpers';

interface Props {
  /**
   * Whether the panel is visible (slides up when true).
   */
  open: boolean;

  /**
   * Closes the MCP panel.
   */
  onClose: () => void;

  /**
   * Called after settings are saved or the token is regenerated so footer indicators refresh.
   */
  onStatusChange?: () => void;
}

/**
 * Slide-up panel for quick MCP server settings from the footer bar.
 */
export function McpPanel({ open, onClose, onStatusChange }: Props): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverSettings, setServerSettings] = useState<McpServerSettings | null>(null);
  const [serverStatus, setServerStatus] = useState<McpServerStatus>({ running: false });
  const [tokenCopied, setTokenCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);

  /**
   * Loads MCP server settings and runtime status when the panel opens.
   */
  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [settings, status] = await Promise.all([
          window.api.getMcpServerSettings(),
          window.api.getMcpServerStatus()
        ]);
        if (!active) {
          return;
        }
        setServerSettings(settings);
        setServerStatus(status);
        setTokenCopied(false);
        setConfigCopied(false);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(formatIpcErrorMessage(loadError, 'Failed to load MCP settings.'));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [open]);

  /**
   * Persists MCP server settings and refreshes runtime status.
   */
  const handleSaveServer = async (): Promise<void> => {
    if (!serverSettings) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await window.api.setMcpServerSettings(serverSettings);
      const status = await window.api.getMcpServerStatus();
      setServerSettings(saved);
      setServerStatus(status);
      onStatusChange?.();
      toast.success('MCP server settings saved.');
    } catch (saveError) {
      setError(formatIpcErrorMessage(saveError, 'Failed to save MCP server settings.'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Submits the MCP server settings form.
   *
   * @param event - Form submit event.
   */
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void handleSaveServer();
  };

  /**
   * Regenerates the MCP server bearer token.
   */
  const handleRegenerateToken = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const saved = await window.api.regenerateMcpServerToken();
      const status = await window.api.getMcpServerStatus();
      setServerSettings(saved);
      setServerStatus(status);
      setTokenCopied(false);
      setConfigCopied(false);
      onStatusChange?.();
      toast.success('MCP server token regenerated.');
    } catch (regenerateError) {
      setError(formatIpcErrorMessage(regenerateError, 'Failed to regenerate MCP token.'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Copies the MCP server bearer token to the clipboard.
   */
  const handleCopyToken = (): void => {
    if (!serverSettings) {
      return;
    }

    void navigator.clipboard.writeText(serverSettings.token).then(() => {
      setTokenCopied(true);
    });
  };

  /**
   * Copies the external MCP client configuration snippet to the clipboard.
   */
  const handleCopyConfig = (): void => {
    if (!serverSettings) {
      return;
    }

    const snippet = buildMcpConfigSnippet(serverSettings, serverStatus);
    void navigator.clipboard.writeText(snippet).then(() => {
      setConfigCopied(true);
      toast.success('MCP config copied.');
    });
  };

  const showToolsNote =
    serverSettings?.enabled === true &&
    !serverStatus.running &&
    serverSettings.exposedTools.length === 0;

  return (
    <Resizable
      id="footer-mcp-panel"
      open={open}
      onClose={onClose}
      closeLabel="MCP server"
      storageKey="hc.mcpPanelHeight"
      title={<span className="text-[14px] font-medium text-text">MCP Server</span>}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {loading || !serverSettings ? (
          <p className="m-0 p-4 text-[14px] text-muted" role="status">
            Loading MCP settings…
          </p>
        ) : (
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              {error ? (
                <p className="m-0 mb-4 text-[14px] text-danger" role="alert">
                  {error}
                </p>
              ) : null}

              <McpServerFormFields
                settings={serverSettings}
                status={serverStatus}
                saving={saving}
                idPrefix="footer-mcp"
                onChange={setServerSettings}
                afterBearerToken={
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving}
                      onClick={() => void handleRegenerateToken()}
                    >
                      Regenerate token
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving || !serverSettings.token}
                      onClick={handleCopyToken}
                    >
                      {tokenCopied ? 'Copied' : 'Copy token'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={saving || !serverSettings.token}
                      onClick={handleCopyConfig}
                    >
                      {configCopied ? 'Copied' : 'Copy config'}
                    </Button>
                  </div>
                }
              />

              {showToolsNote ? (
                <p className="m-0 mt-4 text-[14px] text-muted" role="status">
                  Enable at least one tool in Settings → AI &amp; MCP before the server can start
                  listening.
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-separator px-4 py-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Resizable>
  );
}
