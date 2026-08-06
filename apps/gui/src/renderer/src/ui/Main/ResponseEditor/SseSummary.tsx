import type { JSX } from 'react';
import type { SseSessionState } from '#/renderer/src/store/tabs';
import { Button, StatusDot } from '@harborclient/sdk/components';
import { focusableReadonlyClass, statusDotVariant } from '#/renderer/src/ui/Shared/classes';

interface Props {
  /**
   * Live or closed SSE session to summarize.
   */
  sseSession: SseSessionState;

  /**
   * Optional class names for the summary row container.
   */
  className?: string;

  /**
   * Clears retained events without closing the connection.
   */
  onClearEvents?: () => void;

  /**
   * Disconnects an active SSE session.
   */
  onDisconnect?: () => void;
}

/**
 * Human-readable label for an SSE session lifecycle status.
 *
 * @param status - Current session status.
 * @returns Status text for the summary row and screen readers.
 */
function sseStatusLabel(status: SseSessionState['status']): string {
  switch (status) {
    case 'connecting':
      return 'Connecting';
    case 'open':
      return 'Connected';
    case 'reconnecting':
      return 'Reconnecting';
    case 'closed':
      return 'Closed';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

/**
 * Maps SSE session status onto a status-dot color variant.
 *
 * @param session - Session whose status should be visualized.
 * @returns Dot variant paired with the text label (not color-only).
 */
function sseStatusDotVariant(session: SseSessionState): ReturnType<typeof statusDotVariant> {
  if (session.status === 'error' || session.error) {
    return 'danger';
  }
  if (session.status === 'open') {
    return 'success';
  }
  if (session.status === 'reconnecting' || session.status === 'connecting') {
    return 'warning';
  }
  return 'info';
}

/**
 * Compact SSE connection status, event counts, and optional disconnect control.
 *
 * Layout mirrors {@link ResponseSummary}: a single non-wrapping metrics row with a
 * shrink-wrapped action cluster so event-count updates and Clear/Disconnect
 * availability cannot change row height or shove the tabs below.
 *
 * Duration is shown only after the session closes so render stays pure (no
 * live `Date.now` ticks during an open stream). Status changes are announced via
 * a visually hidden live region so the visible metrics (especially event counts)
 * do not re-trigger polite announcements on every flush.
 *
 * @param props - Session state and optional clear/disconnect actions.
 * @returns Summary toolbar for the SSE response pane.
 */
export function SseSummary({
  sseSession,
  className,
  onClearEvents,
  onDisconnect
}: Props): JSX.Element {
  const statusText = sseStatusLabel(sseSession.status);
  const eventCount = sseSession.events.length;
  const openInfo = sseSession.openInfo;
  const elapsedMs =
    sseSession.openedAt != null && sseSession.closedAt != null
      ? Math.max(0, sseSession.closedAt - sseSession.openedAt)
      : null;
  const canDisconnect =
    onDisconnect != null &&
    (sseSession.status === 'connecting' ||
      sseSession.status === 'open' ||
      sseSession.status === 'reconnecting');
  const reconnect = sseSession.reconnect;
  const showReconnectDetail = reconnect != null && sseSession.status === 'reconnecting';
  const statusAriaLabel = `SSE status: ${statusText}${sseSession.error ? `: ${sseSession.error}` : ''}`;
  const liveAnnouncement = [
    statusAriaLabel,
    openInfo != null ? `HTTP status: ${openInfo.status} ${openInfo.statusText}` : null,
    showReconnectDetail
      ? `Retry in ${reconnect.afterMs} milliseconds, attempt ${reconnect.attempt}`
      : null,
    sseSession.error && sseSession.status !== 'error' ? sseSession.error : null
  ]
    .filter((part): part is string => part != null && part.length > 0)
    .join('. ');

  return (
    <div
      className={`relative flex w-full items-center justify-between gap-3 text-[14px] ${className ?? ''}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`inline-flex min-w-0 max-w-[min(40vw,28rem)] items-center ${focusableReadonlyClass}`}
          tabIndex={0}
          title={sseSession.error}
          aria-label={statusAriaLabel}
        >
          <span className="mr-3 shrink-0">{statusText}</span>
          <StatusDot
            variant={sseStatusDotVariant(sseSession)}
            size="sm"
            aria-hidden
            title={statusText}
          />
          {sseSession.error ? (
            <span className="ml-2 min-w-0 truncate font-normal text-danger">
              : {sseSession.error}
            </span>
          ) : null}
        </span>
        <span
          className={`min-w-[5.5rem] ${focusableReadonlyClass}${openInfo == null ? ' text-muted' : ''}`}
          tabIndex={0}
          aria-label={
            openInfo != null
              ? `HTTP status: ${openInfo.status} ${openInfo.statusText}`
              : 'HTTP status: pending'
          }
        >
          {openInfo != null ? `${openInfo.status} ${openInfo.statusText}` : '—'}
        </span>
        <span
          className={`min-w-[5.5rem] tabular-nums ${focusableReadonlyClass}`}
          tabIndex={0}
          aria-label={`Events retained: ${eventCount}${sseSession.droppedCount > 0 ? `, ${sseSession.droppedCount} dropped` : ''}`}
        >
          {eventCount} event{eventCount === 1 ? '' : 's'}
          {sseSession.droppedCount > 0 ? ` (${sseSession.droppedCount} dropped)` : ''}
        </span>
        {elapsedMs != null ? (
          <span
            className={`tabular-nums ${focusableReadonlyClass}`}
            tabIndex={0}
            aria-label={`Duration: ${elapsedMs} milliseconds`}
          >
            {elapsedMs} ms
          </span>
        ) : null}
        {showReconnectDetail ? (
          <span
            className={`min-w-0 truncate text-muted ${focusableReadonlyClass}`}
            tabIndex={0}
            aria-label={`Reconnecting in ${reconnect.afterMs} milliseconds, attempt ${reconnect.attempt}`}
          >
            Retry in {reconnect.afterMs} ms (attempt {reconnect.attempt})
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onClearEvents != null ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onClearEvents}
            disabled={eventCount === 0}
            aria-label="Clear SSE events"
          >
            Clear
          </Button>
        ) : null}
        {canDisconnect ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onDisconnect}
            aria-label="Disconnect SSE stream"
          >
            Disconnect
          </Button>
        ) : null}
      </div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </span>
    </div>
  );
}
