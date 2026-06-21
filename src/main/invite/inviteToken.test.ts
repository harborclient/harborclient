import {
  constants,
  createCipheriv,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  publicEncrypt,
  randomBytes,
  randomUUID,
  sign,
  type BinaryLike,
  type CipherKey
} from 'crypto';
import { describe, expect, it } from 'vitest';
import type { DatabaseConnection } from '#/shared/types';
import {
  createInviteToken,
  INVITE_TTL_MS,
  INVITE_TOKEN_VERSION,
  publicKeyFingerprint,
  verifyInviteToken,
  type InviteCollectionMeta
} from '#/main/invite/inviteToken';
import type { SpentInviteTokenStore } from '#/main/invite/spentInviteTokens';
import type { TrustedInviteKey } from '#/shared/types';

interface TestKeyPair {
  privateKey: string;
  publicKey: string;
  fingerprint: string;
}

/**
 * Builds an in-memory spent-token store for isolated verify tests.
 */
function createMemorySpentStore(): SpentInviteTokenStore {
  const spent = new Set<string>();
  return {
    isSpent(jti: string): boolean {
      return spent.has(jti);
    },
    markSpent(jti: string): void {
      spent.add(jti);
    }
  };
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

/**
 * Encodes binary data as base64url without padding.
 *
 * @param value - Binary data to encode.
 */
function base64UrlEncodeBuffer(value: Buffer): string {
  return value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Adapts Node buffers for strict crypto typings.
 *
 * @param value - Buffer passed to a crypto API.
 */
function asBinaryLike(value: Buffer): BinaryLike {
  return value as unknown as BinaryLike;
}

/**
 * Adapts Node buffers for strict cipher key typings.
 *
 * @param value - Buffer used as a symmetric key or IV.
 */
function asCipherKey(value: Buffer): CipherKey {
  return value as unknown as CipherKey;
}

/**
 * Adapts Node buffers for APIs expecting ArrayBufferView.
 *
 * @param value - Buffer passed to a crypto API.
 */
function asArrayBufferView(value: Buffer): NodeJS.ArrayBufferView {
  return value as unknown as NodeJS.ArrayBufferView;
}

/**
 * Encodes a UTF-8 string as base64url without padding.
 *
 * @param value - UTF-8 string to encode.
 */
function base64UrlEncode(value: string): string {
  return base64UrlEncodeBuffer(Buffer.from(value, 'utf-8'));
}

/**
 * Builds a signed invite token with an arbitrary inner payload for validation tests.
 *
 * @param payload - Plaintext JSON object encrypted into the token.
 * @param senderPrivateKey - Sender RSA private key PEM.
 * @param senderPublicKey - Sender RSA public key PEM.
 * @param recipientPublicKey - Intended recipient RSA public key PEM.
 */
function createInviteTokenWithPayload(
  payload: unknown,
  senderPrivateKey: string,
  senderPublicKey: string,
  recipientPublicKey: string
): string {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', asCipherKey(aesKey), asBinaryLike(iv));
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf-8');
  const ciphertext = Buffer.concat([
    cipher.update(asBinaryLike(plaintext)) as Buffer,
    cipher.final()
  ] as unknown as readonly Uint8Array[]);
  const tag = cipher.getAuthTag();

  const wrappedKey = publicEncrypt(
    {
      key: createPublicKey(recipientPublicKey),
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    asArrayBufferView(aesKey)
  );

  const now = Date.now();
  const header = base64UrlEncode(
    JSON.stringify({
      v: INVITE_TOKEN_VERSION,
      alg: 'RSA-OAEP-256+A256GCM',
      sigAlg: 'RS256',
      senderKid: publicKeyFingerprint(senderPublicKey),
      recipientKid: publicKeyFingerprint(recipientPublicKey)
    })
  );
  const envelope = base64UrlEncode(
    JSON.stringify({
      jti: randomUUID(),
      iat: now,
      exp: now + INVITE_TTL_MS,
      encKey: base64UrlEncodeBuffer(wrappedKey),
      iv: base64UrlEncodeBuffer(iv),
      ct: base64UrlEncodeBuffer(ciphertext),
      tag: base64UrlEncodeBuffer(tag)
    })
  );

  const signingInput = `${header}.${envelope}`;
  const signature = base64UrlEncodeBuffer(
    sign('RSA-SHA256', new TextEncoder().encode(signingInput), {
      key: createPrivateKey(senderPrivateKey)
    })
  );

  return `${signingInput}.${signature}`;
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
  it('publicKeyFingerprint rejects invalid PEM', () => {
    expect(() => publicKeyFingerprint('not-a-valid-pem')).toThrow(/Invalid public key PEM/i);
  });

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

    const spentStore = createMemorySpentStore();
    const decoded = verifyInviteToken(
      token,
      recipient.privateKey,
      recipient.publicKey,
      [toTrustedKey(sender, 'Sender')],
      { spentStore }
    );

    expect(decoded.connection).toEqual(sampleConnection);
    expect(decoded.collection).toEqual(sampleCollection);
  });

  it('rejects decrypted payloads with invalid connection settings', () => {
    const sender = generateTestKeyPair();
    const recipient = generateTestKeyPair();

    const token = createInviteTokenWithPayload(
      {
        conn: {
          id: 'conn-1',
          name: 'Shared Postgres',
          type: 'postgres',
          settings: {
            user: 'harbor',
            password: 'secret',
            database: 'collections'
          }
        },
        collection: sampleCollection
      },
      sender.privateKey,
      sender.publicKey,
      recipient.publicKey
    );

    expect(() =>
      verifyInviteToken(
        token,
        recipient.privateKey,
        recipient.publicKey,
        [toTrustedKey(sender, 'Sender')],
        { spentStore: createMemorySpentStore() }
      )
    ).toThrow(/invalid connection/i);
  });

  it('rejects decrypted payloads with non-integer providerCollectionId', () => {
    const sender = generateTestKeyPair();
    const recipient = generateTestKeyPair();

    const floatToken = createInviteTokenWithPayload(
      {
        conn: sampleConnection,
        collection: { name: 'Team API', providerCollectionId: 42.5 }
      },
      sender.privateKey,
      sender.publicKey,
      recipient.publicKey
    );

    expect(() =>
      verifyInviteToken(
        floatToken,
        recipient.privateKey,
        recipient.publicKey,
        [toTrustedKey(sender, 'Sender')],
        { spentStore: createMemorySpentStore() }
      )
    ).toThrow(/invalid collection metadata/i);

    const nanToken = createInviteTokenWithPayload(
      {
        conn: sampleConnection,
        collection: { name: 'Team API', providerCollectionId: NaN }
      },
      sender.privateKey,
      sender.publicKey,
      recipient.publicKey
    );

    expect(() =>
      verifyInviteToken(
        nanToken,
        recipient.privateKey,
        recipient.publicKey,
        [toTrustedKey(sender, 'Sender')],
        { spentStore: createMemorySpentStore() }
      )
    ).toThrow(/invalid collection metadata/i);
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
      verifyInviteToken(
        tampered,
        recipient.privateKey,
        recipient.publicKey,
        [toTrustedKey(sender, 'Sender')],
        { spentStore: createMemorySpentStore() }
      )
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
      verifyInviteToken(
        token,
        recipient.privateKey,
        recipient.publicKey,
        [toTrustedKey(otherSender, 'Wrong sender')],
        { spentStore: createMemorySpentStore() }
      )
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
      verifyInviteToken(
        token,
        otherRecipient.privateKey,
        otherRecipient.publicKey,
        [toTrustedKey(sender, 'Sender')],
        { spentStore: createMemorySpentStore() }
      )
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

  it('rejects invites whose signed validity window exceeds the maximum TTL', () => {
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
    envelope.iat = Date.now();
    envelope.exp = Date.now() + INVITE_TTL_MS * 2;
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

    const extended = parts.join('.');

    expect(() =>
      verifyInviteToken(
        extended,
        recipient.privateKey,
        recipient.publicKey,
        [toTrustedKey(sender, 'Sender')],
        { spentStore: createMemorySpentStore() }
      )
    ).toThrow(/validity exceeds maximum allowed lifetime/i);
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
      verifyInviteToken(
        expired,
        recipient.privateKey,
        recipient.publicKey,
        [toTrustedKey(sender, 'Sender')],
        { spentStore: createMemorySpentStore() }
      )
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
      verifyInviteToken(legacyToken, recipient.privateKey, recipient.publicKey, [], {
        spentStore: createMemorySpentStore()
      })
    ).toThrow(/old, insecure format/i);
  });

  it('rejects replay of an already accepted invite', () => {
    const sender = generateTestKeyPair();
    const recipient = generateTestKeyPair();
    const spentStore = createMemorySpentStore();

    const token = createInviteToken(
      sampleConnection,
      sampleCollection,
      sender.privateKey,
      sender.publicKey,
      recipient.publicKey
    );

    verifyInviteToken(
      token,
      recipient.privateKey,
      recipient.publicKey,
      [toTrustedKey(sender, 'Sender')],
      { spentStore }
    );

    expect(() =>
      verifyInviteToken(
        token,
        recipient.privateKey,
        recipient.publicKey,
        [toTrustedKey(sender, 'Sender')],
        { spentStore }
      )
    ).toThrow(/already been used/i);
  });

  it('rejects envelopes missing jti', () => {
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
    const envelope = JSON.parse(payloadJson) as { jti?: string };
    delete envelope.jti;
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

    const missingJti = parts.join('.');

    expect(() =>
      verifyInviteToken(
        missingJti,
        recipient.privateKey,
        recipient.publicKey,
        [toTrustedKey(sender, 'Sender')],
        { spentStore: createMemorySpentStore() }
      )
    ).toThrow(/malformed payload/i);
  });
});
