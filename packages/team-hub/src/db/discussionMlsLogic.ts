import { randomUUID } from 'node:crypto';
import type {
  CreateDiscussionMlsCommitInput,
  CreateDiscussionMlsWelcomeInput,
  DiscussionMlsCommitRecord,
  DiscussionMlsGroupStateRecord,
  DiscussionMlsWelcomeRecord,
  DiscussionTargetEntityType,
  ListDiscussionMlsCommitsResult,
  UpsertDiscussionMlsGroupStateInput
} from '#/db/types.js';

/**
 * Maximum byte length accepted for base64 MLS commit or welcome payloads.
 */
export const MAX_DISCUSSION_MLS_PAYLOAD_LENGTH = 262_144;

/**
 * Default page size when listing MLS commits for offline catch-up.
 */
export const DEFAULT_DISCUSSION_MLS_COMMITS_LIST_LIMIT = 100;

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MLS_GROUP_ID_PATTERN = /^thread:(request|collection|folder|runResult):(.+)$/i;

/**
 * Parsed entity target encoded in a canonical MLS group id.
 */
export interface ParsedDiscussionMlsGroupId {
  /**
   * Entity type hosting the discussion thread.
   */
  targetEntityType: DiscussionTargetEntityType;

  /**
   * Entity id hosting the discussion thread.
   */
  targetEntityId: string;
}

/**
 * Parses a canonical MLS group id into discussion target metadata.
 *
 * @param mlsGroupId - Group id such as `thread:request:<uuid>`.
 * @returns Parsed target metadata or null when the id is invalid.
 */
export function parseDiscussionMlsGroupId(mlsGroupId: string): ParsedDiscussionMlsGroupId | null {
  const match = MLS_GROUP_ID_PATTERN.exec(mlsGroupId.trim());
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    targetEntityType: match[1] as DiscussionTargetEntityType,
    targetEntityId: match[2]
  };
}

/**
 * Validates base64 MLS control payload bytes before persistence.
 *
 * @param value - Base64-encoded commit or welcome bytes from a client.
 * @param label - Human-readable field name for error messages.
 */
export function validateDiscussionMlsPayload(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} is required`);
  }

  if (normalized.length > MAX_DISCUSSION_MLS_PAYLOAD_LENGTH) {
    throw new Error(`${label} is too large`);
  }

  return normalized;
}

/**
 * Validates client-supplied MLS commit fields before persistence.
 *
 * @param input - Commit payload from an authenticated client.
 */
export function validateCreateDiscussionMlsCommitInput(
  input: CreateDiscussionMlsCommitInput
): void {
  if (!parseDiscussionMlsGroupId(input.mlsGroupId)) {
    throw new Error('MLS group id must use the thread:{entityType}:{entityId} format');
  }

  if (!Number.isInteger(input.epoch) || input.epoch < 0) {
    throw new Error('MLS epoch must be a non-negative integer');
  }

  if (!UUID_V4_PATTERN.test(input.senderDeviceId)) {
    throw new Error('Sender device id must be a UUID v4 value');
  }

  validateDiscussionMlsPayload(input.ciphertext, 'MLS commit ciphertext');
}

/**
 * Validates client-supplied MLS welcome fields before persistence.
 *
 * @param input - Welcome payload from an authenticated client.
 */
export function validateCreateDiscussionMlsWelcomeInput(
  input: CreateDiscussionMlsWelcomeInput
): void {
  if (!parseDiscussionMlsGroupId(input.mlsGroupId)) {
    throw new Error('MLS group id must use the thread:{entityType}:{entityId} format');
  }

  if (!UUID_V4_PATTERN.test(input.recipientDeviceId)) {
    throw new Error('Recipient device id must be a UUID v4 value');
  }

  validateDiscussionMlsPayload(input.ciphertext, 'MLS welcome ciphertext');
  validateDiscussionMlsPayload(input.ratchetTree, 'MLS ratchet tree');
}

/**
 * Builds a persisted MLS commit record from validated client input.
 *
 * @param input - Commit payload from an authenticated client.
 * @param actingUserId - User posting the commit.
 */
export function buildDiscussionMlsCommitRecord(
  input: CreateDiscussionMlsCommitInput,
  actingUserId: string
): DiscussionMlsCommitRecord {
  validateCreateDiscussionMlsCommitInput(input);

  return {
    id: randomUUID(),
    mlsGroupId: input.mlsGroupId.trim(),
    epoch: input.epoch,
    ciphertext: input.ciphertext.trim(),
    senderDeviceId: input.senderDeviceId,
    createdAt: new Date(),
    createdByUserId: actingUserId
  };
}

/**
 * Builds a persisted MLS welcome record from validated client input.
 *
 * @param input - Welcome payload from an authenticated client.
 * @param actingUserId - User posting the welcome.
 */
export function buildDiscussionMlsWelcomeRecord(
  input: CreateDiscussionMlsWelcomeInput,
  actingUserId: string
): DiscussionMlsWelcomeRecord {
  validateCreateDiscussionMlsWelcomeInput(input);

  return {
    id: randomUUID(),
    mlsGroupId: input.mlsGroupId.trim(),
    recipientDeviceId: input.recipientDeviceId,
    ciphertext: input.ciphertext.trim(),
    ratchetTree: input.ratchetTree.trim(),
    createdAt: new Date(),
    createdByUserId: actingUserId
  };
}

/**
 * Builds an upsert payload for discussion MLS group state.
 *
 * @param input - Group state fields supplied by a client commit.
 * @param actingUserId - User posting the commit that advanced epoch state.
 */
export function buildDiscussionMlsGroupStateRecord(
  input: UpsertDiscussionMlsGroupStateInput,
  actingUserId: string
): DiscussionMlsGroupStateRecord {
  const parsed = parseDiscussionMlsGroupId(input.mlsGroupId);
  if (!parsed) {
    throw new Error('MLS group id must use the thread:{entityType}:{entityId} format');
  }

  if (!Number.isInteger(input.currentEpoch) || input.currentEpoch < 0) {
    throw new Error('MLS epoch must be a non-negative integer');
  }

  const now = new Date();
  return {
    mlsGroupId: input.mlsGroupId.trim(),
    targetEntityType: parsed.targetEntityType,
    targetEntityId: parsed.targetEntityId,
    currentEpoch: input.currentEpoch,
    createdAt: now,
    updatedAt: now,
    createdByUserId: actingUserId,
    updatedByUserId: actingUserId
  };
}

/**
 * Normalizes an MLS commit list page size with a safe default and upper bound.
 *
 * @param limit - Optional caller-supplied page size.
 * @returns Clamped limit suitable for database queries.
 */
export function normalizeDiscussionMlsCommitListLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) {
    return DEFAULT_DISCUSSION_MLS_COMMITS_LIST_LIMIT;
  }

  const normalized = Math.trunc(limit);
  if (normalized < 1) {
    return 1;
  }

  if (normalized > DEFAULT_DISCUSSION_MLS_COMMITS_LIST_LIMIT) {
    return DEFAULT_DISCUSSION_MLS_COMMITS_LIST_LIMIT;
  }

  return normalized;
}

/**
 * Parses an opaque MLS commit list cursor into the last seen epoch.
 *
 * @param cursor - Stringified epoch from a prior list response.
 * @returns Parsed epoch floor, or null when starting from the beginning.
 * @throws {Error} When the cursor is not a non-negative integer string.
 */
export function parseDiscussionMlsCommitListCursor(cursor?: string): number | null {
  if (cursor == null || cursor.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(cursor.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error('MLS commit list cursor must be a non-negative integer');
  }

  return parsed;
}

/**
 * Builds a paginated MLS commit list response from ascending epoch query rows.
 *
 * @param commits - Commits ordered by epoch ascending, possibly including one extra row.
 * @param limit - Requested page size before the extra probe row.
 * @returns Commits page and optional next cursor.
 */
export function buildDiscussionMlsCommitListResult(
  commits: DiscussionMlsCommitRecord[],
  limit: number
): ListDiscussionMlsCommitsResult {
  const hasMore = commits.length > limit;
  const page = hasMore ? commits.slice(0, limit) : commits;
  const lastCommit = page[page.length - 1];

  return {
    commits: page,
    nextCursor: hasMore && lastCommit ? String(lastCommit.epoch) : undefined
  };
}
