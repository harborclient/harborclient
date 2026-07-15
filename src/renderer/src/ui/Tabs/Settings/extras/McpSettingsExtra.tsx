import {
  Button,
  Checkbox,
  FieldError,
  FormGroup,
  Input,
  Modal,
  ModalFooter,
  ModalFormLayout,
  ResourceList,
  ResourceListPrimary,
  ResourceListRow,
  SettingSectionHeading,
  Textarea
} from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import { AI_TOOL_NAMES, type AiToolName } from '#/shared/ai/tools';
import type {
  McpClientHeader,
  McpClientServer,
  McpClientServerListItem,
  McpClientServerStatus,
  McpServerSettings,
  McpServerStatus
} from '#/shared/types';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/Shared/classes';
import { McpServerFormFields } from '#/renderer/src/ui/Shared/Mcp/McpServerFormFields';
import { buildMcpConfigSnippet } from '#/renderer/src/ui/Shared/Mcp/buildMcpConfigSnippet';
import {
  formatMcpClientHeadersDraft,
  MCP_CLIENT_HEADERS_PLACEHOLDER,
  parseMcpClientHeadersDraft
} from '#/renderer/src/ui/Shared/Mcp/mcpClientHeadersDraft';
import {
  MCP_CLIENT_SERVER_IMPORT_PLACEHOLDER,
  parseMcpClientServerImportSnippet
} from '#/renderer/src/ui/Shared/Mcp/parseMcpClientServerImport';
import { formatIpcErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';

const MCP_MUTATING_TOOLS: readonly AiToolName[] = [
  'send_active_request',
  'set_active_environment',
  'update_active_request',
  'update_request_script',
  'create_collection',
  'create_folder',
  'create_request'
];

const MCP_READ_TOOLS = AI_TOOL_NAMES.filter(
  (name) => !(MCP_MUTATING_TOOLS as readonly string[]).includes(name)
);

/**
 * Creates a blank MCP client server row for the add-server modal.
 */
function createBlankMcpClientServer(): McpClientServer {
  return {
    id: '',
    name: '',
    url: '',
    headers: [],
    enabled: true
  };
}

/**
 * MCP server and client settings rendered below the AI API key fields.
 */
export function McpSettingsExtra(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverSettings, setServerSettings] = useState<McpServerSettings | null>(null);
  const [serverStatus, setServerStatus] = useState<McpServerStatus>({ running: false });
  const [clientServers, setClientServers] = useState<McpClientServerListItem[]>([]);
  const [clientStatuses, setClientStatuses] = useState<McpClientServerStatus[]>([]);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);
  const [editingServer, setEditingServer] = useState<McpClientServer | null>(null);
  const [clientHeadersDraft, setClientHeadersDraft] = useState('');
  const [clientServerImportOpen, setClientServerImportOpen] = useState(false);
  const [clientServerImportDraft, setClientServerImportDraft] = useState('');
  const [clientServerImportError, setClientServerImportError] = useState<string | null>(null);
  const [deletingServerId, setDeletingServerId] = useState<string | null>(null);
  const [clientFieldErrors, setClientFieldErrors] = useState<Record<string, string>>({});

  /**
   * Loads MCP client server rows and connection statuses.
   */
  const loadClientServers = async (): Promise<void> => {
    const [servers, statuses] = await Promise.all([
      window.api.listMcpClientServers(),
      window.api.listMcpClientServerStatuses()
    ]);
    setClientServers(servers);
    setClientStatuses(statuses);
  };

  /**
   * Loads MCP settings when the section mounts.
   */
  useEffect(() => {
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
        await loadClientServers();
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
  }, []);

  /**
   * Refreshes MCP client server rows when plugin registrations change.
   */
  useEffect(() => {
    const unsubscribe = window.api.onMcpClientServersChanged(() => {
      void loadClientServers().catch((loadError) => {
        setError(formatIpcErrorMessage(loadError, 'Failed to refresh MCP client servers.'));
      });
    });
    return unsubscribe;
  }, []);

  const statusById = useMemo(() => {
    return new Map(clientStatuses.map((status) => [status.id, status]));
  }, [clientStatuses]);

  if (loading || !serverSettings) {
    return (
      <p className="text-[14px] text-muted" role="status">
        Loading MCP settings…
      </p>
    );
  }

  /**
   * Persists MCP server settings and refreshes runtime status.
   */
  const handleSaveServer = async (): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      const saved = await window.api.setMcpServerSettings(serverSettings);
      const status = await window.api.getMcpServerStatus();
      setServerSettings(saved);
      setServerStatus(status);
      toast.success('MCP server settings saved.');
    } catch (saveError) {
      setError(formatIpcErrorMessage(saveError, 'Failed to save MCP server settings.'));
    } finally {
      setSaving(false);
    }
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
    void navigator.clipboard.writeText(serverSettings.token).then(() => {
      setTokenCopied(true);
    });
  };

  /**
   * Copies the external MCP client configuration snippet to the clipboard.
   */
  const handleCopyConfig = (): void => {
    const snippet = buildMcpConfigSnippet(serverSettings, serverStatus);
    void navigator.clipboard.writeText(snippet).then(() => {
      setConfigCopied(true);
      toast.success('MCP config copied.');
    });
  };

  /**
   * Toggles one exposed Harbor tool in the MCP server allowlist.
   *
   * @param toolName - Harbor AI tool name.
   * @param checked - Whether the tool should be exposed.
   */
  const handleToggleExposedTool = (toolName: AiToolName, checked: boolean): void => {
    setServerSettings((current) => {
      if (!current) {
        return current;
      }
      const next = new Set(current.exposedTools);
      if (checked) {
        next.add(toolName);
      } else {
        next.delete(toolName);
      }
      return {
        ...current,
        exposedTools: [...next]
      };
    });
  };

  /**
   * Toggles all tools in one MCP server tool section on or off.
   *
   * @param sectionTools - Tool names in the section being toggled.
   * @param checked - Whether every tool in the section should be exposed.
   */
  const setSectionExposedTools = (sectionTools: readonly AiToolName[], checked: boolean): void => {
    setServerSettings((current) => {
      if (!current) {
        return current;
      }
      const next = new Set(current.exposedTools);
      for (const tool of sectionTools) {
        if (checked) {
          next.add(tool);
        } else {
          next.delete(tool);
        }
      }
      return {
        ...current,
        exposedTools: [...next]
      };
    });
  };

  /**
   * Opens the MCP client server modal and initializes the headers draft text.
   *
   * @param server - Server row to edit, or a blank row for add.
   */
  const openClientServerEditor = (server: McpClientServer): void => {
    setClientFieldErrors({});
    setClientHeadersDraft(formatMcpClientHeadersDraft(server.headers));
    setEditingServer(server);
  };

  /**
   * Closes the MCP client server modal and clears draft state.
   */
  const closeClientServerEditor = (): void => {
    setEditingServer(null);
    setClientHeadersDraft('');
    setClientFieldErrors({});
    closeClientServerImport();
  };

  /**
   * Opens the import modal for pasting Cursor-style MCP server config.
   */
  const openClientServerImport = (): void => {
    setClientServerImportDraft('');
    setClientServerImportError(null);
    setClientServerImportOpen(true);
  };

  /**
   * Closes the import modal without applying changes.
   */
  const closeClientServerImport = (): void => {
    setClientServerImportOpen(false);
    setClientServerImportDraft('');
    setClientServerImportError(null);
  };

  /**
   * Applies a pasted MCP server config snippet to the add/edit form.
   */
  const handleApplyClientServerImport = (): void => {
    if (!editingServer) {
      return;
    }

    const importResult = parseMcpClientServerImportSnippet(clientServerImportDraft);
    if (!importResult.ok) {
      setClientServerImportError(importResult.error);
      return;
    }

    setEditingServer({
      ...editingServer,
      name: importResult.result.name,
      url: importResult.result.url
    });
    setClientHeadersDraft(formatMcpClientHeadersDraft(importResult.result.headers));
    setClientFieldErrors((current) => {
      const next = { ...current };
      delete next.name;
      delete next.url;
      delete next.headers;
      return next;
    });
    closeClientServerImport();
  };

  /**
   * Validates and saves one MCP client server row.
   */
  const handleSaveClientServer = async (): Promise<void> => {
    if (!editingServer) {
      return;
    }

    const fieldErrors: Record<string, string> = {};
    if (!editingServer.name.trim()) {
      fieldErrors.name = 'Name is required.';
    }
    if (!editingServer.url.trim()) {
      fieldErrors.url = 'URL is required.';
    }

    let headers: McpClientHeader[] = [];
    const headersResult = parseMcpClientHeadersDraft(clientHeadersDraft);
    if (!headersResult.ok) {
      fieldErrors.headers = headersResult.error;
    } else {
      headers = headersResult.headers;
    }

    setClientFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const servers = await window.api.saveMcpClientServer({
        ...editingServer,
        headers
      });
      const statuses = await window.api.listMcpClientServerStatuses();
      setClientServers(servers);
      setClientStatuses(statuses);
      closeClientServerEditor();
      toast.success('MCP client server saved.');
    } catch (saveError) {
      setError(formatIpcErrorMessage(saveError, 'Failed to save MCP client server.'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Deletes one MCP client server after confirmation.
   */
  const handleDeleteClientServer = async (): Promise<void> => {
    if (!deletingServerId) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const servers = await window.api.deleteMcpClientServer(deletingServerId);
      const statuses = await window.api.listMcpClientServerStatuses();
      setClientServers(servers);
      setClientStatuses(statuses);
      setDeletingServerId(null);
      toast.success('MCP client server deleted.');
    } catch (deleteError) {
      setError(formatIpcErrorMessage(deleteError, 'Failed to delete MCP client server.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p className="text-[14px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <SettingSectionHeading
          settingId="mcp.server"
          title="MCP Server"
          description="Expose selected Harbor tools to external MCP clients such as Claude Desktop or Cursor. Nothing is exposed until you enable the server and select tools below."
        />

        <div className="flex flex-col gap-4">
          <McpServerFormFields
            settings={serverSettings}
            status={serverStatus}
            saving={saving}
            onChange={setServerSettings}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={handleRegenerateToken}
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

          <div>
            <p className="mb-2 font-medium text-text">Read-only tools</p>
            <div className="flex flex-col gap-2">
              <FormGroup
                className="border-none!"
                label="Check all"
                layout="checkbox"
                htmlFor="mcp-read-tools-check-all"
              >
                <Checkbox
                  id="mcp-read-tools-check-all"
                  checked={MCP_READ_TOOLS.every((toolName) =>
                    serverSettings.exposedTools.includes(toolName)
                  )}
                  disabled={saving}
                  onChange={(event) => setSectionExposedTools(MCP_READ_TOOLS, event.target.checked)}
                />
              </FormGroup>
              {MCP_READ_TOOLS.map((toolName) => (
                <FormGroup key={toolName} label={toolName} layout="checkbox">
                  <Checkbox
                    checked={serverSettings.exposedTools.includes(toolName)}
                    disabled={saving}
                    onChange={(event) => handleToggleExposedTool(toolName, event.target.checked)}
                  />
                </FormGroup>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-medium text-text">Mutating tools</p>
            <p className="m-0 mb-2 text-muted">
              These can send HTTP requests or change editor drafts. Leave unchecked unless you trust
              every MCP client that can reach this server.
            </p>
            <div className="flex flex-col gap-2">
              <FormGroup
                className="border-none!"
                label="Check all"
                layout="checkbox"
                htmlFor="mcp-mutating-tools-check-all"
              >
                <Checkbox
                  id="mcp-mutating-tools-check-all"
                  checked={MCP_MUTATING_TOOLS.every((toolName) =>
                    serverSettings.exposedTools.includes(toolName)
                  )}
                  disabled={saving}
                  onChange={(event) =>
                    setSectionExposedTools(MCP_MUTATING_TOOLS, event.target.checked)
                  }
                />
              </FormGroup>
              {MCP_MUTATING_TOOLS.map((toolName) => (
                <FormGroup key={toolName} label={toolName} layout="checkbox">
                  <Checkbox
                    checked={serverSettings.exposedTools.includes(toolName)}
                    disabled={saving}
                    onChange={(event) => handleToggleExposedTool(toolName, event.target.checked)}
                  />
                </FormGroup>
              ))}
            </div>
          </div>

          <Button type="button" disabled={saving} onClick={() => void handleSaveServer()}>
            {saving ? 'Saving…' : 'Save MCP server'}
          </Button>
        </div>
      </section>

      <section>
        <SettingSectionHeading
          settingId="mcp.client"
          title="MCP Client"
          description={
            <>
              Connect Harbor&apos;s chat agent to remote MCP servers over HTTP or SSE. Discovered
              tools are prefixed with <code className="font-mono">mcp__</code> in the agent tool
              list.
            </>
          }
        />

        <div className="mb-4 flex items-center gap-3">
          <Button
            type="button"
            disabled={saving}
            onClick={() => openClientServerEditor(createBlankMcpClientServer())}
          >
            Add server
          </Button>
        </div>

        <ResourceList>
          {clientServers.length === 0 ? (
            <p className="m-0 px-2 py-3 text-[14px] text-muted">
              No MCP client servers configured.
            </p>
          ) : (
            clientServers.map((server) => {
              const status = statusById.get(server.id);
              const statusLabel = status
                ? status.connected
                  ? `${status.toolCount} tools`
                  : (status.error ?? 'Not connected')
                : '';
              const pluginAttribution =
                server.source === 'plugin' && server.pluginName
                  ? `Provided by ${server.pluginName}`
                  : null;
              return (
                <ResourceListRow
                  key={server.id}
                  primary={
                    <ResourceListPrimary>
                      <span className="flex items-center gap-2">
                        {server.icon ? (
                          <img
                            src={server.icon}
                            alt=""
                            aria-hidden
                            className="h-5 w-5 shrink-0 rounded-sm object-cover"
                          />
                        ) : null}
                        <span>{server.name}</span>
                      </span>
                      <span className="block text-[14px] font-normal text-muted">
                        {server.url}
                        {statusLabel ? ` · ${statusLabel}` : ''}
                        {pluginAttribution ? ` · ${pluginAttribution}` : ''}
                      </span>
                    </ResourceListPrimary>
                  }
                  actions={
                    server.readonly ? (
                      <span className="text-[14px] text-muted" aria-label="Plugin-provided server">
                        Plugin
                      </span>
                    ) : (
                      <>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={saving}
                          onClick={() => openClientServerEditor(server)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={saving}
                          onClick={() => setDeletingServerId(server.id)}
                        >
                          Delete
                        </Button>
                      </>
                    )
                  }
                />
              );
            })
          )}
        </ResourceList>
      </section>

      {editingServer ? (
        <Modal
          className="w-[560px]"
          overlayClassName="z-[60]"
          labelledBy="mcp-client-server-title"
          onClose={closeClientServerEditor}
          title={editingServer.id ? 'Edit MCP client server' : 'Add MCP client server'}
        >
          <ModalFormLayout>
            <div className="flex flex-col gap-4">
              <FormGroup
                label="Name"
                htmlFor="mcp-client-name"
                error={
                  clientFieldErrors.name ? (
                    <FieldError>{clientFieldErrors.name}</FieldError>
                  ) : undefined
                }
              >
                <Input
                  id="mcp-client-name"
                  type="text"
                  variant="surface"
                  value={editingServer.name}
                  disabled={saving}
                  onChange={(event) =>
                    setEditingServer({ ...editingServer, name: event.target.value })
                  }
                />
              </FormGroup>
              <FormGroup
                label="Server URL"
                htmlFor="mcp-client-url"
                error={
                  clientFieldErrors.url ? (
                    <FieldError>{clientFieldErrors.url}</FieldError>
                  ) : undefined
                }
              >
                <Input
                  id="mcp-client-url"
                  type="url"
                  variant="surface"
                  value={editingServer.url}
                  disabled={saving}
                  onChange={(event) =>
                    setEditingServer({ ...editingServer, url: event.target.value })
                  }
                />
              </FormGroup>
              <FormGroup label="Enabled" layout="checkbox">
                <Checkbox
                  checked={editingServer.enabled}
                  disabled={saving}
                  onChange={(event) =>
                    setEditingServer({ ...editingServer, enabled: event.target.checked })
                  }
                />
              </FormGroup>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={openClientServerImport}
                >
                  Import from MCP config
                </Button>
              </div>
              <FormGroup
                label="Headers (optional JSON)"
                htmlFor="mcp-client-headers"
                error={
                  clientFieldErrors.headers ? (
                    <FieldError id="mcp-client-headers-error">
                      {clientFieldErrors.headers}
                    </FieldError>
                  ) : undefined
                }
              >
                <p
                  id="mcp-client-headers-help"
                  className="hc-form-group-description m-0 text-[14px] text-muted"
                >
                  Optional HTTP headers sent with MCP requests. Each array entry is one object with
                  a single header name as its key, for example{' '}
                  <code className="font-mono">{`{ "Authorization": "Bearer …" }`}</code>. Use{' '}
                  <code className="font-mono">[]</code> for no headers.
                </p>
                <Textarea
                  id="mcp-client-headers"
                  variant="surface"
                  className="mt-2 h-28 resize-none font-mono text-[14px]"
                  value={clientHeadersDraft}
                  placeholder={MCP_CLIENT_HEADERS_PLACEHOLDER}
                  disabled={saving}
                  aria-invalid={clientFieldErrors.headers ? true : undefined}
                  aria-describedby={
                    clientFieldErrors.headers
                      ? 'mcp-client-headers-help mcp-client-headers-error'
                      : 'mcp-client-headers-help'
                  }
                  onChange={(event) => {
                    setClientHeadersDraft(event.target.value);
                    if (clientFieldErrors.headers) {
                      setClientFieldErrors((current) => {
                        const next = { ...current };
                        delete next.headers;
                        return next;
                      });
                    }
                  }}
                />
              </FormGroup>
            </div>
          </ModalFormLayout>
          <ModalFooter spaced>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={closeClientServerEditor}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void handleSaveClientServer()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}

      {editingServer && clientServerImportOpen ? (
        <Modal
          className="w-[560px]"
          overlayClassName="z-[70]"
          labelledBy="mcp-client-server-import-title"
          onClose={closeClientServerImport}
          title="Import MCP client server"
          description="Paste one server entry from a Cursor or Claude Desktop mcpServers config."
        >
          <ModalFormLayout>
            <FormGroup
              label="MCP server config"
              htmlFor="mcp-client-server-import"
              error={
                clientServerImportError ? (
                  <FieldError id="mcp-client-server-import-error">
                    {clientServerImportError}
                  </FieldError>
                ) : undefined
              }
            >
              <Textarea
                id="mcp-client-server-import"
                variant="surface"
                className="h-40 resize-none font-mono text-[14px]"
                value={clientServerImportDraft}
                placeholder={MCP_CLIENT_SERVER_IMPORT_PLACEHOLDER}
                disabled={saving}
                aria-invalid={clientServerImportError ? true : undefined}
                aria-describedby={
                  clientServerImportError ? 'mcp-client-server-import-error' : undefined
                }
                onChange={(event) => {
                  setClientServerImportDraft(event.target.value);
                  if (clientServerImportError) {
                    setClientServerImportError(null);
                  }
                }}
              />
            </FormGroup>
          </ModalFormLayout>
          <ModalFooter spaced>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={closeClientServerImport}
            >
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={handleApplyClientServerImport}>
              Import
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}

      {deletingServerId ? (
        <Modal
          className="w-[480px]"
          overlayClassName="z-[60]"
          labelledBy="mcp-client-delete-title"
          onClose={() => setDeletingServerId(null)}
          title="Delete MCP client server?"
          description="Harbor will disconnect from this server and remove it from the chat agent tool list."
        >
          <ModalFooter spaced>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={() => setDeletingServerId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className={toolbarDangerButtonClass}
              disabled={saving}
              onClick={() => void handleDeleteClientServer()}
            >
              Delete
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </div>
  );
}
