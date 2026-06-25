import type { PluginHttpRequest, PluginHttpResponse } from '@harborclient/plugin-api';
import type { SendRequestInput, SendResult } from '#/shared/types';

/**
 * Converts a renderer send payload into the plugin hook request shape.
 *
 * @param req - Renderer HTTP request payload.
 * @returns Serializable request snapshot for plugin HTTP hooks.
 */
export function toPluginHttpRequest(req: SendRequestInput): PluginHttpRequest {
  const headers: Record<string, string> = {};
  for (const header of req.headers) {
    if (header.enabled && header.key) {
      headers[header.key] = header.value;
    }
  }
  const params: Array<{ key: string; value: string }> = [];
  for (const param of req.params) {
    if (param.enabled && param.key) {
      params.push({ key: param.key, value: param.value });
    }
  }
  return {
    method: req.method,
    url: req.url,
    headers,
    body: req.body ?? '',
    bodyType: req.bodyType,
    params,
    ...(req.sourceRequestId != null ? { sourceRequestId: req.sourceRequestId } : {}),
    ...(req.sourceRequestName ? { sourceRequestName: req.sourceRequestName } : {})
  };
}

/**
 * Converts a completed send result into the plugin hook response shape.
 *
 * @param result - HTTP send result returned to the renderer.
 * @returns Serializable response snapshot for plugin HTTP hooks.
 */
export function toPluginHttpResponse(result: SendResult): PluginHttpResponse {
  return {
    status: result.status,
    statusText: result.statusText,
    headers: result.headers,
    body: result.body
  };
}
