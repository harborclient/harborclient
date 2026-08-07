import type { IDatabase } from '#/db/IDatabase.js';
import type {
  CollectionRecord,
  DiscussionTargetEntityType,
  FolderRecord,
  RunResultRecord,
  SavedRequestRecord,
  UserRecord
} from '#/db/types.js';
import { canAccessCollection, canUseDataApi, isAdmin } from '#/server/auth/accessControl.js';

/**
 * Resolved target entity metadata used for discussion access checks.
 */
export interface DiscussionTargetContext {
  /**
   * Entity type hosting the discussion thread.
   */
  targetEntityType: DiscussionTargetEntityType;

  /**
   * Entity id hosting the discussion thread.
   */
  targetEntityId: string;

  /**
   * Collection id governing access for collection-scoped entities.
   */
  collectionId: string | null;
}

/**
 * Loads a request and returns discussion target context when it exists.
 *
 * @param db - Database handle scoped to the active tenant.
 * @param requestId - Saved request identifier.
 * @returns Target context or null when the request is missing.
 */
export async function resolveRequestDiscussionTarget(
  db: IDatabase,
  requestId: string
): Promise<DiscussionTargetContext | null> {
  const request = await db.findRequestById(requestId);
  if (!request) {
    return null;
  }

  return {
    targetEntityType: 'request',
    targetEntityId: request.id,
    collectionId: request.collectionId
  };
}

/**
 * Loads a collection and returns discussion target context when it exists.
 *
 * @param db - Database handle scoped to the active tenant.
 * @param collectionId - Collection identifier.
 * @returns Target context or null when the collection is missing.
 */
export async function resolveCollectionDiscussionTarget(
  db: IDatabase,
  collectionId: string
): Promise<DiscussionTargetContext | null> {
  const collection = await db.findCollectionById(collectionId);
  if (!collection) {
    return null;
  }

  return {
    targetEntityType: 'collection',
    targetEntityId: collection.id,
    collectionId: collection.id
  };
}

/**
 * Loads a folder and returns discussion target context when it exists.
 *
 * @param db - Database handle scoped to the active tenant.
 * @param folderId - Folder identifier.
 * @returns Target context or null when the folder is missing.
 */
export async function resolveFolderDiscussionTarget(
  db: IDatabase,
  folderId: string
): Promise<DiscussionTargetContext | null> {
  const folder = await db.findFolderById(folderId);
  if (!folder) {
    return null;
  }

  return {
    targetEntityType: 'folder',
    targetEntityId: folder.id,
    collectionId: folder.collectionId
  };
}

/**
 * Loads a run result and returns discussion target context when it exists.
 *
 * Run results are not collection-scoped in storage, so access follows run-result
 * read rules rather than collection access lists.
 *
 * @param db - Database handle scoped to the active tenant.
 * @param runResultId - Run result identifier.
 * @returns Target context or null when the run result is missing.
 */
export async function resolveRunResultDiscussionTarget(
  db: IDatabase,
  runResultId: string
): Promise<DiscussionTargetContext | null> {
  const runResult = await db.findRunResultById(runResultId);
  if (!runResult) {
    return null;
  }

  return {
    targetEntityType: 'runResult',
    targetEntityId: runResult.id,
    collectionId: null
  };
}

/**
 * Returns true when the user may read or write discussions on the target entity.
 *
 * @param user - Authenticated user attached to the request.
 * @param target - Resolved discussion target metadata.
 * @returns True when the user may access discussions for the target.
 */
export function canAccessDiscussionTarget(
  user: UserRecord,
  target: DiscussionTargetContext
): boolean {
  if (!canUseDataApi(user)) {
    return false;
  }

  if (target.targetEntityType === 'runResult') {
    return true;
  }

  if (!target.collectionId) {
    return false;
  }

  return canAccessCollection(user, target.collectionId);
}

/**
 * Returns true when the user may tombstone a discussion comment.
 *
 * Authors may delete their own comments; admins may delete any comment they can access.
 *
 * @param user - Authenticated user attached to the request.
 * @param authorUserId - Comment author user id.
 * @param target - Resolved discussion target metadata.
 * @returns True when the delete action is permitted.
 */
export function canDeleteDiscussionComment(
  user: UserRecord,
  authorUserId: string | null,
  target: DiscussionTargetContext
): boolean {
  if (!canAccessDiscussionTarget(user, target)) {
    return false;
  }

  if (authorUserId === user.id) {
    return true;
  }

  return isAdmin(user);
}

/**
 * Loads user records for discussion comment authors referenced by a page.
 *
 * @param db - Database handle scoped to the active tenant.
 * @param authorUserIds - Unique author user ids referenced by the page.
 * @returns Map of user id to resolved user records; missing users are omitted.
 */
export async function resolveDiscussionAuthors(
  db: IDatabase,
  authorUserIds: string[]
): Promise<Map<string, UserRecord>> {
  const authors = new Map<string, UserRecord>();

  await Promise.all(
    authorUserIds.map(async (userId) => {
      const user = await db.findUserById(userId);
      if (user) {
        authors.set(userId, user);
      }
    })
  );

  return authors;
}

/**
 * Convenience helper returning collection records for route tests.
 *
 * @param collection - Collection record under discussion.
 * @returns Discussion target context for the collection entity itself.
 */
export function collectionDiscussionContext(collection: CollectionRecord): DiscussionTargetContext {
  return {
    targetEntityType: 'collection',
    targetEntityId: collection.id,
    collectionId: collection.id
  };
}

/**
 * Convenience helper returning request-backed discussion context.
 *
 * @param request - Saved request hosting the discussion.
 * @returns Discussion target context for the request entity.
 */
export function requestDiscussionContext(request: SavedRequestRecord): DiscussionTargetContext {
  return {
    targetEntityType: 'request',
    targetEntityId: request.id,
    collectionId: request.collectionId
  };
}

/**
 * Convenience helper returning folder-backed discussion context.
 *
 * @param folder - Folder hosting the discussion.
 * @returns Discussion target context for the folder entity.
 */
export function folderDiscussionContext(folder: FolderRecord): DiscussionTargetContext {
  return {
    targetEntityType: 'folder',
    targetEntityId: folder.id,
    collectionId: folder.collectionId
  };
}

/**
 * Convenience helper returning run-result-backed discussion context.
 *
 * @param runResult - Run result hosting the discussion.
 * @returns Discussion target context for the run result entity.
 */
export function runResultDiscussionContext(runResult: RunResultRecord): DiscussionTargetContext {
  return {
    targetEntityType: 'runResult',
    targetEntityId: runResult.id,
    collectionId: null
  };
}
