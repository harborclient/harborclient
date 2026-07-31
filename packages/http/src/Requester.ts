import { Agent, ProxyAgent, type Dispatcher } from 'undici';
import type {
  BodyType,
  HttpMethod,
  ProxySettings,
  RedirectHop,
  RequestTimingPhases,
  SendRequestInput,
  SendResult,
  SentRequest
} from './types.js';
import { DEFAULT_REQUEST_SETTINGS, type RequestSettings } from './settings.js';
import { isVeryVerbose, logRequest } from './logger.js';
import type { IBody } from './IBody.js';
import type { IHeaders } from './IHeaders.js';
import type { IQueryString } from './IQueryString.js';
import type { IRequester } from './IRequester.js';
import type { IRequestTiming, IRequestTimingSession } from './IRequestTiming.js';
import type { IResponseReader } from './IResponseReader.js';
import { Body } from './Body.js';
import { Headers } from './Headers.js';
import { QueryString } from './QueryString.js';
import { RequestTiming } from './RequestTiming.js';
import { ResponseReader } from './ResponseReader.js';
import { mapFetchError } from './mapFetchError.js';

/** HTTP status codes treated as redirects when following manually. */
export const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Maximum redirect hops before returning an error. */
export const MAX_REDIRECTS = 20;

/** Request-body headers removed when a redirect converts the method to GET. */
const REQUEST_BODY_HEADER_NAMES = [
  'content-type',
  'content-length',
  'content-encoding',
  'content-language',
  'content-location'
] as const;

/** Headers stripped when the redirect target is cross-origin. */
const CROSS_ORIGIN_HEADER_NAMES = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'host'
] as const;

/**
 * Optional collaborators injected into {@link IRequester} implementations.
 */
export interface RequesterDeps {
  queryString?: IQueryString;
  headers?: IHeaders;
  body?: IBody;
  responseReader?: IResponseReader;
  timing?: IRequestTiming;
}

let insecureDispatcher: Agent | undefined;
let cachedProxyDispatcher: ProxyAgent | undefined;
let cachedProxyDispatcherKey = '';

/**
 * Returns a cache key for proxy dispatcher configuration.
 *
 * @param proxy - Normalized proxy settings.
 * @param verifySsl - Whether TLS certificates are verified for the origin request.
 */
function proxyDispatcherCacheKey(proxy: ProxySettings, verifySsl: boolean): string {
  return JSON.stringify({ proxy, verifySsl });
}

/**
 * Returns a shared undici ProxyAgent for the given proxy configuration.
 *
 * @param proxy - Normalized proxy settings with a non-empty host.
 * @param verifySsl - When false, origin TLS verification is disabled through the proxy.
 */
function getProxyDispatcher(proxy: ProxySettings, verifySsl: boolean): ProxyAgent {
  const key = proxyDispatcherCacheKey(proxy, verifySsl);
  if (cachedProxyDispatcher && cachedProxyDispatcherKey === key) {
    return cachedProxyDispatcher;
  }

  void cachedProxyDispatcher?.close();

  const uri = `${proxy.protocol}://${proxy.host.trim()}:${proxy.port}`;
  const options: ProxyAgent.Options = { uri };

  if (proxy.authEnabled && proxy.username) {
    options.token = `Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString(
      'base64'
    )}`;
  }

  if (!verifySsl) {
    options.requestTls = { rejectUnauthorized: false };
  }

  cachedProxyDispatcher = new ProxyAgent(options);
  cachedProxyDispatcherKey = key;
  return cachedProxyDispatcher;
}

/**
 * Removes a header from a map using case-insensitive name matching.
 *
 * @param headers - Mutable header map.
 * @param name - Header name to remove.
 */
function deleteHeader(headers: Record<string, string>, name: string): void {
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      delete headers[key];
    }
  }
}

/**
 * Returns whether a redirect response should convert the next request to GET.
 *
 * @param status - Redirect response status code.
 * @param method - Method used for the redirect response request.
 */
function shouldConvertRedirectToGet(status: number, method: HttpMethod): boolean {
  return (
    ([301, 302].includes(status) && method === 'POST') ||
    (status === 303 && method !== 'GET' && method !== 'HEAD')
  );
}

/**
 * Applies fetch redirect transition rules to the next hop's method, body flag, and headers.
 *
 * @param status - Redirect response status code.
 * @param currentUrl - URL of the redirect response request.
 * @param nextUrl - Resolved Location URL for the next hop.
 * @param method - Current method; updated in place when converted to GET.
 * @param headers - Mutable headers for the next hop.
 * @returns Whether the next hop should include a request body.
 */
function applyRedirectTransition(
  status: number,
  currentUrl: string,
  nextUrl: string,
  method: { value: HttpMethod },
  headers: Record<string, string>
): boolean {
  let shouldSendBody = method.value !== 'GET' && method.value !== 'HEAD';

  if (shouldConvertRedirectToGet(status, method.value)) {
    method.value = 'GET';
    shouldSendBody = false;
    for (const headerName of REQUEST_BODY_HEADER_NAMES) {
      deleteHeader(headers, headerName);
    }
  }

  try {
    const fromOrigin = new URL(currentUrl).origin;
    const toOrigin = new URL(nextUrl).origin;
    if (fromOrigin !== toOrigin) {
      for (const headerName of CROSS_ORIGIN_HEADER_NAMES) {
        deleteHeader(headers, headerName);
      }
    }
  } catch {
    // Invalid URL; leave headers unchanged.
  }

  return shouldSendBody;
}

/**
 * Executes outbound HTTP requests via fetch with configurable collaborators.
 */
export class Requester implements IRequester {
  private readonly queryString: IQueryString;
  private readonly headers: IHeaders;
  private readonly body: IBody;
  private readonly responseReader: IResponseReader;
  private readonly timing: IRequestTiming;

  /**
   * Creates a requester with optional collaborators defaulting to the standard implementations.
   *
   * @param deps - Optional query string, header, body, and response reader implementations.
   */
  constructor(deps: RequesterDeps = {}) {
    this.queryString = deps.queryString ?? new QueryString();
    this.headers = deps.headers ?? new Headers();
    this.body = deps.body ?? new Body();
    this.responseReader = deps.responseReader ?? new ResponseReader();
    this.timing = deps.timing ?? new RequestTiming();
  }

  /**
   * Combines optional cancel and timeout signals for fetch.
   *
   * @param signal - Optional user cancel signal.
   * @param timeoutMs - Request timeout in milliseconds; 0 disables timeout.
   */
  private buildEffectiveSignal(
    signal: AbortSignal | undefined,
    timeoutMs: number
  ): AbortSignal | undefined {
    const signals: AbortSignal[] = [];
    if (signal) {
      signals.push(signal);
    }
    if (timeoutMs > 0) {
      signals.push(AbortSignal.timeout(timeoutMs));
    }

    if (signals.length === 0) {
      return undefined;
    }
    if (signals.length === 1) {
      return signals[0];
    }
    return AbortSignal.any(signals);
  }

  /**
   * Returns a shared undici Agent that skips TLS certificate verification.
   */
  private getInsecureDispatcher(): Agent {
    insecureDispatcher ??= new Agent({ connect: { rejectUnauthorized: false } });
    return insecureDispatcher;
  }

  /**
   * Builds a failed {@link SendResult} with consistent error fields.
   *
   * @param error - User-facing error message.
   * @param request - Sent request metadata captured before or during the attempt.
   * @param timeMs - Elapsed time in milliseconds.
   * @param timing - Optional best-effort phase timing captured before the error.
   * @param responseHeaders - Optional response headers when available before failure.
   * @param setCookieHeaders - Optional Set-Cookie headers from the response.
   */
  private errorResult(
    error: string,
    request: SentRequest,
    timeMs: number,
    timing?: RequestTimingPhases,
    responseHeaders: Record<string, string> = {},
    setCookieHeaders?: string[]
  ): SendResult {
    return {
      status: 0,
      statusText: 'Error',
      headers: responseHeaders,
      body: '',
      timeMs,
      ...(timing ? { timing } : {}),
      sizeBytes: 0,
      error,
      setCookieHeaders,
      request
    };
  }

  /**
   * Logs the outbound request when very-verbose mode is enabled.
   *
   * Records the HTTP verb, resolved URL, request headers, body type, and request
   * body. Response headers and response bodies are intentionally omitted.
   *
   * @param request - Final request metadata sent to fetch.
   */
  private logOutgoingRequest(request: SentRequest): void {
    if (!isVeryVerbose) return;

    logRequest(`${request.method} ${request.url}`);
    logRequest('headers:', request.headers);
    logRequest('bodyType:', request.bodyType);
    if (request.body) {
      logRequest('body:', request.body);
    }
  }

  /**
   * Builds the fetch request body for one hop.
   *
   * @param input - Original send input (body source).
   * @param bodyType - Body type for this hop.
   * @param shouldSendBody - Whether a body should be attached.
   */
  private async buildRequestBody(
    input: SendRequestInput,
    bodyType: BodyType,
    shouldSendBody: boolean
  ): Promise<{ body?: BodyInit; contentType?: string; error?: string }> {
    if (!shouldSendBody || bodyType === 'none') {
      return {};
    }

    if (input.bodyRaw !== undefined) {
      if (bodyType === 'multipart') {
        const expanded = await this.body.expandMultipartRaw(input.bodyRaw);
        if ('error' in expanded) {
          return { error: expanded.error };
        }
        return { body: expanded.body as BodyInit, contentType: expanded.contentType };
      }
      return { body: input.bodyRaw };
    }

    if (bodyType === 'multipart') {
      const multipartResult = await this.body.buildMultipart(input.body);
      if ('error' in multipartResult) {
        return { error: multipartResult.error };
      }
      return { body: multipartResult.formData };
    }

    if (bodyType === 'urlencoded') {
      return { body: this.body.buildUrlEncoded(input.body) };
    }

    return { body: input.body };
  }

  /**
   * Resolves the fetch dispatcher from general settings.
   *
   * @param settings - General request settings.
   */
  private resolveDispatcher(settings: RequestSettings): Dispatcher | undefined {
    if (settings.proxy.enabled && settings.proxy.host.trim()) {
      return getProxyDispatcher(settings.proxy, settings.verifySsl);
    }
    if (!settings.verifySsl) {
      return this.getInsecureDispatcher();
    }
    return undefined;
  }

  /**
   * Executes an HTTP request via fetch and returns timing and response metadata.
   *
   * When redirect following is enabled, 3xx responses are followed manually so
   * each hop can be recorded in {@link SendResult.redirects}.
   *
   * @param input - Method, URL, headers, params, body, and body type.
   * @param settings - General request settings for timeout, size limits, SSL verification, and redirect following.
   * @param signal - Optional abort signal to cancel the in-flight request.
   * @param cookieHeader - Optional Cookie header value from the cookie jar.
   * @returns Response status, headers, body, timing, size, and optional redirect chain; error field on failure.
   */
  async executeRequest(
    input: SendRequestInput,
    settings: RequestSettings = DEFAULT_REQUEST_SETTINGS,
    signal?: AbortSignal,
    cookieHeader?: string
  ): Promise<SendResult> {
    const url = this.queryString.buildUrl(input.url, input.params);
    const sentRequest: SentRequest = {
      method: input.method,
      url: input.url,
      headers: {},
      body: '',
      bodyType: input.bodyType
    };

    const builtHeaders = this.headers.build(input.headers, input.bodyType, {
      preserveMultipartContentType: input.bodyRaw !== undefined
    });
    if (!builtHeaders.ok) {
      return this.errorResult(builtHeaders.error, sentRequest, 0);
    }

    const headers = builtHeaders.headers;
    sentRequest.headers = headers;
    const cookieResult = this.headers.applyCookie(headers, cookieHeader);
    if (!cookieResult.ok) {
      return this.errorResult(cookieResult.error, sentRequest, 0);
    }

    const shouldSendBody =
      input.bodyType !== 'none' && input.method !== 'GET' && input.method !== 'HEAD';
    const sentBody = shouldSendBody
      ? input.bodyRaw !== undefined
        ? input.bodyRaw
        : input.bodyType === 'multipart'
          ? this.body.summarizeFormParts(input.body)
          : input.bodyType === 'urlencoded'
            ? this.body.buildUrlEncoded(input.body)
            : input.body
      : '';
    sentRequest.body = sentBody;

    if (!url.trim()) {
      return this.errorResult('URL is required', sentRequest, 0);
    }

    if (!this.queryString.isValidRequestUrl(url)) {
      return this.errorResult('Invalid URL', sentRequest, 0);
    }

    sentRequest.url = url;

    const start = performance.now();
    const effectiveSignal = this.buildEffectiveSignal(signal, settings.requestTimeoutMs);
    const dispatcher = this.resolveDispatcher(settings);

    this.logOutgoingRequest(sentRequest);

    let currentUrl = url;
    let currentMethod: HttpMethod = input.method;
    const currentHeaders = { ...headers };
    const currentBodyType = input.bodyType;
    let currentShouldSendBody = shouldSendBody;
    const redirects: RedirectHop[] = [];
    let lastTimingSession: IRequestTimingSession | undefined;

    try {
      let response: Response | undefined;

      while (true) {
        const init: RequestInit & { dispatcher?: Dispatcher } = {
          method: currentMethod,
          headers: currentHeaders,
          signal: effectiveSignal,
          redirect: 'manual'
        };

        if (dispatcher) {
          init.dispatcher = dispatcher;
        }

        const bodyResult = await this.buildRequestBody(
          input,
          currentBodyType,
          currentShouldSendBody
        );
        if (bodyResult.error) {
          const timeMs = Math.round(performance.now() - start);
          return this.errorResult(
            bodyResult.error,
            sentRequest,
            timeMs,
            lastTimingSession?.toPhases(timeMs)
          );
        }
        if (bodyResult.contentType) {
          for (const key of Object.keys(currentHeaders)) {
            if (key.toLowerCase() === 'content-type') {
              delete currentHeaders[key];
            }
          }
          currentHeaders['Content-Type'] = bodyResult.contentType;
          sentRequest.headers = { ...currentHeaders };
        }
        if (bodyResult.body !== undefined) {
          init.body = bodyResult.body;
        }

        const timingSession = this.timing.start(start, currentUrl, currentMethod);
        lastTimingSession = timingSession;
        try {
          response = await fetch(currentUrl, init);
        } finally {
          timingSession.stop();
        }

        if (
          !settings.followRedirects ||
          !REDIRECT_STATUSES.has(response.status) ||
          !response.headers.get('location')
        ) {
          break;
        }

        const rawLocation = response.headers.get('location')!;
        let location: string;
        try {
          location = new URL(rawLocation, currentUrl).toString();
        } catch {
          break;
        }

        redirects.push({
          status: response.status,
          statusText: response.statusText,
          url: currentUrl,
          location,
          method: currentMethod
        });

        await response.body?.cancel();

        if (redirects.length > MAX_REDIRECTS) {
          const timeMs = Math.round(performance.now() - start);
          return this.errorResult(
            'Too many redirects',
            sentRequest,
            timeMs,
            lastTimingSession?.toPhases(timeMs)
          );
        }

        const methodRef = { value: currentMethod };
        currentShouldSendBody = applyRedirectTransition(
          response.status,
          currentUrl,
          location,
          methodRef,
          currentHeaders
        );
        currentMethod = methodRef.value;
        currentUrl = location;
      }

      if (!response) {
        const timeMs = Math.round(performance.now() - start);
        return this.errorResult(
          'No response received',
          sentRequest,
          timeMs,
          lastTimingSession?.toPhases(timeMs)
        );
      }

      const setCookieHeaders =
        typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
      const readResult = await this.responseReader.read(response, settings.maxResponseSizeMb);
      const timeMs = Math.round(performance.now() - start);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      if ('error' in readResult) {
        const timing = lastTimingSession?.toPhases(timeMs);
        return this.errorResult(
          readResult.error,
          sentRequest,
          timeMs,
          timing,
          responseHeaders,
          setCookieHeaders
        );
      }

      const timing = lastTimingSession?.toPhases(timeMs);
      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: readResult.body,
        ...(readResult.bodyBase64 ? { bodyBase64: readResult.bodyBase64 } : {}),
        timeMs,
        ...(timing ? { timing } : {}),
        sizeBytes: readResult.sizeBytes,
        setCookieHeaders,
        request: sentRequest,
        ...(redirects.length > 0 ? { redirects } : {})
      };
    } catch (err) {
      const timeMs = Math.round(performance.now() - start);
      return this.errorResult(
        mapFetchError(err, settings.requestTimeoutMs),
        sentRequest,
        timeMs,
        lastTimingSession?.toPhases(timeMs)
      );
    }
  }
}
