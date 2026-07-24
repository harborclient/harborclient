import { CookieJar } from '@harborclient/core/cookies/CookieJar';
import { executeHttpSend } from '@harborclient/core/network/executeHttpSend';
import type { HttpMethod, SendRequestInput, SendResult } from '@harborclient/core/types';
import { createEphemeralSettingsProvider } from './adapters/CliSettingsProvider.js';
import { MemoryCookieJarStorage, parseHeaderArgs } from './adapters/memoryCookieStorage.js';

/**
 * Options for an ad-hoc HTTP send from the CLI.
 */
export interface AdHocSendOptions {
  /**
   * HTTP method (GET, POST, …).
   */
  method: HttpMethod;

  /**
   * Absolute request URL.
   */
  url: string;

  /**
   * Raw `Name: value` header arguments.
   */
  headers: string[];

  /**
   * Request body text (optional).
   */
  body?: string;

  /**
   * When true, set Content-Type to application/json if not already set.
   */
  json?: boolean;

  /**
   * Request timeout override in milliseconds.
   */
  timeoutMs?: number;

  /**
   * When false, skip TLS certificate verification.
   */
  verifySsl?: boolean;
}

/**
 * Sends an ad-hoc HTTP request using the portable core engine.
 *
 * @param options - Method, URL, headers, and body options.
 * @returns HTTP response from the HarborClient requester.
 */
export async function sendAdHocRequest(options: AdHocSendOptions): Promise<SendResult> {
  const headerRows = parseHeaderArgs(options.headers);
  if (options.json) {
    const hasContentType = headerRows.some((h) => h.key.toLowerCase() === 'content-type');
    if (!hasContentType) {
      headerRows.unshift({
        key: 'Content-Type',
        value: 'application/json',
        enabled: true
      });
    }
  }

  const settings = createEphemeralSettingsProvider({
    ...(options.timeoutMs != null ? { requestTimeoutMs: options.timeoutMs } : {}),
    ...(options.verifySsl != null ? { verifySsl: options.verifySsl } : {})
  });

  const cookieJar = new CookieJar(new MemoryCookieJarStorage());

  const request: SendRequestInput = {
    method: options.method,
    url: options.url,
    headers: headerRows,
    params: [],
    body: options.body ?? '',
    bodyType: options.json ? 'json' : 'none'
  };

  return executeHttpSend(request, { settings, cookieJar });
}
