import { useMemo, useState } from 'react'
import type { SendResult } from '#/shared/types'
import { segment, segmentGroup, statusDotClass } from '#/renderer/src/ui/classes'

interface Props {
  /**
   * Last send result to display, or null before the first send.
   */
  response: SendResult | null

  /**
   * Whether a request is in flight; shows a loading state when true.
   */
  sending: boolean
}

/**
 * Pretty-prints JSON response bodies when valid; returns raw text otherwise.
 *
 * @param body - Raw response body string.
 * @returns Formatted body for display.
 */
function formatBody(body: string): string {
  if (!body) return ''
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

/**
 * Formats a byte count as B, KB, or MB.
 *
 * @param bytes - Response body size in bytes.
 * @returns Human-readable size string.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Displays HTTP response status, timing, body, and headers.
 */
export function ResponseViewer({ response, sending }: Props) {
  const [tab, setTab] = useState<'body' | 'headers'>('body')

  const formattedBody = useMemo(
    () => (response ? formatBody(response.body) : ''),
    [response]
  )

  const emptyState = (message: string) => (
    <div className="flex flex-1 flex-col p-3">
      <div className="flex flex-1 items-center justify-center text-[13px] text-muted">
        {message}
      </div>
    </div>
  )

  if (sending) {
    return emptyState('Sending request…')
  }

  if (!response) {
    return emptyState('Send a request to see the response')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3">
      <div className="mb-2 flex items-center gap-3 text-[13px]">
        <span className="inline-flex items-center gap-1.5 font-medium text-text">
          <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${statusDotClass(response.status)}`} />
          {response.error ? 'Error' : `${response.status} ${response.statusText}`}
        </span>
        <span className="text-muted">{response.timeMs} ms</span>
        <span className="text-muted">{formatBytes(response.sizeBytes)}</span>
      </div>

      {response.error && (
        <div className="mb-2 rounded-md bg-danger/10 px-2.5 py-2 text-[13px] text-danger">
          {response.error}
        </div>
      )}

      <div className="mb-2">
        <div className={segmentGroup}>
          <button className={segment(tab === 'body')} onClick={() => setTab('body')}>
            Body
          </button>
          <button className={segment(tab === 'headers')} onClick={() => setTab('headers')}>
            Headers
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'body' && (
          <pre className="m-0 rounded-md bg-control p-2 font-mono text-[12px] break-words whitespace-pre-wrap shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)]">
            {formattedBody || '(empty body)'}
          </pre>
        )}
        {tab === 'headers' && (
          <div className="overflow-hidden rounded-md border border-separator">
            {Object.entries(response.headers).length === 0 ? (
              <div className="p-4 text-center text-[13px] text-muted">No headers</div>
            ) : (
              Object.entries(response.headers).map(([key, value], index) => (
                <div
                  className={`grid grid-cols-[180px_1fr] gap-3 px-2.5 py-1.5 ${index > 0 ? 'border-t border-separator' : ''}`}
                  key={key}
                >
                  <span className="break-words text-[13px] font-medium text-accent">{key}</span>
                  <span className="break-words font-mono text-[12px] text-text-secondary">{value}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
