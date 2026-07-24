import 'ses';
import type { ScriptRunInput, ScriptRunResult, SendRequestInput, SendResult } from '#/shared/types';
import { evaluateScript } from './scriptEvaluator';
import type { ScriptFileRequest } from './scriptFileOperations';

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

interface FileSuccessReply {
  kind: 'file-reply';
  runId: number;
  fileId: number;
  ok: true;
  result: unknown;
}

interface FileErrorReply {
  kind: 'file-reply';
  runId: number;
  fileId: number;
  ok: false;
  error: string;
}

type ParentReply = NetSuccessReply | NetErrorReply | FileSuccessReply | FileErrorReply;

interface PendingNetworkCall {
  resolve: (result: SendResult) => void;
  reject: (error: Error) => void;
}

interface PendingFileCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

let nextNetId = 1;
const pendingNetworkCalls = new Map<number, PendingNetworkCall>();

let nextFileId = 1;
const pendingFileCalls = new Map<number, PendingFileCall>();

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
 * Rejects every pending hc.fs / hc.parse promise when the runner shuts down.
 *
 * @param message - Error message applied to each pending file call.
 */
function rejectAllPendingFileCalls(message: string): void {
  for (const pending of pendingFileCalls.values()) {
    pending.reject(new Error(message));
  }
  pendingFileCalls.clear();
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
 * Builds the hc.fs / hc.parse transport that bridges to the main process runner host.
 *
 * @param runId - Correlation id for the active script run message.
 * @returns Async file-bridge function injected into the script sandbox.
 */
function createFileTransport(runId: number): (req: ScriptFileRequest) => Promise<unknown> {
  return (req) =>
    new Promise<unknown>((resolve, reject) => {
      const port = process.parentPort;
      if (!port) {
        reject(new Error('Script file bridge is unavailable'));
        return;
      }

      const fileId = nextFileId++;
      pendingFileCalls.set(fileId, { resolve, reject });
      port.postMessage({ kind: 'file', runId, fileId, req });
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
      sendRequest: createNetworkTransport(message.id),
      fileBridge: createFileTransport(message.id)
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

    if ('kind' in message && message.kind === 'file-reply') {
      const pending = pendingFileCalls.get(message.fileId);
      if (!pending) {
        return;
      }
      pendingFileCalls.delete(message.fileId);
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
  rejectAllPendingFileCalls('Script runner exited');
});
