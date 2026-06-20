import { generateKeyPairSync, sign, createPrivateKey } from 'crypto';
import { describe, expect, it } from 'vitest';
import type { DatabaseConnection } from '#/shared/types';
import {
  createInviteToken,
  INVITE_TTL_MS,
  publicKeyFingerprint,
  verifyInviteToken,
  type InviteCollectionMeta
} from '#/main/invite/inviteToken';
import type { TrustedInviteKey } from '#/shared/types';

interface TestKeyPair {
  privateKey: string;
  publicKey: string;
  fingerprint: string;
}

/**
 * Generates an RSA key pair for invite token tests.
 */
function generateTestKeyPair(): TestKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  return {
    privateKey,
    publicKey,
    fingerprint: publicKeyFingerprint(publicKey)
  };
}

/**
 * Builds a trusted-key entry for tests.
 *
 * @param keyPair - Generated key pair.
 * @param label - Display label for the key owner.
 */
function toTrustedKey(keyPair: TestKeyPair, label: string): TrustedInviteKey {
  return {
    id: keyPair.fingerprint,
    label,
    publicKeyPem: keyPair.publicKey,
    addedAt: Date.now()
  };
}

const sampleConnection: DatabaseConnection = {
  id: 'conn-1',
  name: 'Shared Postgres',
  type: 'postgres',
  settings: {
    host: 'db.example.com',
    port: 5432,
    user: 'harbor',
    password: 'super-secret-db-password',
    database: 'collections'
  }
};

const sampleCollection: InviteCollectionMeta = {
  name: 'Team API',
  providerCollectionId: 42
};

describe('inviteToken', () => {
  it('verifyInvite decrypts and validates token from createInviteToken', () => {
    const sender = generateTestKeyPair();
    const recipient = generateTestKeyPair();

    const token = createInviteToken(
      sampleConnection,
      sampleCollection,
      sender.privateKey,
      sender.publicKey,
      recipient.publicKey
    );

    const decoded = verifyInviteToken(token, recipient.privateKey, recipient.publicKey, [
      toTrustedKey(sender, 'Sender')
    ]);

    expect(decoded.connection).toEqual(sampleConnection);
    expect(decoded.collection).toEqual(sampleCollection);
  });

  it('rejects tampered ciphertext', () => {
    const sender = generateTestKeyPair();
    const recipient = generateTestKeyPair();

    const token = createInviteToken(
      sampleConnection,
      sampleCollection,
      sender.privateKey,
      sender.publicKey,
      recipient.publicKey
    );

    const parts = token.split('.');
    const payloadJson = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf-8');
    const envelope = JSON.parse(payloadJson) as { ct: string };
    const ctBytes = Buffer.from(envelope.ct.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    ctBytes[0] ^= 0xff;
    envelope.ct = ctBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    parts[1] = Buffer.from(JSON.stringify(envelope), 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const signingInput = `${parts[0]}.${parts[1]}`;
    parts[2] = sign('RSA-SHA256', new TextEncoder().encode(signingInput), {
      key: createPrivateKey(sender.privateKey)
    })
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const tampered = parts.join('.');

    expect(() =>
      verifyInviteToken(tampered, recipient.privateKey, recipient.publicKey, [
        toTrustedKey(sender, 'Sender')
      ])
    ).toThrow(/tampering detected/i);
  });

  it('rejects invites from untrusted senders', () => {
    const sender = generateTestKeyPair();
    const otherSender = generateTestKeyPair();
    const recipient = generateTestKeyPair();

    const token = createInviteToken(
      sampleConnection,
      sampleCollection,
      sender.privateKey,
      sender.publicKey,
      recipient.publicKey
    );

    expect(() =>
      verifyInviteToken(token, recipient.privateKey, recipient.publicKey, [
        toTrustedKey(otherSender, 'Wrong sender')
      ])
    ).toThrow(/untrusted sender/i);
  });

  it('rejects invites encrypted for a different recipient', () => {
    const sender = generateTestKeyPair();
    const intendedRecipient = generateTestKeyPair();
    const otherRecipient = generateTestKeyPair();

    const token = createInviteToken(
      sampleConnection,
      sampleCollection,
      sender.privateKey,
      sender.publicKey,
      intendedRecipient.publicKey
    );

    expect(() =>
      verifyInviteToken(token, otherRecipient.privateKey, otherRecipient.publicKey, [
        toTrustedKey(sender, 'Sender')
      ])
    ).toThrow(/not issued to you/i);
  });

  it('does not embed plaintext database credentials in the token', () => {
    const sender = generateTestKeyPair();
    const recipient = generateTestKeyPair();

    const token = createInviteToken(
      sampleConnection,
      sampleCollection,
      sender.privateKey,
      sender.publicKey,
      recipient.publicKey
    );

    expect(token).not.toContain('super-secret-db-password');
    expect(token).not.toContain('db.example.com');
  });

  it('rejects expired invites', () => {
    const sender = generateTestKeyPair();
    const recipient = generateTestKeyPair();

    const token = createInviteToken(
      sampleConnection,
      sampleCollection,
      sender.privateKey,
      sender.publicKey,
      recipient.publicKey
    );

    const parts = token.split('.');
    const payloadJson = Buffer.from(
      parts[1].replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf-8');
    const envelope = JSON.parse(payloadJson) as { iat: number; exp: number };
    envelope.iat = Date.now() - INVITE_TTL_MS - 60_000;
    envelope.exp = Date.now() - 60_000;
    parts[1] = Buffer.from(JSON.stringify(envelope), 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const signingInput = `${parts[0]}.${parts[1]}`;
    parts[2] = sign('RSA-SHA256', new TextEncoder().encode(signingInput), {
      key: createPrivateKey(sender.privateKey)
    })
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const expired = parts.join('.');

    expect(() =>
      verifyInviteToken(expired, recipient.privateKey, recipient.publicKey, [
        toTrustedKey(sender, 'Sender')
      ])
    ).toThrow(/expired/i);
  });

  it('rejects legacy v1 invite tokens', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' }), 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const payload = Buffer.from(
      JSON.stringify({
        v: 1,
        iat: Date.now(),
        conn: sampleConnection,
        collection: sampleCollection
      }),
      'utf-8'
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const legacyToken = `${header}.${payload}.signature`;

    const recipient = generateTestKeyPair();

    expect(() =>
      verifyInviteToken(legacyToken, recipient.privateKey, recipient.publicKey, [])
    ).toThrow(/old, insecure format/i);
  });
});
