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
import type {
  McpClientHeader,
  McpClientServer,
  McpClientServerListItem,
  McpClientServerStatus
} from '@harborclient/core/types';
import { toolbarDangerButtonClass } from '#/renderer/src/ui/Shared/classes';
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
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftMcpServerEnabled,
  selectSettingsDraftDisabled,
  setDraftMcpServerEnabled
} from '#/renderer/src/store/slices/settingsDraftSlice';

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
 * MCP enable toggle and client server list rendered below the AI API key fields.
 *
 * MCP server bind host, token, tools, and logs are configured from the footer panel.
 */
export function McpSettingsExtra(): JSX.Element {
  const dispatch = useAppDispatch();
  const mcpServerEnabled = useAppSelector(selectDraftMcpServerEnabled);
  const draftDisabled = useAppSelector(selectSettingsDraftDisabled);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientServers, setClientServers] = useState<McpClientServerListItem[]>([]);
  const [clientStatuses, setClientStatuses] = useState<McpClientServerStatus[]>([]);
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
   * Loads MCP client servers when the section mounts.
   */
  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await loadClientServers();
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(formatIpcErrorMessage(loadError, 'Failed to load MCP client servers.'));
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

  if (loading) {
    return (
      <p className="text-[14px] text-muted" role="status">
        Loading MCP settings…
      </p>
    );
  }

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
          description="Expose Harbor AI tools to external MCP clients such as Claude Desktop or Cursor. Enabling shows the footer MCP button; start and stop the server from that panel. Configure bind host, token, tools, and logs there as well."
        />

        <FormGroup label="Enable MCP server" layout="checkbox" htmlFor="settings-mcp-enabled">
          <Checkbox
            id="settings-mcp-enabled"
            checked={mcpServerEnabled}
            disabled={draftDisabled}
            onChange={(event) => {
              dispatch(setDraftMcpServerEnabled(event.target.checked));
            }}
          />
        </FormGroup>
      </section>

      <section>
        <SettingSectionHeading
          settingId="mcp.client"
          title="MCP Clients"
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
