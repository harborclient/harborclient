import { Button, FooterPanel, StatusDot } from '@harborclient/sdk/components';
import { useEffect, useState, type FormEvent, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { McpServerSettings, McpServerStatus } from '@harborclient/core/types';
import { McpServerFormFields } from '#/renderer/src/ui/Shared/Mcp/McpServerFormFields';
import { buildMcpConfigSnippet } from '#/renderer/src/ui/Shared/Mcp/buildMcpConfigSnippet';
import { formatIpcErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';
import { McpLogsView } from './McpLogsView';
import { McpToolsView } from './McpToolsView';
import { useMcpLogsController } from './useMcpLogsController';

/**
 * Which body the MCP footer panel is showing.
 */
type McpPanelView = 'config' | 'logs' | 'tools';

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
  const [serverStatus, setServerStatus] = useState<McpServerStatus>({
    running: false,
    enabled: false
  });
  const [tokenCopied, setTokenCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const [view, setView] = useState<McpPanelView>('config');
  const [viewOpen, setViewOpen] = useState(open);
  const logsController = useMcpLogsController({
    active: open && view === 'logs',
    keepLogs: serverSettings?.keepLogs ?? false
  });

  // Reset to the config body whenever the footer panel is reopened.
  if (viewOpen !== open) {
    setViewOpen(open);
    if (open) {
      setView('config');
    }
  }

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
   * Persists MCP server settings, refreshes runtime status, and returns the saved settings.
   *
   * @param nextSettings - Settings to persist.
   * @returns Saved settings from the main process.
   */
  const persistSettings = async (nextSettings: McpServerSettings): Promise<McpServerSettings> => {
    const saved = await window.api.setMcpServerSettings(nextSettings);
    const status = await window.api.getMcpServerStatus();
    setServerSettings(saved);
    setServerStatus(status);
    onStatusChange?.();
    return saved;
  };

  /**
   * Persists the current form fields without changing the enabled flag.
   */
  const handleSaveServer = async (): Promise<void> => {
    if (!serverSettings) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await persistSettings(serverSettings);
      toast.success('MCP server settings saved.');
    } catch (saveError) {
      setError(formatIpcErrorMessage(saveError, 'Failed to save MCP server settings.'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Starts the MCP HTTP listener without changing the Settings enable flag.
   */
  const handleStart = async (): Promise<void> => {
    if (!serverSettings) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await persistSettings({ ...serverSettings, running: true });
      toast.success('MCP server started.');
    } catch (startError) {
      setError(formatIpcErrorMessage(startError, 'Failed to start MCP server.'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Stops the MCP HTTP listener without disabling the Settings enable flag.
   */
  const handleStop = async (): Promise<void> => {
    if (!serverSettings) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await persistSettings({ ...serverSettings, running: false });
      toast.success('MCP server stopped.');
    } catch (stopError) {
      setError(formatIpcErrorMessage(stopError, 'Failed to stop MCP server.'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Submits the MCP server settings form (Enter in an input) the same as Save.
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

  /**
   * Switches the panel body to logs, or back to config when already on logs.
   */
  const handleToggleLogsView = (): void => {
    setView((current) => (current === 'logs' ? 'config' : 'logs'));
  };

  /**
   * Switches the panel body to the tools checklist, or back to config when already on tools.
   */
  const handleToggleToolsView = (): void => {
    setView((current) => (current === 'tools' ? 'config' : 'tools'));
  };

  /**
   * Updates the draft MCP tool allowlist from the Tools view checklist.
   *
   * @param exposedTools - Next allowlist in registry order.
   */
  const handleExposedToolsChange = (exposedTools: McpServerSettings['exposedTools']): void => {
    setServerSettings((current) => (current ? { ...current, exposedTools } : current));
  };

  const isRunning = serverStatus.running;
  const statusLabel = isRunning ? 'Running' : 'Stopped';

  /**
   * Panel heading with a status dot matching the Live Server panel pattern.
   */
  const title = (
    <div className="flex flex-col">
      <div className="flex items-center">
        <span className="mr-3">MCP Server</span>
        <StatusDot
          variant={isRunning ? 'success' : 'danger'}
          size="sm"
          label={statusLabel}
          title={statusLabel}
        />
      </div>
      <span className="truncate text-muted">Expose AI tools to external tools.</span>
    </div>
  );

  /**
   * Header actions rendered beside the close button once settings have loaded.
   */
  const headerButtons =
    !loading && serverSettings
      ? [
          <Button
            key="logs"
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={handleToggleLogsView}
          >
            {view === 'logs' ? 'Config' : 'Logs'}
          </Button>,
          <Button
            key="tools"
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={handleToggleToolsView}
          >
            {view === 'tools' ? 'Config' : 'Tools'}
          </Button>,
          <Button
            key="save"
            type="button"
            variant="secondary"
            disabled={saving}
            onClick={() => void handleSaveServer()}
          >
            Save
          </Button>,
          ...(isRunning
            ? [
                <Button
                  key="stop"
                  type="button"
                  variant="primaryDanger"
                  disabled={saving}
                  onClick={() => void handleStop()}
                >
                  Stop
                </Button>
              ]
            : [
                <Button
                  key="start"
                  type="button"
                  disabled={saving}
                  onClick={() => void handleStart()}
                >
                  Start
                </Button>
              ])
        ]
      : undefined;

  return (
    <FooterPanel
      id="footer-mcp-panel"
      open={open}
      onClose={onClose}
      closeLabel="MCP server"
      storageKey="hc.mcpPanelHeight"
      title={title}
      buttons={headerButtons}
    >
      {loading || !serverSettings ? (
        <p className="m-0 p-4 text-muted" role="status">
          Loading MCP settings…
        </p>
      ) : view === 'logs' ? (
        <div className="flex h-full min-h-0 flex-col">
          {error ? (
            <p className="m-0 shrink-0 px-4 pt-4 text-danger" role="alert">
              {error}
            </p>
          ) : null}
          <div className="min-h-0 flex-1">
            <McpLogsView
              query={logsController.query}
              onQueryChange={logsController.setQuery}
              matchOptions={logsController.matchOptions}
              onMatchOptionsChange={logsController.setMatchOptions}
              invalidRegex={logsController.invalidRegex}
              filteredRows={logsController.filteredRows}
              filterActive={logsController.filterActive}
              hiddenCount={logsController.hiddenCount}
              keepLogs={logsController.keepLogs}
            />
          </div>
        </div>
      ) : view === 'tools' ? (
        <McpToolsView
          exposedTools={serverSettings.exposedTools}
          onChange={handleExposedToolsChange}
          disabled={saving}
          error={error}
        />
      ) : (
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-auto p-4">
            {error ? (
              <p className="m-0 mb-4 text-danger" role="alert">
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
          </div>
        </form>
      )}
    </FooterPanel>
  );
}
