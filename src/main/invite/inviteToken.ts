import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  sign,
  verify,
  type BinaryLike,
  type CipherKey
} from 'crypto';
import type { DatabaseConnection, DatabaseProvider, TrustedInviteKey } from '#/shared/types';

export const INVITE_TOKEN_VERSION = 2;

/** Default invite lifetime (7 days). */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Allowed clock skew when validating `iat`. */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Collection metadata embedded in an invite so the recipient can register it
 * in their local collection registry (the authoritative collection list).
 */
export interface InviteCollectionMeta {
  /**
   * Display name for the shared collection.
   */
  name: string;

  /**
   * Id of the collection within the provider's own store.
   */
  providerCollectionId: number;
}

/**
 * A trusted sender public key used to verify invite signatures.
 */
export type { TrustedInviteKey };

interface InviteTokenHeader {
  v: number;
  alg: string;
  sigAlg: string;
  senderKid: string;
  recipientKid: string;
}

interface InviteTokenEnvelope {
  iat: number;
  exp: number;
  encKey: string;
  iv: string;
  ct: string;
  tag: string;
}

interface DecryptedInvitePayload {
  conn: DatabaseConnection;
  collection: InviteCollectionMeta;
}

/**
 * Decoded invite contents: the shared connection plus the collection mapping.
 */
export interface DecodedInvite {
  connection: DatabaseConnection;
  collection: InviteCollectionMeta;
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
 * Decodes a base64url string to UTF-8.
 *
 * @param value - Base64url-encoded string.
 */
function base64UrlDecode(value: string): string {
  return base64UrlDecodeBuffer(value).toString('utf-8');
}

/**
 * Decodes a base64url string to a buffer.
 *
 * @param value - Base64url-encoded string.
 */
function base64UrlDecodeBuffer(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = padded + '='.repeat(padLength);
  return Buffer.from(normalized, 'base64');
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
 * Returns the SHA-256 fingerprint of an RSA public key PEM.
 *
 * @param publicKeyPem - PEM-encoded RSA public key.
 */
export function publicKeyFingerprint(publicKeyPem: string): string {
  const der = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' }) as Buffer;
  return createHash('sha256').update(asBinaryLike(der)).digest('hex');
}

/**
 * Returns true when value is a supported database provider.
 *
 * @param value - Raw provider from decoded payload.
 */
function isDatabaseProvider(value: unknown): value is DatabaseProvider {
  return value === 'sqlite' || value === 'firestore' || value === 'mysql' || value === 'postgres';
}

/**
 * Validates and normalizes decrypted invite payload contents.
 *
 * @param raw - Parsed JSON payload.
 */
function parseDecryptedPayload(raw: unknown): DecryptedInvitePayload {
  if (typeof raw !== 'object' || raw == null) {
    throw new Error('Invalid invite token: malformed payload.');
  }

  const payload = raw as Partial<DecryptedInvitePayload>;
  const conn = payload.conn;
  if (typeof conn !== 'object' || conn == null) {
    throw new Error('Invalid invite token: missing connection.');
  }

  const connection = conn as Partial<DatabaseConnection>;
  if (typeof connection.name !== 'string' || !isDatabaseProvider(connection.type)) {
    throw new Error('Invalid invite token: invalid connection.');
  }

  if (typeof connection.settings !== 'object' || connection.settings == null) {
    throw new Error('Invalid invite token: invalid connection settings.');
  }

  const collection = payload.collection;
  if (typeof collection !== 'object' || collection == null) {
    throw new Error('Invalid invite token: missing collection.');
  }

  const collectionMeta = collection as Partial<InviteCollectionMeta>;
  if (
    typeof collectionMeta.name !== 'string' ||
    typeof collectionMeta.providerCollectionId !== 'number'
  ) {
    throw new Error('Invalid invite token: invalid collection metadata.');
  }

  return {
    conn: {
      id: typeof connection.id === 'string' ? connection.id : '',
      name: connection.name,
      type: connection.type,
      settings: connection.settings
    } as DatabaseConnection,
    collection: {
      name: collectionMeta.name,
      providerCollectionId: collectionMeta.providerCollectionId
    }
  };
}

/**
 * Parses and validates the invite JWT header segment.
 *
 * @param encodedHeader - Base64url-encoded header JSON.
 */
function parseInviteHeader(encodedHeader: string): InviteTokenHeader {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(encodedHeader)) as unknown;
  } catch {
    throw new Error('Invalid invite token: malformed header.');
  }

  if (typeof parsed !== 'object' || parsed == null) {
    throw new Error('Invalid invite token: malformed header.');
  }

  const header = parsed as Partial<InviteTokenHeader>;
  if (!header.v || header.v < INVITE_TOKEN_VERSION) {
    throw new Error(
      'This invite uses an old, insecure format. Ask the sender to re-share the collection.'
    );
  }

  if (header.v !== INVITE_TOKEN_VERSION) {
    throw new Error('Invalid invite token: unsupported version.');
  }

  if (
    header.alg !== 'RSA-OAEP-256+A256GCM' ||
    header.sigAlg !== 'RS256' ||
    typeof header.senderKid !== 'string' ||
    typeof header.recipientKid !== 'string'
  ) {
    throw new Error('Invalid invite token: malformed header.');
  }

  return {
    v: INVITE_TOKEN_VERSION,
    alg: header.alg,
    sigAlg: header.sigAlg,
    senderKid: header.senderKid,
    recipientKid: header.recipientKid
  };
}

/**
 * Parses and validates the encrypted invite envelope segment.
 *
 * @param encodedPayload - Base64url-encoded envelope JSON.
 */
function parseInviteEnvelope(encodedPayload: string): InviteTokenEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(encodedPayload)) as unknown;
  } catch {
    throw new Error('Invalid invite token: malformed payload.');
  }

  if (typeof parsed !== 'object' || parsed == null) {
    throw new Error('Invalid invite token: malformed payload.');
  }

  const envelope = parsed as Partial<InviteTokenEnvelope>;
  if (
    typeof envelope.iat !== 'number' ||
    typeof envelope.exp !== 'number' ||
    typeof envelope.encKey !== 'string' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ct !== 'string' ||
    typeof envelope.tag !== 'string'
  ) {
    throw new Error('Invalid invite token: malformed payload.');
  }

  return {
    iat: envelope.iat,
    exp: envelope.exp,
    encKey: envelope.encKey,
    iv: envelope.iv,
    ct: envelope.ct,
    tag: envelope.tag
  };
}

/**
 * Validates invite freshness (`iat` / `exp`).
 *
 * @param envelope - Parsed invite envelope.
 * @param now - Current timestamp in milliseconds.
 */
function assertInviteFreshness(envelope: InviteTokenEnvelope, now: number): void {
  if (envelope.exp <= now) {
    throw new Error('Invalid invite token: invite has expired.');
  }

  if (envelope.iat > now + CLOCK_SKEW_MS) {
    throw new Error('Invalid invite token: invite is not yet valid.');
  }
}

/**
 * Creates a signed, recipient-encrypted invite token.
 *
 * @param connection - Connection to embed in the token.
 * @param collection - Collection metadata (name and provider id) to embed.
 * @param senderPrivateKeyPem - PEM-encoded RSA private key of the inviter.
 * @param senderPublicKeyPem - PEM-encoded RSA public key of the inviter.
 * @param recipientPublicKeyPem - PEM-encoded RSA public key of the intended recipient.
 */
export function createInviteToken(
  connection: DatabaseConnection,
  collection: InviteCollectionMeta,
  senderPrivateKeyPem: string,
  senderPublicKeyPem: string,
  recipientPublicKeyPem: string
): string {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', asCipherKey(aesKey), asBinaryLike(iv));
  const plaintext = Buffer.from(JSON.stringify({ conn: connection, collection }), 'utf-8');
  const ciphertext = Buffer.concat([
    cipher.update(asBinaryLike(plaintext)) as Buffer,
    cipher.final()
  ] as unknown as readonly Uint8Array[]);
  const tag = cipher.getAuthTag();

  const wrappedKey = publicEncrypt(
    {
      key: createPublicKey(recipientPublicKeyPem),
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
      senderKid: publicKeyFingerprint(senderPublicKeyPem),
      recipientKid: publicKeyFingerprint(recipientPublicKeyPem)
    } satisfies InviteTokenHeader)
  );
  const payload = base64UrlEncode(
    JSON.stringify({
      iat: now,
      exp: now + INVITE_TTL_MS,
      encKey: base64UrlEncodeBuffer(wrappedKey),
      iv: base64UrlEncodeBuffer(iv),
      ct: base64UrlEncodeBuffer(ciphertext),
      tag: base64UrlEncodeBuffer(tag)
    } satisfies InviteTokenEnvelope)
  );

  const signingInput = `${header}.${payload}`;
  const signature = base64UrlEncodeBuffer(
    sign('RSA-SHA256', new TextEncoder().encode(signingInput), {
      key: createPrivateKey(senderPrivateKeyPem)
    })
  );

  return `${signingInput}.${signature}`;
}

/**
 * Verifies and decrypts an invite token addressed to the local identity.
 *
 * @param token - JWT string from an invite.
 * @param recipientPrivateKeyPem - PEM-encoded RSA private key of the recipient.
 * @param recipientPublicKeyPem - PEM-encoded RSA public key of the recipient.
 * @param trustedKeys - Public keys of senders the recipient trusts.
 */
export function verifyInviteToken(
  token: string,
  recipientPrivateKeyPem: string,
  recipientPublicKeyPem: string,
  trustedKeys: TrustedInviteKey[]
): DecodedInvite {
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid invite token: expected three JWT segments.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseInviteHeader(encodedHeader);
  const envelope = parseInviteEnvelope(encodedPayload);
  const now = Date.now();
  assertInviteFreshness(envelope, now);

  const recipientKid = publicKeyFingerprint(recipientPublicKeyPem);
  if (header.recipientKid !== recipientKid) {
    throw new Error('Invalid invite token: this invite was not issued to you.');
  }

  const sender = trustedKeys.find((key) => key.id === header.senderKid);
  if (!sender) {
    throw new Error('Invalid invite token: invite is from an untrusted sender.');
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signatureValid = verify(
    'RSA-SHA256',
    new TextEncoder().encode(signingInput),
    createPublicKey(sender.publicKeyPem),
    asArrayBufferView(base64UrlDecodeBuffer(encodedSignature))
  );
  if (!signatureValid) {
    throw new Error('Invalid invite token: signature verification failed.');
  }

  let aesKey: Buffer;
  try {
    aesKey = privateDecrypt(
      {
        key: createPrivateKey(recipientPrivateKeyPem),
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      asArrayBufferView(base64UrlDecodeBuffer(envelope.encKey))
    );
  } catch {
    throw new Error('Invalid invite token: unable to decrypt invite.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    asCipherKey(aesKey),
    asBinaryLike(base64UrlDecodeBuffer(envelope.iv))
  );
  decipher.setAuthTag(asArrayBufferView(base64UrlDecodeBuffer(envelope.tag)));

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([
      decipher.update(asArrayBufferView(base64UrlDecodeBuffer(envelope.ct))) as Buffer,
      decipher.final()
    ] as unknown as readonly Uint8Array[]);
  } catch {
    throw new Error('Invalid invite token: payload tampering detected.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decrypted.toString('utf-8')) as unknown;
  } catch {
    throw new Error('Invalid invite token: malformed payload.');
  }

  const payload = parseDecryptedPayload(parsed);
  return { connection: payload.conn, collection: payload.collection };
}
