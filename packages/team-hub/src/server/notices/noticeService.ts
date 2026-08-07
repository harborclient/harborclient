import type { IDatabase } from '#/db/IDatabase.js';
import {
  discussionTargetToNoticeEntityType,
  isSelfNotice,
  listCollectionNoticeRecipients,
  listRunResultNoticeRecipients,
  shouldDeliverNotice,
  type NoticeDeliveryReason
} from '#/db/noticeLogic.js';
import { parseMentionedUserIds } from '#/db/parseMentions.js';
import type {
  CollectionRecord,
  CreateNoticeInput,
  DiscussionCommentRecord,
  FolderRecord,
  NoticeEventType,
  RunResultRecord,
  SavedRequestRecord,
  UserRecord
} from '#/db/types.js';
import { canAccessCollection, canUseDataApi } from '#/server/auth/accessControl.js';
import {
  DEFAULT_COLLABORATION_CONFIG,
  shouldIncludeDiscussionNoticePreview,
  type CollaborationConfig
} from '#/config/collaborationConfig.js';
import type { INoticeEventBus } from '#/server/notices/INoticeEventBus.js';
import { NoticeEventPublisher } from '#/server/notices/NoticeEventPublisher.js';

/**
 * Resolved entity context used when building notice payloads for discussions.
 */
interface DiscussionNoticeContext {
  /**
   * Collection id for access filtering, when known.
   */
  collectionId: string | null;

  /**
   * Request id when the discussion targets or relates to a request.
   */
  requestId: string | null;

  /**
   * Folder id when the discussion targets a folder.
   */
  folderId: string | null;

  /**
   * Run result id when the discussion targets a run result.
   */
  runResultId: string | null;

  /**
   * Human-readable target label for display metadata.
   */
  targetLabel: string;

  /**
   * HTTP method when the target is a request.
   */
  method?: string;

  /**
   * Request display name when distinct from the target label.
   */
  requestName?: string;

  /**
   * Run result label when the discussion targets a saved run snapshot.
   */
  runLabel?: string;
}

/**
 * Recipient candidate with the delivery reason that qualified them.
 */
interface NoticeRecipientCandidate {
  /**
   * User id that should receive the notice.
   */
  userId: string;

  /**
   * Why this recipient is eligible for the event.
   */
  reason: NoticeDeliveryReason;

  /**
   * Notice event type to persist for this recipient.
   */
  eventType: NoticeEventType;
}

/**
 * Creates collaboration notices in response to Team Hub activity events.
 */
export class NoticeService {
  /**
   * @param db - Tenant-scoped database handle.
   * @param publisher - Optional SSE publisher for created notices.
   * @param getCollaboration - Returns active collaboration settings for preview suppression.
   */
  constructor(
    private readonly db: IDatabase,
    private readonly publisher?: NoticeEventPublisher,
    private readonly getCollaboration: () => CollaborationConfig = () =>
      DEFAULT_COLLABORATION_CONFIG
  ) {}

  /**
   * Creates notices when another user updates a saved request.
   *
   * @param request - Updated saved request record.
   * @param actorUser - User who performed the update.
   */
  async createNoticesForRequestUpdate(
    request: SavedRequestRecord,
    actorUser: UserRecord
  ): Promise<void> {
    const users = await this.db.listUsers();
    const recipients = listCollectionNoticeRecipients(users, request.collectionId, actorUser.id);

    const inputs: CreateNoticeInput[] = [];
    for (const recipient of recipients) {
      const level = await this.getNotificationLevel(recipient.id);
      if (!shouldDeliverNotice(level, 'entity_activity')) {
        continue;
      }

      inputs.push({
        recipientUserId: recipient.id,
        eventType: 'request.updated',
        entityType: 'request',
        entityId: request.id,
        requestId: request.id,
        collectionId: request.collectionId,
        folderId: request.folderId,
        actorUserId: actorUser.id,
        displayMetadata: {
          actorName: actorUser.name,
          targetLabel: request.name,
          method: request.method,
          requestName: request.name
        }
      });
    }

    await this.persistNotices(inputs);
  }

  /**
   * Creates notices and auto-subscribes participants after a discussion comment is created.
   *
   * @param comment - Persisted discussion comment record.
   * @param parent - Parent comment when this row is a reply, otherwise null.
   * @param actorUser - User who authored the comment.
   */
  async createNoticesForDiscussionComment(
    comment: DiscussionCommentRecord,
    parent: DiscussionCommentRecord | null,
    actorUser: UserRecord
  ): Promise<void> {
    await this.db.subscribeDiscussionThread(actorUser.id, comment.rootCommentId);

    const context = await this.resolveDiscussionNoticeContext(comment);
    const users = await this.db.listUsers();
    const mentionedUserIds = new Set(parseMentionedUserIds(comment.body, users));

    for (const mentionedUserId of mentionedUserIds) {
      if (mentionedUserId !== actorUser.id) {
        await this.db.subscribeDiscussionThread(mentionedUserId, comment.rootCommentId);
      }
    }

    const subscribers = await this.db.listDiscussionThreadSubscribers(comment.rootCommentId);
    const subscriberSet = new Set(subscribers);
    const candidates = new Map<string, NoticeRecipientCandidate>();

    for (const mentionedUserId of mentionedUserIds) {
      if (isSelfNotice(actorUser.id, mentionedUserId)) {
        continue;
      }
      candidates.set(mentionedUserId, {
        userId: mentionedUserId,
        reason: 'mention',
        eventType: 'discussion.mention'
      });
    }

    for (const subscriberId of subscriberSet) {
      if (isSelfNotice(actorUser.id, subscriberId) || candidates.has(subscriberId)) {
        continue;
      }
      candidates.set(subscriberId, {
        userId: subscriberId,
        reason: 'thread_subscription',
        eventType: parent ? 'discussion.reply' : 'discussion.comment'
      });
    }

    if (parent?.authorUserId && !isSelfNotice(actorUser.id, parent.authorUserId)) {
      if (!candidates.has(parent.authorUserId)) {
        candidates.set(parent.authorUserId, {
          userId: parent.authorUserId,
          reason: 'parent_author',
          eventType: 'discussion.reply'
        });
      }
    }

    const inputs: CreateNoticeInput[] = [];
    for (const candidate of candidates.values()) {
      const recipient = users.find((user) => user.id === candidate.userId);
      if (!recipient || !this.canRecipientAccessDiscussion(recipient, context)) {
        continue;
      }

      const level = await this.getNotificationLevel(candidate.userId);
      if (!shouldDeliverNotice(level, candidate.reason)) {
        continue;
      }

      inputs.push({
        recipientUserId: candidate.userId,
        eventType: candidate.eventType,
        entityType: discussionTargetToNoticeEntityType(comment.targetEntityType),
        entityId: comment.targetEntityId,
        requestId: context.requestId,
        collectionId: context.collectionId,
        folderId: context.folderId,
        runResultId: context.runResultId,
        discussionThreadId: comment.rootCommentId,
        discussionCommentId: comment.id,
        actorUserId: actorUser.id,
        displayMetadata: {
          actorName: actorUser.name,
          targetLabel: context.targetLabel,
          method: context.method,
          requestName: context.requestName,
          ...(shouldIncludeDiscussionNoticePreview(this.getCollaboration())
            ? { previewText: truncatePreview(comment.body) }
            : {})
        }
      });
    }

    await this.persistNotices(inputs);
  }

  /**
   * Creates notices when a run result snapshot is saved.
   *
   * @param runResult - Persisted run result record.
   * @param actorUser - User who saved the run result.
   * @param collectionId - Optional collection id extracted from the export payload.
   */
  async createNoticesForRunResult(
    runResult: RunResultRecord,
    actorUser: UserRecord,
    collectionId: string | null
  ): Promise<void> {
    const users = await this.db.listUsers();
    const recipients = listRunResultNoticeRecipients(users, actorUser.id, collectionId);
    const hasFailures = runResult.summary.failed > 0;
    const eventType: NoticeEventType = hasFailures ? 'runResult.failed' : 'runResult.created';

    const inputs: CreateNoticeInput[] = [];
    for (const recipient of recipients) {
      const level = await this.getNotificationLevel(recipient.id);
      if (!shouldDeliverNotice(level, 'entity_activity')) {
        continue;
      }

      inputs.push({
        recipientUserId: recipient.id,
        eventType,
        entityType: 'runResult',
        entityId: runResult.id,
        collectionId,
        runResultId: runResult.id,
        actorUserId: actorUser.id,
        displayMetadata: {
          actorName: actorUser.name,
          targetLabel: runResult.label,
          runLabel: runResult.label,
          requestName: runResult.requestName ?? undefined
        }
      });
    }

    await this.persistNotices(inputs);
  }

  /**
   * Persists notice rows and publishes compact SSE events when configured.
   *
   * @param inputs - Notice rows to insert.
   */
  private async persistNotices(inputs: CreateNoticeInput[]): Promise<void> {
    if (inputs.length === 0) {
      return;
    }

    const records = await this.db.createNotices(inputs);
    if (this.publisher) {
      await this.publisher.publishCreatedNotices(records);
    }
  }

  /**
   * Loads notification settings for a user, defaulting to `all` when unset.
   *
   * @param userId - User account id.
   * @returns Effective notification level for the user.
   */
  private async getNotificationLevel(userId: string) {
    const settings = await this.db.getUserNotificationSettings(userId);
    return settings.level;
  }

  /**
   * Returns true when a recipient can access the discussion target entity.
   *
   * @param recipient - Candidate notice recipient.
   * @param context - Resolved discussion entity context.
   * @returns True when the recipient may view the target entity.
   */
  private canRecipientAccessDiscussion(
    recipient: UserRecord,
    context: DiscussionNoticeContext
  ): boolean {
    if (!canUseDataApi(recipient)) {
      return false;
    }

    if (context.runResultId) {
      if (context.collectionId) {
        return canAccessCollection(recipient, context.collectionId);
      }
      return true;
    }

    if (!context.collectionId) {
      return false;
    }

    return canAccessCollection(recipient, context.collectionId);
  }

  /**
   * Resolves collection and label metadata for a discussion comment target.
   *
   * @param comment - Discussion comment record.
   * @returns Context fields used when creating notices.
   */
  private async resolveDiscussionNoticeContext(
    comment: DiscussionCommentRecord
  ): Promise<DiscussionNoticeContext> {
    switch (comment.targetEntityType) {
      case 'request': {
        const request = await this.db.findRequestById(comment.targetEntityId);
        return buildRequestDiscussionContext(request);
      }
      case 'collection': {
        const collection = await this.db.findCollectionById(comment.targetEntityId);
        return buildCollectionDiscussionContext(collection);
      }
      case 'folder': {
        const folder = await this.db.findFolderById(comment.targetEntityId);
        return buildFolderDiscussionContext(folder);
      }
      case 'runResult': {
        const runResult = await this.db.findRunResultById(comment.targetEntityId);
        return buildRunResultDiscussionContext(runResult);
      }
      default:
        return {
          collectionId: null,
          requestId: null,
          folderId: null,
          runResultId: null,
          targetLabel: 'Discussion'
        };
    }
  }
}

/**
 * Truncates comment body text for notice preview metadata.
 *
 * @param body - Full comment body.
 * @returns Short preview string.
 */
function truncatePreview(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= 120) {
    return trimmed;
  }

  return `${trimmed.slice(0, 117)}...`;
}

/**
 * Builds discussion notice context for a saved request target.
 *
 * @param request - Saved request record, when found.
 * @returns Notice context for the request target.
 */
function buildRequestDiscussionContext(
  request: SavedRequestRecord | null
): DiscussionNoticeContext {
  if (!request) {
    return {
      collectionId: null,
      requestId: null,
      folderId: null,
      runResultId: null,
      targetLabel: 'Request'
    };
  }

  return {
    collectionId: request.collectionId,
    requestId: request.id,
    folderId: request.folderId,
    runResultId: null,
    targetLabel: request.name,
    method: request.method,
    requestName: request.name
  };
}

/**
 * Builds discussion notice context for a collection target.
 *
 * @param collection - Collection record, when found.
 * @returns Notice context for the collection target.
 */
function buildCollectionDiscussionContext(
  collection: CollectionRecord | null
): DiscussionNoticeContext {
  if (!collection) {
    return {
      collectionId: null,
      requestId: null,
      folderId: null,
      runResultId: null,
      targetLabel: 'Collection'
    };
  }

  return {
    collectionId: collection.id,
    requestId: null,
    folderId: null,
    runResultId: null,
    targetLabel: collection.name
  };
}

/**
 * Builds discussion notice context for a folder target.
 *
 * @param folder - Folder record, when found.
 * @returns Notice context for the folder target.
 */
function buildFolderDiscussionContext(folder: FolderRecord | null): DiscussionNoticeContext {
  if (!folder) {
    return {
      collectionId: null,
      requestId: null,
      folderId: null,
      runResultId: null,
      targetLabel: 'Folder'
    };
  }

  return {
    collectionId: folder.collectionId,
    requestId: null,
    folderId: folder.id,
    runResultId: null,
    targetLabel: folder.name
  };
}

/**
 * Builds discussion notice context for a run result target.
 *
 * @param runResult - Run result record, when found.
 * @returns Notice context for the run result target.
 */
function buildRunResultDiscussionContext(
  runResult: RunResultRecord | null
): DiscussionNoticeContext {
  if (!runResult) {
    return {
      collectionId: null,
      requestId: null,
      folderId: null,
      runResultId: null,
      targetLabel: 'Run result'
    };
  }

  return {
    collectionId: extractCollectionIdFromRunPayload(runResult.payload),
    requestId: null,
    folderId: null,
    runResultId: runResult.id,
    targetLabel: runResult.label,
    runLabel: runResult.label,
    requestName: runResult.requestName ?? undefined
  };
}

/**
 * Reads an embedded collection id from a run result payload when present.
 *
 * @param payload - Stored run result export payload.
 * @returns Collection id or null when absent.
 */
function extractCollectionIdFromRunPayload(payload: Record<string, unknown>): string | null {
  const collection = payload.collection;
  if (collection == null || typeof collection !== 'object' || Array.isArray(collection)) {
    return null;
  }

  const id = (collection as Record<string, unknown>).id;
  return typeof id === 'string' ? id : null;
}

let configuredNoticeEventBus: INoticeEventBus | undefined;
let configuredGetCollaboration: () => CollaborationConfig = () => DEFAULT_COLLABORATION_CONFIG;

/**
 * Configures the shared notice event bus used by {@link createNoticeService}.
 *
 * @param eventBus - Process-wide notice event bus, when notice SSE is enabled.
 */
export function setNoticeEventBus(eventBus: INoticeEventBus | undefined): void {
  configuredNoticeEventBus = eventBus;
}

/**
 * Configures the collaboration settings getter used by {@link createNoticeService}.
 *
 * @param getCollaboration - Returns active collaboration settings from server.yaml.
 */
export function setCollaborationConfigGetter(getCollaboration: () => CollaborationConfig): void {
  configuredGetCollaboration = getCollaboration;
}

/**
 * Factory helper for route handlers that need notice side effects.
 *
 * @param db - Tenant-scoped database handle.
 * @returns Notice service bound to the database handle.
 */
export function createNoticeService(db: IDatabase): NoticeService {
  const publisher = configuredNoticeEventBus
    ? new NoticeEventPublisher(db, configuredNoticeEventBus)
    : undefined;
  return new NoticeService(db, publisher, configuredGetCollaboration);
}
