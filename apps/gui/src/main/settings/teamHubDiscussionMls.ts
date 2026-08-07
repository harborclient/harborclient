import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  hkdfSync,
  randomBytes
} from 'node:crypto';
import type {
  DiscussionComment,
  DiscussionEncryptedPayloadInput
} from '@harborclient/team-hub-api';
import type { TeamHubClient } from '@harborclient/team-hub-api';
import { getStoredMlsGroupState, storeMlsGroupState } from './teamHubDiscussionMlsStorage';

/**
 * Locally persisted MLS group state for one discussion thread.
 */
export interface LocalMlsGroupState {
  /**
   * Canonical MLS group id for the discussion thread.
   */
  mlsGroupId: string;

  /**
   * Latest MLS epoch observed for this device.
   */
  epoch: number;

  /**
   * Base64-encoded 32-byte group secret for the current epoch.
   */
  groupSecret: string;

  /**
   * Active member ids in `userId#deviceId` form.
   */
  members: string[];

  /**
   * When false, this device was removed and must not encrypt or decrypt new comments.
   */
  active: boolean;
}

/**
 * Commit payload relayed through Team Hub as opaque base64 bytes.
 */
interface MlsCommitPayload {
  /**
   * Commit kind describing the membership change.
   */
  type: 'init' | 'add' | 'remove';

  /**
   * MLS epoch after applying the commit.
   */
  epoch: number;

  /**
   * Member ids after applying the commit.
   */
  members: string[];

  /**
   * Member id added by an add commit.
   */
  addedMember?: string;

  /**
   * Member id removed by a remove commit.
   */
  removedMember?: string;

  /**
   * Group secrets wrapped for each member that should receive the new epoch key.
   */
  wrappedSecrets: Record<string, string>;
}

/**
 * Welcome payload delivered to a newly added device.
 */
interface MlsWelcomePayload {
  /**
   * MLS epoch after joining.
   */
  epoch: number;

  /**
   * Member ids after joining.
   */
  members: string[];

  /**
   * Group secret wrapped for the recipient device only.
   */
  wrappedSecret: string;
}

const MLS_V1_MESSAGE_INFO = 'harborclient-mls-v1-message';

/**
 * Builds the stable MLS member id used in commit and welcome payloads.
 *
 * @param userId - Team Hub user account id.
 * @param deviceId - Enrolled client device id.
 */
export function buildMlsMemberId(userId: string, deviceId: string): string {
  return `${userId}#${deviceId}`;
}

/**
 * Derives SPKI public key material from PKCS8 private key bytes.
 *
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes.
 */
export function derivePublicKeyMaterial(privateKeyMaterial: string): string {
  const privateKey = createPrivateKey({
    key: Buffer.from(privateKeyMaterial, 'base64'),
    format: 'der',
    type: 'pkcs8'
  });
  return createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).toString('base64');
}

/**
 * Wraps a group secret for one member using that member's public key material.
 *
 * @param groupSecret - Raw group secret bytes.
 * @param publicKeyMaterial - Base64 SPKI public key bytes for the recipient member.
 * @param mlsGroupId - MLS group identifier for the discussion thread.
 * @param memberId - Recipient member id in `userId#deviceId` form.
 */
function wrapGroupSecret(
  groupSecret: Buffer,
  publicKeyMaterial: string,
  mlsGroupId: string,
  memberId: string
): string {
  const key = Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(publicKeyMaterial, 'base64'),
      Buffer.from(mlsGroupId, 'utf8'),
      `harborclient-mls-v1-wrap:${memberId}`,
      32
    )
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(groupSecret), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Unwraps a group secret previously wrapped for one member.
 *
 * @param wrapped - Base64 wrapped secret payload.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for the recipient device.
 * @param mlsGroupId - MLS group identifier for the discussion thread.
 * @param memberId - Recipient member id in `userId#deviceId` form.
 */
function unwrapGroupSecret(
  wrapped: string,
  privateKeyMaterial: string,
  mlsGroupId: string,
  memberId: string
): Buffer {
  const payload = Buffer.from(wrapped, 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const publicKeyMaterial = derivePublicKeyMaterial(privateKeyMaterial);
  const key = Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(publicKeyMaterial, 'base64'),
      Buffer.from(mlsGroupId, 'utf8'),
      `harborclient-mls-v1-wrap:${memberId}`,
      32
    )
  );
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Encrypts a discussion body with the current MLS group secret and epoch.
 *
 * @param plaintext - Comment body text to encrypt.
 * @param groupSecret - Raw group secret bytes for the active epoch.
 * @param epoch - MLS epoch used for message key derivation.
 */
export function encryptMlsDiscussionBody(
  plaintext: string,
  groupSecret: Buffer,
  epoch: number
): string {
  const key = Buffer.from(
    hkdfSync('sha256', groupSecret, Buffer.from(String(epoch), 'utf8'), MLS_V1_MESSAGE_INFO, 32)
  );
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

/**
 * Decrypts an MLS discussion body encrypted for a specific epoch.
 *
 * @param encoded - Base64 encrypted body payload.
 * @param groupSecret - Raw group secret bytes for the message epoch.
 * @param epoch - MLS epoch used for message key derivation.
 */
export function decryptMlsDiscussionBody(
  encoded: string,
  groupSecret: Buffer,
  epoch: number
): string {
  const payload = Buffer.from(encoded, 'base64');
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const key = Buffer.from(
    hkdfSync('sha256', groupSecret, Buffer.from(String(epoch), 'utf8'), MLS_V1_MESSAGE_INFO, 32)
  );
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

/**
 * Serializes an MLS commit payload for relay through Team Hub.
 *
 * @param payload - Commit payload to encode.
 */
function encodeCommitPayload(payload: MlsCommitPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

/**
 * Parses an MLS commit payload relayed through Team Hub.
 *
 * @param encoded - Base64 commit payload from the server.
 */
function decodeCommitPayload(encoded: string): MlsCommitPayload {
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as MlsCommitPayload;
}

/**
 * Serializes an MLS welcome payload for relay through Team Hub.
 *
 * @param payload - Welcome payload to encode.
 */
function encodeWelcomePayload(payload: MlsWelcomePayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

/**
 * Parses an MLS welcome payload relayed through Team Hub.
 *
 * @param encoded - Base64 welcome payload from the server.
 */
function decodeWelcomePayload(encoded: string): MlsWelcomePayload {
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as MlsWelcomePayload;
}

/**
 * Initializes a new MLS group for a discussion thread on this device.
 *
 * @param mlsGroupId - Canonical MLS group id for the discussion thread.
 * @param memberId - Local member id in `userId#deviceId` form.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for the creator device.
 */
export function initializeLocalMlsGroup(
  mlsGroupId: string,
  memberId: string,
  privateKeyMaterial: string
): { state: LocalMlsGroupState; commitCiphertext: string } {
  const groupSecret = randomBytes(32);
  const publicKeyMaterial = derivePublicKeyMaterial(privateKeyMaterial);
  const wrappedSecrets: Record<string, string> = {
    [memberId]: wrapGroupSecret(groupSecret, publicKeyMaterial, mlsGroupId, memberId)
  };
  const state: LocalMlsGroupState = {
    mlsGroupId,
    epoch: 0,
    groupSecret: groupSecret.toString('base64'),
    members: [memberId],
    active: true
  };

  return {
    state,
    commitCiphertext: encodeCommitPayload({
      type: 'init',
      epoch: 0,
      members: [memberId],
      wrappedSecrets
    })
  };
}

/**
 * Applies a relayed MLS commit to local group state when this device should receive a new secret.
 *
 * @param state - Current local MLS group state.
 * @param commitCiphertext - Base64 commit payload from Team Hub.
 * @param memberId - Local member id in `userId#deviceId` form.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for this device.
 */
export function applyMlsCommitToLocalState(
  state: LocalMlsGroupState,
  commitCiphertext: string,
  memberId: string,
  privateKeyMaterial: string
): LocalMlsGroupState {
  const payload = decodeCommitPayload(commitCiphertext);
  const wrappedSecret = payload.wrappedSecrets[memberId];
  const nextState: LocalMlsGroupState = {
    ...state,
    epoch: payload.epoch,
    members: [...payload.members],
    active: payload.members.includes(memberId)
  };

  if (wrappedSecret) {
    nextState.groupSecret = unwrapGroupSecret(
      wrappedSecret,
      privateKeyMaterial,
      state.mlsGroupId,
      memberId
    ).toString('base64');
  } else if (!nextState.active) {
    nextState.active = false;
  }

  return nextState;
}

/**
 * Applies a relayed MLS welcome to local group state for a newly added device.
 *
 * @param mlsGroupId - Canonical MLS group id for the discussion thread.
 * @param welcomeCiphertext - Base64 welcome payload from Team Hub.
 * @param memberId - Local member id in `userId#deviceId` form.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for this device.
 */
export function applyMlsWelcomeToLocalState(
  mlsGroupId: string,
  welcomeCiphertext: string,
  memberId: string,
  privateKeyMaterial: string
): LocalMlsGroupState {
  const payload = decodeWelcomePayload(welcomeCiphertext);
  const groupSecret = unwrapGroupSecret(
    payload.wrappedSecret,
    privateKeyMaterial,
    mlsGroupId,
    memberId
  );

  return {
    mlsGroupId,
    epoch: payload.epoch,
    groupSecret: groupSecret.toString('base64'),
    members: [...payload.members],
    active: true
  };
}

/**
 * Builds an add-member commit and welcome for another enrolled device.
 *
 * @param state - Current local MLS group state.
 * @param addedMemberId - Member id being added in `userId#deviceId` form.
 * @param addedPublicKeyMaterial - Public key material for the device being added.
 * @param memberPublicKeys - Public key material for every member receiving the rotated secret.
 * @param actorPrivateKeyMaterial - Private key material for the device creating the commit.
 */
export function buildMlsAddMemberArtifacts(
  state: LocalMlsGroupState,
  addedMemberId: string,
  addedPublicKeyMaterial: string,
  memberPublicKeys: Record<string, string>,
  actorPrivateKeyMaterial: string
): {
  nextState: LocalMlsGroupState;
  commitCiphertext: string;
  welcomeCiphertext: string;
  ratchetTree: string;
} {
  if (!state.active) {
    throw new Error('Inactive MLS group members cannot add devices');
  }

  const nextEpoch = state.epoch + 1;
  const nextSecret = randomBytes(32);
  const members = [...new Set([...state.members, addedMemberId])];
  const publicKeys = {
    ...memberPublicKeys,
    [addedMemberId]: addedPublicKeyMaterial
  };
  const wrappedSecrets = Object.fromEntries(
    members.map((member) => [
      member,
      wrapGroupSecret(
        nextSecret,
        publicKeys[member] ?? derivePublicKeyMaterial(actorPrivateKeyMaterial),
        state.mlsGroupId,
        member
      )
    ])
  );

  const nextState: LocalMlsGroupState = {
    mlsGroupId: state.mlsGroupId,
    epoch: nextEpoch,
    groupSecret: nextSecret.toString('base64'),
    members,
    active: true
  };

  return {
    nextState,
    commitCiphertext: encodeCommitPayload({
      type: 'add',
      epoch: nextEpoch,
      members,
      addedMember: addedMemberId,
      wrappedSecrets
    }),
    welcomeCiphertext: encodeWelcomePayload({
      epoch: nextEpoch,
      members,
      wrappedSecret: wrappedSecrets[addedMemberId] ?? ''
    }),
    ratchetTree: Buffer.from(JSON.stringify({ members, epoch: nextEpoch }), 'utf8').toString(
      'base64'
    )
  };
}

/**
 * Builds a remove-member commit that rotates the group secret for remaining members only.
 *
 * @param state - Current local MLS group state.
 * @param removedMemberId - Member id being removed in `userId#deviceId` form.
 * @param memberPublicKeys - Public key material for every remaining member.
 * @param actorPrivateKeyMaterial - Private key material for the device creating the commit.
 */
export function buildMlsRemoveMemberCommit(
  state: LocalMlsGroupState,
  removedMemberId: string,
  memberPublicKeys: Record<string, string>,
  actorPrivateKeyMaterial: string
): { nextState: LocalMlsGroupState; commitCiphertext: string } {
  if (!state.active) {
    throw new Error('Inactive MLS group members cannot remove devices');
  }

  const nextEpoch = state.epoch + 1;
  const nextSecret = randomBytes(32);
  const members = state.members.filter((member) => member !== removedMemberId);
  const wrappedSecrets = Object.fromEntries(
    members.map((member) => [
      member,
      wrapGroupSecret(
        nextSecret,
        memberPublicKeys[member] ?? derivePublicKeyMaterial(actorPrivateKeyMaterial),
        state.mlsGroupId,
        member
      )
    ])
  );

  return {
    nextState: {
      mlsGroupId: state.mlsGroupId,
      epoch: nextEpoch,
      groupSecret: nextSecret.toString('base64'),
      members,
      active: true
    },
    commitCiphertext: encodeCommitPayload({
      type: 'remove',
      epoch: nextEpoch,
      members,
      removedMember: removedMemberId,
      wrappedSecrets
    })
  };
}

/**
 * Builds an encrypted discussion payload using the mls-v1 group state.
 *
 * @param plaintext - Comment body text to encrypt.
 * @param state - Active local MLS group state.
 * @param deviceId - Enrolled client device id sending the comment.
 */
export function buildMlsEncryptedDiscussionPayload(
  plaintext: string,
  state: LocalMlsGroupState,
  deviceId: string
): DiscussionEncryptedPayloadInput {
  if (!state.active) {
    throw new Error('Removed MLS group members cannot encrypt new comments');
  }

  const ciphertext = encryptMlsDiscussionBody(
    plaintext,
    Buffer.from(state.groupSecret, 'base64'),
    state.epoch
  );

  return {
    ciphertext,
    mlsGroupId: state.mlsGroupId,
    epoch: state.epoch,
    senderDeviceId: deviceId,
    keyFormat: 'mls-v1'
  };
}

/**
 * Decrypts an mls-v1 encrypted discussion comment when local group state matches the epoch.
 *
 * @param ciphertext - Encrypted comment body from the server.
 * @param epoch - MLS epoch recorded on the comment metadata.
 * @param state - Local MLS group state for the thread.
 */
export function decryptMlsEncryptedDiscussionBody(
  ciphertext: string,
  epoch: number,
  state: LocalMlsGroupState
): string | null {
  if (!state.active || !state.members.length) {
    return null;
  }

  try {
    return decryptMlsDiscussionBody(ciphertext, Buffer.from(state.groupSecret, 'base64'), epoch);
  } catch {
    return null;
  }
}

/**
 * Synchronizes local MLS group state from persisted Team Hub commit and welcome records.
 *
 * @param client - Authenticated Team Hub client.
 * @param state - Existing local MLS group state, if any.
 * @param mlsGroupId - Canonical MLS group id for the discussion thread.
 * @param memberId - Local member id in `userId#deviceId` form.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for this device.
 */
export async function syncLocalMlsGroupState(
  client: TeamHubClient,
  state: LocalMlsGroupState | undefined,
  mlsGroupId: string,
  memberId: string,
  deviceId: string,
  privateKeyMaterial: string
): Promise<LocalMlsGroupState | undefined> {
  let nextState = state;

  const welcomes = await client.listDiscussionMlsWelcomes({
    mlsGroupId,
    recipientDeviceId: deviceId
  });
  for (const welcome of welcomes.welcomes) {
    if (welcome.recipientDeviceId !== deviceId) {
      continue;
    }

    nextState = applyMlsWelcomeToLocalState(
      mlsGroupId,
      welcome.ciphertext,
      memberId,
      privateKeyMaterial
    );
  }

  let cursor: string | undefined;
  do {
    const page = await client.listDiscussionMlsCommits({
      mlsGroupId,
      cursor,
      limit: 100
    });

    for (const commit of page.commits) {
      if (!nextState || commit.epoch > nextState.epoch) {
        nextState = applyMlsCommitToLocalState(
          nextState ?? {
            mlsGroupId,
            epoch: -1,
            groupSecret: '',
            members: [],
            active: false
          },
          commit.ciphertext,
          memberId,
          privateKeyMaterial
        );
      }
    }

    cursor = page.nextCursor;
  } while (cursor);

  return nextState;
}

/**
 * Ensures local MLS group state exists, syncs commits from the server, and encrypts a comment body.
 *
 * @param hubId - Team Hub connection id.
 * @param client - Authenticated Team Hub client.
 * @param userId - Authenticated Team Hub user id.
 * @param deviceId - Enrolled client device id.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for this device.
 * @param mlsGroupId - Canonical MLS group id for the discussion thread.
 * @param plaintext - Comment body text to encrypt.
 */
export async function encryptDiscussionWithMlsGroup(
  hubId: string,
  client: TeamHubClient,
  userId: string,
  deviceId: string,
  privateKeyMaterial: string,
  mlsGroupId: string,
  plaintext: string
): Promise<DiscussionEncryptedPayloadInput> {
  const memberId = buildMlsMemberId(userId, deviceId);
  let state = getStoredMlsGroupState(hubId, mlsGroupId);
  state = await syncLocalMlsGroupState(
    client,
    state,
    mlsGroupId,
    memberId,
    deviceId,
    privateKeyMaterial
  );

  if (!state) {
    const init = initializeLocalMlsGroup(mlsGroupId, memberId, privateKeyMaterial);
    state = init.state;
    await client.createDiscussionMlsCommit({
      mlsGroupId,
      epoch: state.epoch,
      ciphertext: init.commitCiphertext,
      senderDeviceId: deviceId
    });
  }

  if (!state.active) {
    throw new Error('Removed MLS group members cannot encrypt new comments');
  }

  storeMlsGroupState(hubId, state);
  return buildMlsEncryptedDiscussionPayload(plaintext, state, deviceId);
}

/**
 * Decrypts an mls-v1 discussion comment after syncing local MLS group state from the server.
 *
 * @param hubId - Team Hub connection id.
 * @param client - Authenticated Team Hub client.
 * @param comment - Comment returned by Team Hub discussion routes.
 * @param userId - Authenticated Team Hub user id.
 * @param deviceId - Enrolled client device id.
 * @param privateKeyMaterial - Base64 PKCS8 private key bytes for this device.
 */
export async function decryptDiscussionCommentWithMlsGroup(
  hubId: string,
  client: TeamHubClient,
  comment: DiscussionComment,
  userId: string,
  deviceId: string,
  privateKeyMaterial: string
): Promise<DiscussionComment> {
  if (
    comment.tombstoned ||
    comment.bodyFormat !== 'encrypted' ||
    comment.encryptedPayload == null ||
    comment.encryptedPayload.keyFormat !== 'mls-v1'
  ) {
    return comment;
  }

  const memberId = buildMlsMemberId(userId, deviceId);
  let state = getStoredMlsGroupState(hubId, comment.encryptedPayload.mlsGroupId);
  state = await syncLocalMlsGroupState(
    client,
    state,
    comment.encryptedPayload.mlsGroupId,
    memberId,
    deviceId,
    privateKeyMaterial
  );

  if (!state) {
    return { ...comment, body: null };
  }

  storeMlsGroupState(hubId, state);
  const body = decryptMlsEncryptedDiscussionBody(
    comment.encryptedPayload.ciphertext,
    comment.encryptedPayload.epoch,
    state
  );
  return { ...comment, body };
}
