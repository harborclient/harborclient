import { channel, type ChannelListener } from 'node:diagnostics_channel';
import type { IRequestTiming, IRequestTimingSession } from './IRequestTiming.js';
import type { HttpMethod, RequestTimingPhases } from './types.js';

const CONNECT_BUFFER_LIMIT = 50;

const beforeConnectChannel = channel('undici:client:beforeConnect');
const connectedChannel = channel('undici:client:connected');
const connectErrorChannel = channel('undici:client:connectError');
const requestCreateChannel = channel('undici:request:create');
const sendHeadersChannel = channel('undici:client:sendHeaders');
const bodySentChannel = channel('undici:request:bodySent');
const responseHeadersChannel = channel('undici:request:headers');

interface ConnectAttempt {
  /**
   * Normalized connection target key from undici connect params.
   */
  key: string;

  /**
   * Timestamp before undici starts opening the socket.
   */
  beforeConnectAt: number;

  /**
   * Whether this buffered attempt has already been paired with a result event.
   */
  consumed: boolean;
}

interface ConnectTimes {
  /**
   * Timestamp before undici starts opening the socket.
   */
  beforeConnectAt: number;

  /**
   * Timestamp after the socket is connected and ready for use.
   */
  connectedAt: number;
}

const connectAttempts: ConnectAttempt[] = [];
const socketConnectTimes = new WeakMap<object, ConnectTimes>();

/**
 * Returns true when an unknown value can be safely indexed as an object record.
 *
 * @param value - Value to inspect.
 * @returns Whether the value is an object record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Returns true when an unknown value is usable as a WeakMap object key.
 *
 * @param value - Value to inspect.
 * @returns Whether the value is an object or function.
 */
function isWeakMapKey(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

/**
 * Reads a string field from an object record.
 *
 * @param record - Object containing diagnostics payload fields.
 * @param key - Field name to read.
 * @returns String field value, if present.
 */
function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Reads a string or number field and normalizes it for connection matching.
 *
 * @param record - Object containing diagnostics payload fields.
 * @param key - Field name to read.
 * @returns Normalized field value, if present.
 */
function readKeyPart(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return '';
}

/**
 * Builds a stable key from undici connection parameters.
 *
 * @param connectParams - Raw connectParams diagnostics payload value.
 * @returns Normalized key, or null when required fields are missing.
 */
function connectKey(connectParams: unknown): string | null {
  if (!isRecord(connectParams)) {
    return null;
  }

  const protocol = readString(connectParams, 'protocol');
  const host = readString(connectParams, 'host');
  const hostname = readString(connectParams, 'hostname');
  if (!protocol || (!host && !hostname)) {
    return null;
  }

  return [
    protocol,
    host ?? '',
    hostname ?? '',
    readKeyPart(connectParams, 'port'),
    readString(connectParams, 'servername') ?? ''
  ].join('|');
}

/**
 * Extracts a connection key from an undici client diagnostics message.
 *
 * @param message - Diagnostics payload.
 * @returns Normalized key, or null when unavailable.
 */
function connectKeyFromMessage(message: unknown): string | null {
  if (!isRecord(message)) {
    return null;
  }
  return connectKey(message['connectParams']);
}

/**
 * Finds and consumes the most recent unmatched connection attempt for a key.
 *
 * @param key - Normalized connection key.
 * @returns Matched attempt, if any.
 */
function consumeConnectAttempt(key: string): ConnectAttempt | undefined {
  for (let index = connectAttempts.length - 1; index >= 0; index -= 1) {
    const attempt = connectAttempts[index];
    if (!attempt.consumed && attempt.key === key) {
      attempt.consumed = true;
      return attempt;
    }
  }
  return undefined;
}

/**
 * Records the start of a new undici connection attempt.
 *
 * @param message - undici:client:beforeConnect payload.
 */
const handleBeforeConnect: ChannelListener = (message): void => {
  const key = connectKeyFromMessage(message);
  if (!key) {
    return;
  }

  connectAttempts.push({ key, beforeConnectAt: performance.now(), consumed: false });
  if (connectAttempts.length > CONNECT_BUFFER_LIMIT) {
    connectAttempts.splice(0, connectAttempts.length - CONNECT_BUFFER_LIMIT);
  }
};

/**
 * Records a completed connection attempt against its socket.
 *
 * @param message - undici:client:connected payload.
 */
const handleConnected: ChannelListener = (message): void => {
  const key = connectKeyFromMessage(message);
  if (!key || !isRecord(message)) {
    return;
  }

  const attempt = consumeConnectAttempt(key);
  const socket = message['socket'];
  if (attempt && isWeakMapKey(socket)) {
    socketConnectTimes.set(socket, {
      beforeConnectAt: attempt.beforeConnectAt,
      connectedAt: performance.now()
    });
  }
};

/**
 * Consumes a failed connection attempt so later successful sockets do not reuse it.
 *
 * @param message - undici:client:connectError payload.
 */
const handleConnectError: ChannelListener = (message): void => {
  const key = connectKeyFromMessage(message);
  if (key) {
    consumeConnectAttempt(key);
  }
};

beforeConnectChannel.subscribe(handleBeforeConnect);
connectedChannel.subscribe(handleConnected);
connectErrorChannel.subscribe(handleConnectError);

/**
 * Extracts the undici request object from a diagnostics payload.
 *
 * @param message - Diagnostics payload.
 * @returns Request object, if present.
 */
function requestFromMessage(message: unknown): object | undefined {
  if (!isRecord(message)) {
    return undefined;
  }

  const request = message['request'];
  return isWeakMapKey(request) ? request : undefined;
}

/**
 * Extracts the socket object from a diagnostics payload.
 *
 * @param message - Diagnostics payload.
 * @returns Socket object, if present.
 */
function socketFromMessage(message: unknown): object | undefined {
  if (!isRecord(message)) {
    return undefined;
  }

  const socket = message['socket'];
  return isWeakMapKey(socket) ? socket : undefined;
}

/**
 * Reads a string property from an undici request object.
 *
 * @param request - Undici internal request object.
 * @param key - Property to read.
 * @returns String property, if present.
 */
function readRequestString(request: object, key: string): string | undefined {
  return readString(request as Record<string, unknown>, key);
}

/**
 * Produces a non-negative rounded duration between two timestamps.
 *
 * @param start - Start timestamp.
 * @param end - End timestamp.
 * @returns Rounded millisecond duration.
 */
function durationMs(start: number, end: number): number {
  return Math.max(0, Math.round(end - start));
}

/**
 * Adds a phase value only when it is finite.
 *
 * @param phases - Mutable phase result object.
 * @param key - Phase key to assign.
 * @param value - Phase duration.
 */
function assignPhase(
  phases: RequestTimingPhases,
  key: keyof RequestTimingPhases,
  value: number
): void {
  if (Number.isFinite(value)) {
    phases[key] = Math.max(0, Math.round(value));
  }
}

/**
 * Captures diagnostics events for one request attempt.
 */
class RequestTimingSession implements IRequestTimingSession {
  private readonly targetOrigin: string;
  private readonly method: HttpMethod;
  private readonly listeners: Array<[ReturnType<typeof channel>, ChannelListener]> = [];
  private capturedRequest: object | undefined;
  private sendHeadersAt: number | undefined;
  private bodySentAt: number | undefined;
  private headersAt: number | undefined;
  private connectTimes: ConnectTimes | undefined;
  private stopped = false;

  /**
   * Creates and subscribes diagnostics listeners for one request attempt.
   *
   * @param requestStart - High-resolution timestamp taken before fetch starts.
   * @param targetUrl - Fully resolved URL for this request attempt.
   * @param method - HTTP method used for this request attempt.
   */
  constructor(
    private readonly requestStart: number,
    targetUrl: string,
    method: HttpMethod
  ) {
    this.targetOrigin = new URL(targetUrl).origin;
    this.method = method;
    this.subscribe(requestCreateChannel, this.handleCreate);
    this.subscribe(sendHeadersChannel, this.handleSendHeaders);
    this.subscribe(bodySentChannel, this.handleBodySent);
    this.subscribe(responseHeadersChannel, this.handleResponseHeaders);
  }

  /**
   * Unsubscribes all request-scoped listeners.
   */
  stop(): void {
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    for (const [diagnosticsChannel, listener] of this.listeners) {
      diagnosticsChannel.unsubscribe(listener);
    }
    this.listeners.length = 0;
  }

  /**
   * Derives best-effort timing phases from captured diagnostics.
   *
   * @param totalTimeMs - Total rounded request duration.
   * @returns Phase timings, or undefined if no request write was observed.
   */
  toPhases(totalTimeMs: number): RequestTimingPhases | undefined {
    if (this.sendHeadersAt == null) {
      return undefined;
    }

    const phases: RequestTimingPhases = {};
    if (this.connectTimes) {
      assignPhase(phases, 'stalledMs', this.connectTimes.beforeConnectAt - this.requestStart);
      assignPhase(
        phases,
        'connectMs',
        this.connectTimes.connectedAt - this.connectTimes.beforeConnectAt
      );
    } else {
      assignPhase(phases, 'stalledMs', this.sendHeadersAt - this.requestStart);
    }

    if (this.bodySentAt != null) {
      assignPhase(phases, 'requestSentMs', this.bodySentAt - this.sendHeadersAt);
    }

    const requestFinishedAt = this.bodySentAt ?? this.sendHeadersAt;
    if (this.headersAt != null) {
      assignPhase(phases, 'waitingMs', this.headersAt - requestFinishedAt);
      assignPhase(
        phases,
        'downloadMs',
        totalTimeMs - durationMs(this.requestStart, this.headersAt)
      );
    }

    return Object.keys(phases).length > 0 ? phases : undefined;
  }

  /**
   * Subscribes a request-scoped diagnostics listener and tracks it for cleanup.
   *
   * @param diagnosticsChannel - Channel to subscribe to.
   * @param listener - Listener to register.
   */
  private subscribe(
    diagnosticsChannel: ReturnType<typeof channel>,
    listener: ChannelListener
  ): void {
    diagnosticsChannel.subscribe(listener);
    this.listeners.push([diagnosticsChannel, listener]);
  }

  /**
   * Captures the internal undici request object for this session.
   *
   * @param message - undici:request:create payload.
   */
  private readonly handleCreate: ChannelListener = (message): void => {
    if (this.capturedRequest != null) {
      return;
    }

    const request = requestFromMessage(message);
    if (!request) {
      return;
    }

    const origin = readRequestString(request, 'origin');
    const method = readRequestString(request, 'method');
    if (origin === this.targetOrigin && method === this.method) {
      this.capturedRequest = request;
      requestCreateChannel.unsubscribe(this.handleCreate);
    }
  };

  /**
   * Records when request bytes start writing and attributes socket connect time.
   *
   * @param message - undici:client:sendHeaders payload.
   */
  private readonly handleSendHeaders: ChannelListener = (message): void => {
    if (requestFromMessage(message) !== this.capturedRequest) {
      return;
    }

    this.sendHeadersAt = performance.now();
    const socket = socketFromMessage(message);
    this.connectTimes = socket ? socketConnectTimes.get(socket) : undefined;
  };

  /**
   * Records when the request body is fully written.
   *
   * @param message - undici:request:bodySent payload.
   */
  private readonly handleBodySent: ChannelListener = (message): void => {
    if (requestFromMessage(message) === this.capturedRequest) {
      this.bodySentAt = performance.now();
    }
  };

  /**
   * Records when response headers arrive.
   *
   * @param message - undici:request:headers payload.
   */
  private readonly handleResponseHeaders: ChannelListener = (message): void => {
    if (requestFromMessage(message) === this.capturedRequest) {
      this.headersAt = performance.now();
    }
  };
}

/**
 * Uses undici diagnostics channels to collect best-effort HTTP phase timing.
 */
export class RequestTiming implements IRequestTiming {
  /**
   * Starts timing one outbound request attempt.
   *
   * @param requestStart - High-resolution timestamp taken before fetch starts.
   * @param targetUrl - Fully resolved URL for the request attempt.
   * @param method - HTTP method used for the request attempt.
   * @returns Session that can derive phase timings after the request completes.
   */
  start(requestStart: number, targetUrl: string, method: HttpMethod): IRequestTimingSession {
    return new RequestTimingSession(requestStart, targetUrl, method);
  }
}
