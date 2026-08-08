import type { IDatabase } from '#/db/IDatabase.js';
import type { NoticeRecord } from '#/db/types.js';
import { recordNoticeEventPublished } from '#/server/metrics/teamHubMetrics.js';
import type { INoticeEventBus } from '#/server/notices/INoticeEventBus.js';
import {
  NOTICE_STREAM_EVENT_VERSION,
  type NoticeStreamEvent
} from '#/server/notices/noticeStreamTypes.js';

/**
 * Publishes compact notice stream events after notices are persisted.
 */
export class NoticeEventPublisher {
  /**
   * @param db - Tenant-scoped database handle used for unread counts.
   * @param eventBus - Fan-out bus delivering SSE events.
   */
  constructor(
    private readonly db: IDatabase,
    private readonly eventBus: INoticeEventBus
  ) {}

  /**
   * Publishes `notice.created` events for newly persisted notice rows.
   *
   * @param records - Notice rows returned from {@link IDatabase.createNotices}.
   */
  async publishCreatedNotices(records: NoticeRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const tenantId = this.db.getTenantId();
    const unreadCounts = new Map<string, number>();

    for (const record of records) {
      let unreadCount = unreadCounts.get(record.recipientUserId);
      if (unreadCount == null) {
        unreadCount = await this.db.countUnreadNotices(record.recipientUserId);
        unreadCounts.set(record.recipientUserId, unreadCount);
      }

      const event: NoticeStreamEvent = {
        v: NOTICE_STREAM_EVENT_VERSION,
        type: 'notice.created',
        tenantId,
        recipientUserId: record.recipientUserId,
        noticeId: record.id,
        unreadCount
      };

      await this.eventBus.publish(event);
      recordNoticeEventPublished(event.type);
    }
  }
}
