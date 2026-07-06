import { ipcMain } from 'electron';
import { applyMcpServerSettings, getMcpServerStatus } from '#/main/mcpServer/mcpServer';
import { getMcpToolBridge } from '#/main/mcpServer/hostBridge';
import {
  callMcpClientTool,
  listMcpClientServerStatuses,
  listMcpClientToolInfos,
  refreshMcpClientConnections
} from '#/main/mcp/mcpClientManager';
import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import {
  deleteMcpClientServer,
  ensureMcpServerToken,
  getMcpServerSettings,
  listMcpClientServers,
  regenerateMcpServerToken,
  saveMcpClientServer,
  setMcpServerSettings
} from '#/main/settings/mcpSettings';

/**
 * Registers IPC handlers for MCP server and client configuration.
 */
export function registerMcpHandlers(): void {
  handle('mcp:getServerSettings', ipcArgSchemas.none, () => getMcpServerSettings());

  handle('mcp:setServerSettings', ipcArgSchemas.mcpServerSettings, async (_event, settings) => {
    const normalized = ensureMcpServerToken(setMcpServerSettings(settings));
    await applyMcpServerSettings(normalized);
    return normalized;
  });

  handle('mcp:getServerStatus', ipcArgSchemas.none, () => getMcpServerStatus());

  handle('mcp:regenerateToken', ipcArgSchemas.none, async () => {
    const settings = regenerateMcpServerToken();
    await applyMcpServerSettings(settings);
    return settings;
  });

  handle('mcp:listClientServers', ipcArgSchemas.none, () => listMcpClientServers());

  handle('mcp:saveClientServer', ipcArgSchemas.mcpClientServer, async (_event, server) => {
    const servers = saveMcpClientServer(server);
    await refreshMcpClientConnections();
    return servers;
  });

  handle('mcp:deleteClientServer', ipcArgSchemas.connectionId, async (_event, id) => {
    const servers = deleteMcpClientServer(id);
    await refreshMcpClientConnections();
    return servers;
  });

  handle('mcp:listClientServerStatuses', ipcArgSchemas.none, () => listMcpClientServerStatuses());

  handle('mcp:listClientTools', ipcArgSchemas.none, () => listMcpClientToolInfos());

  handle('mcp:callTool', ipcArgSchemas.mcpCallTool, async (_event, prefixedName, args) =>
    callMcpClientTool(prefixedName, args)
  );

  ipcMain.on(
    'mcp:serverToolComplete',
    (_event, message: { requestId: number; ok: boolean; result?: string; error?: string }) => {
      getMcpToolBridge().completeToolInvoke(message);
    }
  );
}

/**
 * Initializes MCP runtime state from persisted settings on app startup.
 */
export async function bootstrapMcpHost(): Promise<void> {
  const settings = getMcpServerSettings();
  await applyMcpServerSettings(settings);
  await refreshMcpClientConnections();
}
