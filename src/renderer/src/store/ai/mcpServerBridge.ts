import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { executeAiToolCall } from '#/renderer/src/store/ai/aiToolExecutor';
import type { RootState } from '#/renderer/src/store/redux';
import { store } from '#/renderer/src/store/redux';

/**
 * Subscribes to MCP server tool invocations from external MCP clients and executes Harbor tools.
 */
export function startMcpServerBridge(): () => void {
  const unsubscribe = window.api.onMcpServerToolInvoke((message) => {
    void (async () => {
      const ctx = {
        getState: (): RootState => store.getState(),
        dispatch: store.dispatch as ThunkDispatch<RootState, unknown, UnknownAction>
      };

      try {
        const rawArgs =
          message.args == null || typeof message.args === 'string'
            ? String(message.args ?? '{}')
            : JSON.stringify(message.args);
        const result = await executeAiToolCall(message.name, rawArgs, ctx);
        window.api.completeMcpServerTool({
          requestId: message.requestId,
          ok: true,
          result
        });
      } catch (error) {
        window.api.completeMcpServerTool({
          requestId: message.requestId,
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    })();
  });

  return unsubscribe;
}
