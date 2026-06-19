import type { BodyType, KeyValue, SendRequestInput, SendResult } from '#/shared/types'

/**
 * Appends enabled query parameters to a base URL.
 *
 * @param baseUrl - Request URL before query string merging.
 * @param params - Key-value pairs to append as search params.
 * @returns URL with merged query parameters.
 */
function buildUrl(baseUrl: string, params: KeyValue[]): string {
  const trimmed = baseUrl.trim()
  if (!trimmed) return trimmed

  const enabledParams = params.filter((p) => p.enabled && p.key.trim())
  if (enabledParams.length === 0) return trimmed

  try {
    const url = new URL(trimmed)
    for (const param of enabledParams) {
      url.searchParams.set(param.key.trim(), param.value)
    }
    return url.toString()
  } catch {
    const separator = trimmed.includes('?') ? '&' : '?'
    const query = enabledParams
      .map((p) => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`)
      .join('&')
    return `${trimmed}${separator}${query}`
  }
}

/**
 * Builds request headers from enabled key-value pairs and body type defaults.
 *
 * @param headers - User-defined headers.
 * @param bodyType - Body type used to infer Content-Type when absent.
 * @returns Header map ready for fetch.
 */
function buildHeaders(headers: KeyValue[], bodyType: BodyType): Record<string, string> {
  const result: Record<string, string> = {}

  for (const header of headers) {
    if (header.enabled && header.key.trim()) {
      result[header.key.trim()] = header.value
    }
  }

  const hasContentType = Object.keys(result).some(
    (key) => key.toLowerCase() === 'content-type'
  )

  if (!hasContentType) {
    if (bodyType === 'json') {
      result['Content-Type'] = 'application/json'
    } else if (bodyType === 'text') {
      result['Content-Type'] = 'text/plain'
    }
  }

  return result
}

/**
 * Executes an HTTP request via fetch and returns timing and response metadata.
 *
 * @param input - Method, URL, headers, params, body, and body type.
 * @returns Response status, headers, body, timing, and size; error field on failure.
 */
export async function executeRequest(input: SendRequestInput): Promise<SendResult> {
  const url = buildUrl(input.url, input.params)
  const headers = buildHeaders(input.headers, input.bodyType)

  if (!url.trim()) {
    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: '',
      timeMs: 0,
      sizeBytes: 0,
      error: 'URL is required'
    }
  }

  const start = performance.now()

  try {
    const init: RequestInit = {
      method: input.method,
      headers
    }

    if (input.bodyType !== 'none' && input.method !== 'GET' && input.method !== 'HEAD') {
      init.body = input.body
    }

    const response = await fetch(url, init)
    const body = await response.text()
    const timeMs = Math.round(performance.now() - start)
    const sizeBytes = new TextEncoder().encode(body).length

    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body,
      timeMs,
      sizeBytes
    }
  } catch (err) {
    const timeMs = Math.round(performance.now() - start)
    const message = err instanceof Error ? err.message : 'Unknown error'

    return {
      status: 0,
      statusText: 'Error',
      headers: {},
      body: '',
      timeMs,
      sizeBytes: 0,
      error: message
    }
  }
}
