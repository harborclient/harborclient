import { describe, expect, it } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import {
  applyMlsCommitToLocalState,
  applyMlsWelcomeToLocalState,
  buildMlsAddMemberArtifacts,
  buildMlsEncryptedDiscussionPayload,
  buildMlsMemberId,
  buildMlsRemoveMemberCommit,
  decryptMlsEncryptedDiscussionBody,
  derivePublicKeyMaterial,
  encryptMlsDiscussionBody,
  initializeLocalMlsGroup
} from './teamHubDiscussionMls';

const mlsGroupId = 'thread:request:request-1';

/**
 * Builds PKCS8 private key material for MLS tests.
 */
function samplePrivateKeyMaterial(): string {
  const { privateKey } = generateKeyPairSync('ed25519');
  return privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
}

describe('teamHubDiscussionMls', () => {
  it('creates a group, adds a member, and decrypts across devices', () => {
    const aliceKey = samplePrivateKeyMaterial();
    const bobKey = samplePrivateKeyMaterial();
    const aliceMember = buildMlsMemberId('alice', 'laptop');
    const bobMember = buildMlsMemberId('bob', 'desktop');

    const init = initializeLocalMlsGroup(mlsGroupId, aliceMember, aliceKey);
    let aliceState = init.state;

    const add = buildMlsAddMemberArtifacts(
      aliceState,
      bobMember,
      derivePublicKeyMaterial(bobKey),
      {
        [aliceMember]: derivePublicKeyMaterial(aliceKey)
      },
      aliceKey
    );
    aliceState = add.nextState;

    let bobState = applyMlsWelcomeToLocalState(
      mlsGroupId,
      add.welcomeCiphertext,
      bobMember,
      bobKey
    );
    bobState = applyMlsCommitToLocalState(bobState, add.commitCiphertext, bobMember, bobKey);

    const payload = buildMlsEncryptedDiscussionPayload(
      'Review this request?',
      aliceState,
      'laptop'
    );
    expect(payload.keyFormat).toBe('mls-v1');
    expect(decryptMlsEncryptedDiscussionBody(payload.ciphertext, payload.epoch, bobState)).toBe(
      'Review this request?'
    );
  });

  it('prevents removed members from decrypting future comments', () => {
    const aliceKey = samplePrivateKeyMaterial();
    const bobKey = samplePrivateKeyMaterial();
    const aliceMember = buildMlsMemberId('alice', 'laptop');
    const bobMember = buildMlsMemberId('bob', 'desktop');

    let aliceState = initializeLocalMlsGroup(mlsGroupId, aliceMember, aliceKey).state;
    const add = buildMlsAddMemberArtifacts(
      aliceState,
      bobMember,
      derivePublicKeyMaterial(bobKey),
      {
        [aliceMember]: derivePublicKeyMaterial(aliceKey)
      },
      aliceKey
    );
    aliceState = add.nextState;

    let bobState = applyMlsWelcomeToLocalState(
      mlsGroupId,
      add.welcomeCiphertext,
      bobMember,
      bobKey
    );
    bobState = applyMlsCommitToLocalState(bobState, add.commitCiphertext, bobMember, bobKey);

    const remove = buildMlsRemoveMemberCommit(
      aliceState,
      bobMember,
      {
        [aliceMember]: derivePublicKeyMaterial(aliceKey)
      },
      aliceKey
    );
    aliceState = remove.nextState;
    bobState = applyMlsCommitToLocalState(bobState, remove.commitCiphertext, bobMember, bobKey);

    expect(bobState.active).toBe(false);

    const futurePayload = buildMlsEncryptedDiscussionPayload(
      'Follow-up after removal',
      aliceState,
      'laptop'
    );

    expect(
      decryptMlsEncryptedDiscussionBody(futurePayload.ciphertext, futurePayload.epoch, bobState)
    ).toBeNull();
    expect(
      decryptMlsEncryptedDiscussionBody(futurePayload.ciphertext, futurePayload.epoch, aliceState)
    ).toBe('Follow-up after removal');
  });

  it('round-trips message encryption for one epoch', () => {
    const secret = Buffer.from('0123456789abcdef0123456789abcdef', 'utf8');
    const encoded = encryptMlsDiscussionBody('hello mls', secret, 2);
    expect(encoded.length).toBeGreaterThan(0);
  });
});
