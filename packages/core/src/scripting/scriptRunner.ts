import 'ses';
import type { ScriptRunInput, ScriptRunResult, SendRequestInput, SendResult } from '../types';
import { evaluateScript } from './scriptEvaluator';
import type { ScriptAskRequest, ScriptWebpageRequest } from './scriptApi';
import type { ScriptFileRequest } from './scriptFileOperations';

// errorTaming 'unsafe' keeps Error.prototype.stack intact. The default 'safe'
// censors stacks to '', which leaves assertion failures with no frame to remap
// to a user script line/column.
lockdown({ errorTaming: 'unsafe' });

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

interface AskSuccessReply {
  kind: 'ask-reply';
  runId: number;
  askId: number;
  ok: true;
  result: string | null;
}

interface AskErrorReply {
  kind: 'ask-reply';
  runId: number;
  askId: number;
  ok: false;
  error: string;
}

interface WebpageSuccessReply {
  kind: 'webpage-reply';
  runId: number;
  webpageId: number;
  ok: true;
  result: unknown;
}

interface WebpageErrorReply {
  kind: 'webpage-reply';
  runId: number;
  webpageId: number;
  ok: false;
  error: string;
}

type ParentReply =
  | NetSuccessReply
  | NetErrorReply
  | FileSuccessReply
  | FileErrorReply
  | AskSuccessReply
  | AskErrorReply
  | WebpageSuccessReply
  | WebpageErrorReply;

interface PendingNetworkCall {
  resolve: (result: SendResult) => void;
  reject: (error: Error) => void;
}

interface PendingFileCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

interface PendingAskCall {
  resolve: (result: string | null) => void;
  reject: (error: Error) => void;
}

interface PendingWebpageCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * Minimal Electron utility-process port shape used by this portable runner.
 */
interface UtilityProcessPort {
  /**
   * Posts a structured message to the parent process.
   *
   * @param message - Structured message for the host.
   */
  postMessage(message: unknown): void;

  /**
   * Registers a handler for structured parent messages.
   *
   * @param event - Electron message listener.
   */
  on(event: 'message', listener: (event: { data: unknown }) => void): void;
}

const utilityProcess = process as typeof process & { parentPort?: UtilityProcessPort };

let nextNetId = 1;
const pendingNetworkCalls = new Map<number, PendingNetworkCall>();

let nextFileId = 1;
const pendingFileCalls = new Map<number, PendingFileCall>();

let nextAskId = 1;
const pendingAskCalls = new Map<number, PendingAskCall>();

let nextWebpageId = 1;
const pendingWebpageCalls = new Map<number, PendingWebpageCall>();

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
 * Rejects every pending hc.ask promise when the runner shuts down.
 *
 * @param message - Error message applied to each pending ask call.
 */
function rejectAllPendingAskCalls(message: string): void {
  for (const pending of pendingAskCalls.values()) {
    pending.reject(new Error(message));
  }
  pendingAskCalls.clear();
}

/**
 * Rejects every pending hc.webpage promise when the runner shuts down.
 *
 * @param message - Error message applied to each pending webpage call.
 */
function rejectAllPendingWebpageCalls(message: string): void {
  for (const pending of pendingWebpageCalls.values()) {
    pending.reject(new Error(message));
  }
  pendingWebpageCalls.clear();
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
      const port = utilityProcess.parentPort;
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
      const port = utilityProcess.parentPort;
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
 * Builds the hc.ask transport that bridges to the main process runner host.
 *
 * @param runId - Correlation id for the active script run message.
 * @returns Async ask function injected into the script sandbox.
 */
function createAskTransport(runId: number): (req: ScriptAskRequest) => Promise<string | null> {
  return (req) =>
    new Promise<string | null>((resolve, reject) => {
      const port = utilityProcess.parentPort;
      if (!port) {
        reject(new Error('Script ask bridge is unavailable'));
        return;
      }

      const askId = nextAskId++;
      pendingAskCalls.set(askId, { resolve, reject });
      port.postMessage({ kind: 'ask', runId, askId, req });
    });
}

/**
 * Builds the hc.webpage transport that bridges to the main process runner host.
 *
 * @param runId - Correlation id for the active script run message.
 * @returns Async webpage function injected into the script sandbox.
 */
function createWebpageTransport(runId: number): (req: ScriptWebpageRequest) => Promise<unknown> {
  return (req) =>
    new Promise<unknown>((resolve, reject) => {
      const port = utilityProcess.parentPort;
      if (!port) {
        reject(new Error('Script webpage bridge is unavailable'));
        return;
      }

      const webpageId = nextWebpageId++;
      pendingWebpageCalls.set(webpageId, { resolve, reject });
      port.postMessage({ kind: 'webpage', runId, webpageId, req });
    });
}

/**
 * Handles a single script run request from the main process.
 *
 * @param message - Correlation id and script input payload.
 */
async function handleRunMessage(message: RunMessage): Promise<void> {
  const port = utilityProcess.parentPort;
  if (!port) {
    return;
  }

  try {
    const result = await evaluateScript(message.input, {
      sendRequest: createNetworkTransport(message.id),
      fileBridge: createFileTransport(message.id),
      ask: createAskTransport(message.id),
      webpage: createWebpageTransport(message.id)
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

const port = utilityProcess.parentPort;
if (port) {
  port.on('message', (event: { data: unknown }) => {
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

    if ('kind' in message && message.kind === 'ask-reply') {
      const pending = pendingAskCalls.get(message.askId);
      if (!pending) {
        return;
      }
      pendingAskCalls.delete(message.askId);
      if (message.ok) {
        pending.resolve(message.result);
      } else {
        pending.reject(new Error(message.error));
      }
      return;
    }

    if ('kind' in message && message.kind === 'webpage-reply') {
      const pending = pendingWebpageCalls.get(message.webpageId);
      if (!pending) {
        return;
      }
      pendingWebpageCalls.delete(message.webpageId);
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
  rejectAllPendingAskCalls('Script runner exited');
  rejectAllPendingWebpageCalls('Script runner exited');
});
