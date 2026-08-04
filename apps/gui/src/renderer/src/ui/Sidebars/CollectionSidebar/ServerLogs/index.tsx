import {
  EmptySectionLabel,
  FaIcon,
  SidebarItem,
  SidebarListbox,
  SidebarStatusDot,
  SIDEBAR_ITEM_BUTTON_CLASS
} from '@harborclient/sdk/components';
import { useCallback, useMemo, type JSX, type KeyboardEvent, type MouseEvent } from 'react';
import type { LiveServerLogSession } from '@harborclient/core/types';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectLiveServerLogSessions,
  selectLiveServerLogsSessionId
} from '#/renderer/src/store/selectors';
import { openLiveServerLogSession } from '#/renderer/src/store/thunks/liveServers';
import { faFileLines } from '#/renderer/src/fontawesome';
import { useSidebarExpansion } from '#/renderer/src/ui/Sidebars/CollectionSidebar/expansion/useSidebarExpansion';
import {
  sortSidebarItems,
  toSortTimestamp
} from '#/renderer/src/ui/Sidebars/CollectionSidebar/sort/sidebarSort';
import { formatSidebarAbsoluteDate } from '../History/utils';

export { ServerLogsHeaderActions } from './ServerLogsHeaderActions';

/**
 * Formats a log session subtitle with start time and origin.
 *
 * @param session - Retained log session metadata.
 * @returns Subtitle for the sidebar row.
 */
function sessionSubtitle(session: LiveServerLogSession): string {
  const started = formatSidebarAbsoluteDate(session.startedAt);
  return `${started} · ${session.origin}`;
}

/**
 * Server Logs section listing one retained session per live-server start.
 */
export function ServerLogs(): JSX.Element {
  const dispatch = useAppDispatch();
  const allSessions = useAppSelector(selectLiveServerLogSessions);
  const selectedSessionId = useAppSelector(selectLiveServerLogsSessionId);
  const { sectionSort } = useSidebarExpansion();
  const sortMode = sectionSort.liveServerLogs;

  /**
   * Sessions ordered by the Server Logs section sort mode (default: newest first).
   */
  const sessions = useMemo(() => {
    if (sortMode === 'default') {
      return allSessions;
    }
    return sortSidebarItems(allSessions, sortMode, {
      name: (session) => session.serverName,
      createdAt: (session) => toSortTimestamp(session.startedAt)
    });
  }, [allSessions, sortMode]);

  /**
   * Opens the footer logs panel for one session.
   *
   * @param session - Session row to open.
   */
  const handleOpen = useCallback(
    (session: LiveServerLogSession): void => {
      void dispatch(
        openLiveServerLogSession({
          sessionId: session.id,
          savedId: session.savedId
        })
      );
    },
    [dispatch]
  );

  return (
    <div className="flex flex-col gap-0.5 px-1 pb-1">
      {sessions.length === 0 ? <EmptySectionLabel label="No server logs" /> : null}
      {sessions.length > 0 ? (
        <SidebarListbox aria-label="Server logs">
          {sessions.map((session) => {
            const subtitle = sessionSubtitle(session);
            const statusLabel = session.active ? 'Logging' : 'Stopped';
            const selected = selectedSessionId === session.id;

            /**
             * Opens the session when Enter is pressed on the row.
             *
             * @param event - Keyboard event from the listbox option.
             */
            const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
              if (event.key !== 'Enter') {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              handleOpen(session);
            };

            return (
              <SidebarItem
                key={session.id}
                as="li"
                selected={selected}
                listboxOption={{
                  ariaLabel: `${session.serverName}, ${statusLabel}, ${subtitle}`,
                  onClick: (event: MouseEvent) => {
                    event.preventDefault();
                    handleOpen(session);
                  },
                  onKeyDown: handleKeyDown
                }}
              >
                <span className={`${SIDEBAR_ITEM_BUTTON_CLASS} gap-2 rounded-md px-2 py-1`}>
                  <FaIcon
                    icon={faFileLines}
                    className="h-3.5 w-3.5 shrink-0 text-muted"
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 items-baseline gap-2">
                    <span className="min-w-0 shrink truncate">{session.serverName}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-muted">
                      {subtitle}
                    </span>
                  </span>
                  {session.active ? (
                    <SidebarStatusDot
                      className="bg-success"
                      title={statusLabel}
                      srOnlyLabel={statusLabel}
                    />
                  ) : null}
                </span>
              </SidebarItem>
            );
          })}
        </SidebarListbox>
      ) : null}
    </div>
  );
}
