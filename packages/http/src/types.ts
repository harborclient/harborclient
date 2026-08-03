/**
 * Supported HTTP request methods.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Transport protocol for a request tab or saved request.
 *
 * HTTP uses the buffered `executeRequest` path. SSE opens a long-lived session
 * via `openSession`. Additional values (websocket, grpc) may be added later
 * without changing {@link HttpMethod}.
 */
export type RequestProtocol = 'http' | 'sse';

/**
 * One parsed Server-Sent Events message from an open SSE session.
 */
export interface SseEvent {
  /**
   * Monotonic sequence number within the session, used as a stable React key.
   */
  seq: number;

  /**
   * Wall-clock time when the event was dispatched, in epoch milliseconds.
   */
  receivedAt: number;

  /**
   * Event type from the `event:` field, or `message` when the field is absent.
   */
  type: string;

  /**
   * Last-Event-ID value from the `id:` field, when present.
   */
  id?: string;

  /**
   * Joined multi-line `data:` payload (lines separated by `\n`).
   */
  data: string;

  /**
   * Reconnect delay from the `retry:` field, in milliseconds, when present.
   */
  retryMs?: number;

  /**
   * Verbatim wire block for the Raw tab (excluding the terminating blank line).
   */
  raw: string;
}

/**
 * Input for opening a long-lived network session (SSE today; WS/gRPC later).
 */
export interface SessionOpenInput {
  /**
   * Session protocol; only `sse` is supported in this cut.
   */
  protocol: 'sse';

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[];

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[];

  /**
   * Last-Event-ID to send on the initial connect or after reconnect.
   */
  lastEventId?: string;

  /**
   * When true (default), reconnect after a clean server close using the
   * EventSource retry interval. Disabled when the client aborts.
   */
  reconnect?: boolean;
}

/**
 * Handshake metadata emitted when an SSE response's headers arrive.
 */
export interface SessionOpenInfo {
  /**
   * HTTP status code from the initial response.
   */
  status: number;

  /**
   * HTTP status text from the initial response.
   */
  statusText: string;

  /**
   * Response headers as a flat key-value map.
   */
  headers: Record<string, string>;

  /**
   * Set-Cookie header values from the response; used by the cookie jar.
   */
  setCookieHeaders?: string[];

  /**
   * Optional best-effort phase timing for the handshake hop.
   */
  timing?: RequestTimingPhases;
}

/**
 * Callbacks for a long-lived network session.
 */
export interface SessionHandlers {
  /**
   * Called when response headers arrive (before the first event).
   *
   * @param info - Handshake status, headers, and optional timing.
   */
  onOpen?(info: SessionOpenInfo): void;

  /**
   * Called for each parsed SSE event.
   *
   * @param event - Parsed event payload.
   */
  onEvent(event: SseEvent): void;

  /**
   * Called before a reconnect attempt sleeps.
   *
   * @param afterMs - Delay before the next connect attempt.
   * @param attempt - One-based reconnect attempt number.
   */
  onReconnecting?(afterMs: number, attempt: number): void;

  /**
   * Called when the session ends (client close, server close, or error).
   *
   * @param info - Close reason and optional error message.
   */
  onClose?(info: { reason: 'client' | 'server' | 'error'; error?: string }): void;
}

/**
 * Handle for an open long-lived network session.
 */
export interface NetworkSession {
  /**
   * Opaque session id for correlating IPC events with the opener.
   */
  readonly id: string;

  /**
   * Protocol this session was opened with.
   */
  readonly protocol: RequestProtocol;

  /**
   * Closes the session and aborts any in-flight reconnect.
   */
  close(): Promise<void>;
}

/**
 * Request body content type.
 */
export type BodyType = 'none' | 'json' | 'text' | 'multipart' | 'urlencoded';

/**
 * Field type for a multipart/form-data part.
 */
export type FormDataPartType = 'text' | 'file';

/**
 * A single part in a multipart/form-data body.
 */
export interface FormDataPart {
  /**
   * Form field name.
   */
  key: string;

  /**
   * Text value when type is text; ignored for file parts.
   */
  value: string;

  /**
   * When false, the part is excluded when building the request.
   */
  enabled: boolean;

  /**
   * Whether this part is a text field or file upload.
   */
  type: FormDataPartType;

  /**
   * Absolute file paths for file parts; supports one or more files per field.
   */
  files: string[];
}

/**
 * A key-value pair with an enable toggle for headers and query params.
 */
export interface KeyValue {
  /**
   * Header or query parameter name.
   */
  key: string;

  /**
   * Header or query parameter value.
   */
  value: string;

  /**
   * When false, the pair is ignored when building the request.
   */
  enabled: boolean;
}

/**
 * Proxy protocol used to connect to the proxy server.
 */
export type ProxyProtocol = 'http' | 'https';

/**
 * Global HTTP proxy configuration applied to every outbound request.
 */
export interface ProxySettings {
  /**
   * When true, outbound requests are routed through the configured proxy.
   */
  enabled: boolean;

  /**
   * Protocol used to connect to the proxy server.
   */
  protocol: ProxyProtocol;

  /**
   * Proxy server hostname or IP address.
   */
  host: string;

  /**
   * Proxy server port.
   */
  port: number;

  /**
   * When true, HTTP Basic authentication credentials are sent to the proxy.
   */
  authEnabled: boolean;

  /**
   * Username for proxy HTTP Basic authentication.
   */
  username: string;

  /**
   * Password for proxy HTTP Basic authentication.
   */
  password: string;
}

/**
 * Input for sending an HTTP request from the renderer.
 */
export interface SendRequestInput {
  /**
   * HTTP method to use for the request.
   */
  method: HttpMethod;

  /**
   * Request URL without query parameters.
   */
  url: string;

  /**
   * Request headers as editable key-value pairs.
   */
  headers: KeyValue[];

  /**
   * Query parameters as editable key-value pairs.
   */
  params: KeyValue[];

  /**
   * Raw request body content.
   */
  body: string;

  /**
   * Content type of the request body.
   */
  bodyType: BodyType;

  /**
   * Optional verbatim body override from the Raw body editor.
   *
   * When set (including the empty string), this text is sent instead of encoding
   * {@link body} as structured multipart/urlencoded JSON. For multipart, file
   * tokens of the form `<<file:/abs/path>>` are expanded to file bytes on send.
   */
  bodyRaw?: string;

  /**
   * Saved collection request id when the send originated from a saved request tab.
   */
  sourceRequestId?: number;

  /**
   * Display name from the request tab when {@link sourceRequestId} is set.
   */
  sourceRequestName?: string;
}

/**
 * Metadata for the HTTP request as sent. Multipart {@link body} is a display
 * summary of form fields, not the raw wire payload.
 */
export interface SentRequest {
  /**
   * HTTP method used for the request.
   */
  method: HttpMethod;

  /**
   * Fully resolved request URL including query parameters.
   */
  url: string;

  /**
   * Request headers as a flat key-value map.
   */
  headers: Record<string, string>;

  /**
   * Body content for display. For multipart, a human-readable summary of form
   * fields and file names — not the raw multipart bytes. For other body types,
   * the literal string sent on the wire, or empty when none.
   */
  body: string;

  /**
   * Content type of the request body; used to interpret {@link body}.
   */
  bodyType?: BodyType;
}

/**
 * One hop in a redirect chain recorded while following 3xx responses.
 */
export interface RedirectHop {
  /**
   * Status code of the redirect response (301, 302, 303, 307, or 308).
   */
  status: number;

  /**
   * Status text of the redirect response.
   */
  statusText: string;

  /**
   * Absolute URL that was requested for this hop.
   */
  url: string;

  /**
   * Resolved absolute URL from the Location header.
   */
  location: string;

  /**
   * HTTP method used for this hop.
   */
  method: HttpMethod;
}

/**
 * Best-effort timing breakdown for one HTTP request hop.
 *
 * Phases are optional because undici only publishes some events for reused
 * sockets or requests that fail before bytes are written. `connectMs` combines
 * DNS, TCP, and TLS setup and reflects the proxy connection when a proxy is used.
 */
export interface RequestTimingPhases {
  /**
   * Time spent waiting before the request starts writing to a socket.
   */
  stalledMs?: number;

  /**
   * Combined DNS, TCP, and TLS connection setup time for new sockets.
   */
  connectMs?: number;

  /**
   * Time spent writing request headers and body to the socket.
   */
  requestSentMs?: number;

  /**
   * Time from finishing the request write until response headers arrive.
   */
  waitingMs?: number;

  /**
   * Time spent reading the response body after response headers arrive.
   */
  downloadMs?: number;
}

/**
 * Result of an HTTP request including timing and size metadata.
 */
export interface SendResult {
  /**
   * HTTP status code, or 0 when the request failed before a response.
   */
  status: number;

  /**
   * HTTP status text from the response.
   */
  statusText: string;

  /**
   * Response headers as a flat key-value map.
   */
  headers: Record<string, string>;

  /**
   * Response body as text.
   */
  body: string;

  /**
   * Base64-encoded response body for binary / non-textual responses (images, PDF, zip, etc.);
   * omitted for JSON, text-ish, and HTML-ish bodies.
   */
  bodyBase64?: string;

  /**
   * Round-trip time in milliseconds.
   */
  timeMs: number;

  /**
   * Optional best-effort phase timing for the final request hop.
   */
  timing?: RequestTimingPhases;

  /**
   * Response body size in bytes.
   */
  sizeBytes: number;

  /**
   * Error message when the request failed; omitted on success.
   */
  error?: string;

  /**
   * Set-Cookie header values from the response; used by the cookie jar.
   */
  setCookieHeaders?: string[];

  /**
   * The outgoing request as actually sent; omitted on older results.
   */
  request?: SentRequest;

  /**
   * Ordered redirect hops that were followed; omitted when none.
   */
  redirects?: RedirectHop[];
}
