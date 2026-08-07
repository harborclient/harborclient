import { handle } from '#/main/ipc/handle';
import { ipcArgSchemas } from '#/main/ipc/ipcSchemas';
import { createTeamHubClient } from '#/main/settings/teamHubClient';
import {
  buildDiscussionMlsGroupId,
  decryptDiscussionBodyIdentityV1
} from '#/main/settings/teamHubDiscussionCrypto';
import {
  decryptDiscussionCommentWithMlsGroup,
  encryptDiscussionWithMlsGroup
} from '#/main/settings/teamHubDiscussionMls';
import {
  getStoredTeamHubDeviceIdentity,
  getStoredTeamHubDevicePrivateKey
} from '#/main/settings/teamHubDeviceKeys';
import { listTeamHubs } from '#/main/settings/teamHubSettings';
import type {
  CreateDiscussionCommentInput,
  DiscussionComment,
  DiscussionEntityType,
  ListDiscussionsQuery,
  ListDiscussionsResponse,
  UpdateDiscussionCommentInput
} from '@harborclient/team-hub-api';

/**
 * Target entity for a Team Hub discussion thread.
 */
interface DiscussionTarget {
  /**
   * Entity kind hosting the discussion.
   */
  entityType: DiscussionEntityType;

  /**
   * Server-side entity UUID.
   */
  entityId: string;
}

/**
 * Renderer-facing create/update payload that always carries plaintext bodies.
 */
interface PlaintextDiscussionWriteInput {
  /**
   * Comment body text entered in the renderer.
   */
  body: string;

  /**
   * Parent comment id when creating a reply instead of a root comment.
   */
  parentCommentId?: string;
}

/**
 * Returns a Team Hub client for the given hub connection id.
 *
 * @param hubId - Local Team Hub connection id.
 */
function requireTeamHubClient(hubId: string): ReturnType<typeof createTeamHubClient> {
  const hub = listTeamHubs().find((entry) => entry.id === hubId);
  if (hub == null) {
    throw new Error('Team Hub connection not found');
  }
  return createTeamHubClient(hub);
}

/**
 * Returns true when the connected hub requires encrypted discussion payloads.
 *
 * @param client - Authenticated Team Hub client.
 */
async function isDiscussionE2eeEnabled(
  client: ReturnType<typeof createTeamHubClient>
): Promise<boolean> {
  const session = await client.getSession();
  return session.capabilities.discussionE2ee === true;
}

/**
 * Converts renderer plaintext into the wire payload accepted by discussion routes.
 *
 * @param hubId - Local Team Hub connection id.
 * @param target - Entity hosting the discussion thread.
 * @param input - Plaintext body from the renderer.
 */
async function buildDiscussionWritePayload(
  hubId: string,
  target: DiscussionTarget,
  input: PlaintextDiscussionWriteInput
): Promise<CreateDiscussionCommentInput | UpdateDiscussionCommentInput> {
  const client = requireTeamHubClient(hubId);
  if (!(await isDiscussionE2eeEnabled(client))) {
    return { body: input.body, parentCommentId: input.parentCommentId };
  }

  const identity = getStoredTeamHubDeviceIdentity(hubId);
  const privateKeyMaterial = getStoredTeamHubDevicePrivateKey(hubId);
  if (!identity || !privateKeyMaterial) {
    throw new Error('Enroll this device before sending encrypted comments');
  }

  const session = await client.getSession();
  const encryptedPayload = await encryptDiscussionWithMlsGroup(
    hubId,
    client,
    session.user.id,
    identity.deviceId,
    privateKeyMaterial,
    buildDiscussionMlsGroupId(target.entityType, target.entityId),
    input.body
  );

  return {
    encryptedPayload,
    ...(input.parentCommentId ? { parentCommentId: input.parentCommentId } : {})
  };
}

/**
 * Decrypts encrypted discussion comments returned by Team Hub routes when local keys exist.
 *
 * @param hubId - Local Team Hub connection id.
 * @param comment - Comment returned by Team Hub discussion routes.
 */
async function decryptDiscussionCommentForRenderer(
  hubId: string,
  comment: DiscussionComment
): Promise<DiscussionComment> {
  const client = requireTeamHubClient(hubId);
  if (!(await isDiscussionE2eeEnabled(client))) {
    return comment;
  }

  const identity = getStoredTeamHubDeviceIdentity(hubId);
  const privateKeyMaterial = getStoredTeamHubDevicePrivateKey(hubId);
  if (!identity || !privateKeyMaterial) {
    return comment;
  }

  if (comment.encryptedPayload?.keyFormat === 'mls-v1') {
    const session = await client.getSession();
    return decryptDiscussionCommentWithMlsGroup(
      hubId,
      client,
      comment,
      session.user.id,
      identity.deviceId,
      privateKeyMaterial
    );
  }

  if (comment.encryptedPayload?.keyFormat === 'identity-v1') {
    try {
      const body = decryptDiscussionBodyIdentityV1(
        comment.encryptedPayload.ciphertext,
        privateKeyMaterial,
        comment.encryptedPayload.mlsGroupId
      );
      return { ...comment, body };
    } catch {
      return { ...comment, body: null };
    }
  }

  return comment;
}

/**
 * Decrypts a paginated discussion list for renderer display.
 *
 * @param hubId - Local Team Hub connection id.
 * @param response - Raw list response from Team Hub discussion routes.
 */
async function decryptDiscussionListForRenderer(
  hubId: string,
  response: ListDiscussionsResponse
): Promise<ListDiscussionsResponse> {
  const comments = await Promise.all(
    response.comments.map((comment) => decryptDiscussionCommentForRenderer(hubId, comment))
  );
  return { ...response, comments };
}

/**
 * Lists discussion comments for a target entity using the appropriate route.
 *
 * @param client - Authenticated Team Hub client.
 * @param target - Entity type and UUID.
 * @param query - Optional pagination cursor and limit.
 */
async function listDiscussionsForTarget(
  client: ReturnType<typeof createTeamHubClient>,
  target: DiscussionTarget,
  query?: ListDiscussionsQuery
): Promise<ListDiscussionsResponse> {
  switch (target.entityType) {
    case 'request':
      return client.listRequestDiscussions(target.entityId, query);
    case 'collection':
      return client.listCollectionDiscussions(target.entityId, query);
    case 'folder':
      return client.listFolderDiscussions(target.entityId, query);
    case 'runResult':
      return client.listRunResultDiscussions(target.entityId, query);
  }
}

/**
 * Creates a discussion comment for a target entity using the appropriate route.
 *
 * @param client - Authenticated Team Hub client.
 * @param target - Entity type and UUID.
 * @param input - Comment write payload accepted by Team Hub routes.
 */
async function createDiscussionForTarget(
  client: ReturnType<typeof createTeamHubClient>,
  target: DiscussionTarget,
  input: CreateDiscussionCommentInput
): Promise<DiscussionComment> {
  switch (target.entityType) {
    case 'request':
      return client.createRequestDiscussion(target.entityId, input);
    case 'collection':
      return client.createCollectionDiscussion(target.entityId, input);
    case 'folder':
      return client.createFolderDiscussion(target.entityId, input);
    case 'runResult':
      return client.createRunResultDiscussion(target.entityId, input);
  }
}

/**
 * Registers IPC handlers that proxy Team Hub discussion routes through {@link TeamHubClient}.
 */
export function registerTeamHubDiscussionHandlers(): void {
  handle(
    'teamHubs:listDiscussions',
    ipcArgSchemas.teamHubDiscussionList,
    async (_event, hubId, target, query) => {
      const client = requireTeamHubClient(hubId);
      const response = await listDiscussionsForTarget(client, target, query);
      return decryptDiscussionListForRenderer(hubId, response);
    }
  );

  handle(
    'teamHubs:createDiscussion',
    ipcArgSchemas.teamHubDiscussionCreate,
    async (_event, hubId, target, input) => {
      const client = requireTeamHubClient(hubId);
      const payload = await buildDiscussionWritePayload(hubId, target, input);
      const comment = input.parentCommentId
        ? await client.createDiscussionReply(input.parentCommentId, payload)
        : await createDiscussionForTarget(client, target, payload);
      return decryptDiscussionCommentForRenderer(hubId, comment);
    }
  );

  handle(
    'teamHubs:replyDiscussion',
    ipcArgSchemas.teamHubDiscussionReply,
    async (_event, hubId, target, commentId, input) => {
      const client = requireTeamHubClient(hubId);
      const payload = await buildDiscussionWritePayload(hubId, target, input);
      const comment = await client.createDiscussionReply(commentId, payload);
      return decryptDiscussionCommentForRenderer(hubId, comment);
    }
  );

  handle(
    'teamHubs:updateDiscussionComment',
    ipcArgSchemas.teamHubDiscussionUpdate,
    async (_event, hubId, target, commentId, input) => {
      const client = requireTeamHubClient(hubId);
      const payload = await buildDiscussionWritePayload(hubId, target, input);
      const comment = await client.updateDiscussionComment(commentId, payload);
      return decryptDiscussionCommentForRenderer(hubId, comment);
    }
  );

  handle(
    'teamHubs:deleteDiscussionComment',
    ipcArgSchemas.teamHubDiscussionDelete,
    async (_event, hubId, commentId) => {
      const client = requireTeamHubClient(hubId);
      const comment = await client.deleteDiscussionComment(commentId);
      return decryptDiscussionCommentForRenderer(hubId, comment);
    }
  );
}
