import { Agent, type Dispatcher } from 'undici';
import type { GeneralSettings, SendRequestInput, SendResult, SentRequest } from '#/shared/types';
import { DEFAULT_GENERAL_SETTINGS } from '#/main/settings/generalSettings';
import type { IBody } from '#/main/http/IBody';
import type { IHeaders } from '#/main/http/IHeaders';
import type { IQueryString } from '#/main/http/IQueryString';
import type { IRequester } from '#/main/http/IRequester';
import type { IResponseReader } from '#/main/http/IResponseReader';
import { Body } from '#/main/http/Body';
import { Headers } from '#/main/http/Headers';
import { QueryString } from '#/main/http/QueryString';
import { ResponseReader } from '#/main/http/ResponseReader';

/**
 * Optional collaborators injected into {@link IRequester} implementations.
 */
export interface RequesterDeps {
  queryString?: IQueryString;
  headers?: IHeaders;
  body?: IBody;
  responseReader?: IResponseReader;
}

let insecureDispatcher: Agent | undefined;

/**
 * Executes outbound HTTP requests via fetch with configurable collaborators.
 */
export class Requester implements IRequester {
  private readonly queryString: IQueryString;
  private readonly headers: IHeaders;
  private readonly body: IBody;
  private readonly responseReader: IResponseReader;

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
   * Maps fetch errors to user-facing messages.
   *
   * @param err - Thrown fetch error.
   * @param timeoutMs - Configured request timeout in milliseconds.
   */
  private mapFetchError(err: unknown, timeoutMs: number): string {
    if (err instanceof Error && err.name === 'AbortError') {
      return 'Request canceled';
    }
    if (err instanceof Error && err.name === 'TimeoutError') {
      return `Request timed out after ${timeoutMs} ms`;
    }
    if (err instanceof Error) {
      return err.message;
    }
    return 'Unknown error';
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
   * @param responseHeaders - Optional response headers when available before failure.
   * @param setCookieHeaders - Optional Set-Cookie headers from the response.
   */
  private errorResult(
    error: string,
    request: SentRequest,
    timeMs: number,
    responseHeaders: Record<string, string> = {},
    setCookieHeaders?: string[]
  ): SendResult {
    return {
      status: 0,
      statusText: 'Error',
      headers: responseHeaders,
      body: '',
      timeMs,
      sizeBytes: 0,
      error,
      setCookieHeaders,
      request
    };
  }

  /**
   * Executes an HTTP request via fetch and returns timing and response metadata.
   *
   * @param input - Method, URL, headers, params, body, and body type.
   * @param settings - General request settings for timeout, size limits, and SSL verification.
   * @param signal - Optional abort signal to cancel the in-flight request.
   * @param cookieHeader - Optional Cookie header value from the cookie jar.
   * @returns Response status, headers, body, timing, and size; error field on failure.
   */
  async executeRequest(
    input: SendRequestInput,
    settings: GeneralSettings = DEFAULT_GENERAL_SETTINGS,
    signal?: AbortSignal,
    cookieHeader?: string
  ): Promise<SendResult> {
    const url = this.queryString.buildUrl(input.url, input.params);
    const builtHeaders = this.headers.build(input.headers, input.bodyType);
    if (!builtHeaders.ok) {
      return this.errorResult(
        builtHeaders.error,
        {
          method: input.method,
          url: input.url,
          headers: {},
          body: '',
          bodyType: input.bodyType
        },
        0
      );
    }

    const headers = builtHeaders.headers;
    const cookieResult = this.headers.applyCookie(headers, cookieHeader);
    if (!cookieResult.ok) {
      return this.errorResult(
        cookieResult.error,
        {
          method: input.method,
          url: input.url,
          headers,
          body: '',
          bodyType: input.bodyType
        },
        0
      );
    }

    const shouldSendBody =
      input.bodyType !== 'none' && input.method !== 'GET' && input.method !== 'HEAD';
    const sentBody = shouldSendBody
      ? input.bodyType === 'multipart'
        ? this.body.summarizeFormParts(input.body)
        : input.bodyType === 'urlencoded'
          ? this.body.buildUrlEncoded(input.body)
          : input.body
      : '';
    const request: SentRequest = {
      method: input.method,
      url,
      headers,
      body: sentBody,
      bodyType: input.bodyType
    };

    if (!url.trim()) {
      return this.errorResult(
        'URL is required',
        {
          method: input.method,
          url: input.url,
          headers,
          body: sentBody,
          bodyType: input.bodyType
        },
        0
      );
    }

    if (!this.queryString.isValidRequestUrl(url)) {
      return this.errorResult(
        'Invalid URL',
        {
          method: input.method,
          url: input.url,
          headers,
          body: sentBody,
          bodyType: input.bodyType
        },
        0
      );
    }

    const start = performance.now();
    const effectiveSignal = this.buildEffectiveSignal(signal, settings.requestTimeoutMs);

    try {
      const init: RequestInit & { dispatcher?: Dispatcher } = {
        method: input.method,
        headers,
        signal: effectiveSignal
      };

      if (!settings.verifySsl) {
        init.dispatcher = this.getInsecureDispatcher();
      }

      if (shouldSendBody) {
        if (input.bodyType === 'multipart') {
          const multipartResult = await this.body.buildMultipart(input.body);
          if ('error' in multipartResult) {
            const timeMs = Math.round(performance.now() - start);
            return this.errorResult(multipartResult.error, request, timeMs);
          }
          init.body = multipartResult.formData;
        } else if (input.bodyType === 'urlencoded') {
          init.body = this.body.buildUrlEncoded(input.body);
        } else {
          init.body = input.body;
        }
      }

      const response = await fetch(url, init);
      const setCookieHeaders =
        typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
      const bodyResult = await this.responseReader.read(response, settings.maxResponseSizeMb);
      const timeMs = Math.round(performance.now() - start);

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      if ('error' in bodyResult) {
        return this.errorResult(
          bodyResult.error,
          request,
          timeMs,
          responseHeaders,
          setCookieHeaders
        );
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: bodyResult.body,
        timeMs,
        sizeBytes: bodyResult.sizeBytes,
        setCookieHeaders,
        request
      };
    } catch (err) {
      const timeMs = Math.round(performance.now() - start);
      return this.errorResult(this.mapFetchError(err, settings.requestTimeoutMs), request, timeMs);
    }
  }
}
