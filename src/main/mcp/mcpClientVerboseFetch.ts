import { logVerbose } from '#/main/logger';

interface McpClientFetchContext {
  /** Configured MCP client server id. */
  serverId: string;

  /** Display name for log output. */
  name: string;
}

/**
 * Resolves a fetch URL string from RequestInfo or URL input.
 *
 * @param input - Fetch target passed to the global fetch API.
 */
function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

/**
 * Reads one HTTP header value from fetch init headers.
 *
 * @param headers - Request headers from fetch init.
 * @param name - Header name to read.
 */
function readHeader(headers: HeadersInit | undefined, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return match?.[1];
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name.toLowerCase()) {
      return value;
    }
  }

  return undefined;
}

/**
 * Extracts the JSON-RPC method from a stringified MCP POST body when present.
 *
 * @param body - Request body from fetch init.
 */
function parseJsonRpcMethod(body: BodyInit | null | undefined): string | undefined {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(body) as { method?: unknown };
    return typeof parsed.method === 'string' ? parsed.method : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Builds verbose log fields for one outgoing MCP client HTTP request.
 *
 * @param url - Request URL.
 * @param init - Fetch init options.
 */
export function describeMcpClientOutgoingRequest(
  url: string,
  init?: RequestInit
): Record<string, unknown> {
  const httpMethod = init?.method ?? 'GET';
  const jsonRpcMethod = parseJsonRpcMethod(init?.body ?? null);
  const sessionId = readHeader(init?.headers, 'mcp-session-id');

  return {
    httpMethod,
    url,
    ...(jsonRpcMethod ? { jsonRpcMethod } : {}),
    ...(sessionId ? { sessionId } : {})
  };
}

/**
 * Wraps fetch so outgoing MCP client HTTP requests are logged in verbose mode.
 *
 * @param context - MCP client server identity for log correlation.
 * @param fetchImpl - Underlying fetch implementation.
 */
export function createVerboseMcpClientFetch(
  context: McpClientFetchContext,
  fetchImpl: typeof fetch = fetch
): typeof fetch {
  return async (input, init) => {
    const url = resolveFetchUrl(input);
    logVerbose('mcp:client:request', {
      serverId: context.serverId,
      name: context.name,
      ...describeMcpClientOutgoingRequest(url, init)
    });

    const response = await fetchImpl(input, init);

    logVerbose('mcp:client:response', {
      serverId: context.serverId,
      name: context.name,
      httpMethod: init?.method ?? 'GET',
      url,
      status: response.status
    });

    return response;
  };
}
