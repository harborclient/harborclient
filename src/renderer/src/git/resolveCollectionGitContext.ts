import type { Collection, SourceControlStatus, StorageProvider } from '#/shared/types';

/**
 * Resolved git context for the active collection, when it is git-backed.
 */
export interface CollectionGitContext {
  /**
   * Git connection id for source-control operations.
   */
  connectionId: string;

  /**
   * Display name of the git connection.
   */
  connectionName: string;

  /**
   * Stable collection uuid.
   */
  collectionUuid: string;

  /**
   * Collection numeric id used to read requests from the store.
   */
  collectionId: number;

  /**
   * Collection display name.
   */
  collectionName: string;

  /**
   * Source-control status for the connection, when loaded.
   */
  status: SourceControlStatus | null;
}

interface ResolveArgs {
  /**
   * Active collection id from draft or sidebar selection.
   */
  collectionId: number | null;

  /**
   * Collections currently loaded in the store.
   */
  collections: Collection[];

  /**
   * Primary provider id used when a collection has no explicit connection id.
   */
  primaryConnectionId: string;

  /**
   * Provider display names keyed by connection id.
   */
  connectionNamesById: Record<string, string>;

  /**
   * Provider types keyed by connection id.
   */
  connectionTypesById: Record<string, StorageProvider | undefined>;

  /**
   * Git statuses keyed by connection id.
   */
  gitStatusesByConnectionId: Record<string, SourceControlStatus>;
}

/**
 * Resolves git sidebar context for the active collection when it is git-backed.
 *
 * @param args - Collection, provider, and git status inputs.
 * @returns Git context for the active collection, or null when unavailable.
 */
export function resolveCollectionGitContext(args: ResolveArgs): CollectionGitContext | null {
  if (args.collectionId == null) {
    return null;
  }

  const collection = args.collections.find((entry) => entry.id === args.collectionId);
  if (collection == null) {
    return null;
  }

  const connectionId = collection.connectionId ?? args.primaryConnectionId;
  const connectionType = args.connectionTypesById[connectionId];
  if (connectionType !== 'git') {
    return null;
  }

  const connectionName = args.connectionNamesById[connectionId] ?? 'Git repository';

  return {
    connectionId,
    connectionName,
    collectionUuid: collection.uuid,
    collectionId: collection.id,
    collectionName: collection.name,
    status: args.gitStatusesByConnectionId[connectionId] ?? null
  };
}
