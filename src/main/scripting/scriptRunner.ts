import 'ses';
import type { ScriptRunInput, ScriptRunResult, SendRequestInput, SendResult } from '#/shared/types';
import { evaluateScript } from '#/main/scripting/scriptEvaluator';

lockdown();

interface RunMessage {
  id: number;
  input: ScriptRunInput;
}

interface SuccessReply {
  id: number;
  ok: true;
  result: ScriptRunResult;
}

interface ErrorReply {
  id: number;
  ok: false;
  error: string;
}

interface NetSuccessReply {
  kind: 'net-reply';
  runId: number;
  netId: number;
  ok: true;
  result: SendResult;
}

interface NetErrorReply {
  kind: 'net-reply';
  runId: number;
  netId: number;
  ok: false;
  error: string;
}

type ParentReply = NetSuccessReply | NetErrorReply;

interface PendingNetworkCall {
  resolve: (result: SendResult) => void;
  reject: (error: Error) => void;
}

let nextNetId = 1;
const pendingNetworkCalls = new Map<number, PendingNetworkCall>();

/**
 * Rejects every pending hc.sendRequest promise when the runner shuts down.
 *
 * @param message - Error message applied to each pending network call.
 */
function rejectAllPendingNetworkCalls(message: string): void {
  for (const pending of pendingNetworkCalls.values()) {
    pending.reject(new Error(message));
  }
  pendingNetworkCalls.clear();
}

/**
 * Builds the hc.sendRequest transport that bridges to the main process runner host.
 *
 * @param runId - Correlation id for the active script run message.
 * @returns Async send function injected into the script sandbox.
 */
function createNetworkTransport(runId: number): (req: SendRequestInput) => Promise<SendResult> {
  return (req) =>
    new Promise<SendResult>((resolve, reject) => {
      const port = process.parentPort;
      if (!port) {
        reject(new Error('Script network bridge is unavailable'));
        return;
      }

      const netId = nextNetId++;
      pendingNetworkCalls.set(netId, { resolve, reject });
      port.postMessage({ kind: 'net', runId, netId, req });
    });
}

/**
 * Handles a single script run request from the main process.
 *
 * @param message - Correlation id and script input payload.
 */
async function handleRunMessage(message: RunMessage): Promise<void> {
  const port = process.parentPort;
  if (!port) {
    return;
  }

  try {
    const result = await evaluateScript(message.input, {
      sendRequest: createNetworkTransport(message.id)
    });
    const reply: SuccessReply = { id: message.id, ok: true, result };
    port.postMessage(reply);
  } catch (err) {
    const rawMessage =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : String(err);
    const reply: ErrorReply = { id: message.id, ok: false, error: rawMessage };
    port.postMessage(reply);
  }
}

const port = process.parentPort;
if (port) {
  port.on('message', (event) => {
    const message = event.data as RunMessage | ParentReply;

    if ('kind' in message && message.kind === 'net-reply') {
      const pending = pendingNetworkCalls.get(message.netId);
      if (!pending) {
        return;
      }
      pendingNetworkCalls.delete(message.netId);
      if (message.ok) {
        pending.resolve(message.result);
      } else {
        pending.reject(new Error(message.error));
      }
      return;
    }

    void handleRunMessage(message as RunMessage);
  });
}

process.on('exit', () => {
  rejectAllPendingNetworkCalls('Script runner exited');
});
