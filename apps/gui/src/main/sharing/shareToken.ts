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
  randomUUID,
  sign,
  verify
} from 'crypto';
import { z } from 'zod';
import {
  asArrayBufferView,
  asBinaryLike,
  asCipherKey,
  concatBuffers
} from '#/main/crypto/bufferAdapters';
import { storageConnection, dbId } from '#/main/ipc/ipcSchemas';
import { getDefaultSpentShareTokenStore, type SpentShareTokenStore } from './spentShareTokens';
import type { StorageConnection, TrustedSharingKey } from '#/shared/types';

export const SHARE_TOKEN_VERSION = 2;

/**
 * Default share token lifetime (7 days).
 */
export const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Allowed clock skew when validating `iat`.
 */
const CLOCK_SKEW_MS = 5 * 60 * 1000;

/**
 * Collection metadata embedded in a share token so the recipient can register it
 * in their local collection registry (the authoritative collection list).
 */
export interface ShareCollectionMeta {
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
 * A trusted sender public key used to verify share token signatures.
 */
export type { TrustedSharingKey };

interface ShareTokenHeader {
  v: number;
  alg: string;
  sigAlg: string;
  senderKid: string;
  recipientKid: string;
}

interface ShareTokenEnvelope {
  jti: string;
  iat: number;
  exp: number;
  encKey: string;
  iv: string;
  ct: string;
  tag: string;
}

interface DecryptedSharePayload {
  conn: StorageConnection;
  collection: ShareCollectionMeta;
}

/**
 * Decoded share contents: the shared connection plus the collection mapping.
 */
export interface DecodedShare {
  connection: StorageConnection;
  collection: ShareCollectionMeta;
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
 * Returns the SHA-256 fingerprint of an RSA public key PEM.
 *
 * @param publicKeyPem - PEM-encoded RSA public key.
 * @throws When the PEM cannot be parsed as a public key.
 */
export function publicKeyFingerprint(publicKeyPem: string): string {
  let der: Buffer;
  try {
    der = createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' }) as Buffer;
  } catch {
    throw new Error('Invalid public key PEM.');
  }
  return createHash('sha256').update(asBinaryLike(der)).digest('hex');
}

/**
 * Zod schema for decrypted share payload contents after AES-GCM decryption.
 */
const decryptedSharePayloadSchema = z.object({
  conn: storageConnection,
  collection: z.object({
    name: z.string(),
    providerCollectionId: dbId
  })
}) satisfies z.ZodType<DecryptedSharePayload>;

/**
 * Maps a Zod validation failure to a user-facing share token error.
 *
 * @param error - Zod safeParse error from payload validation.
 */
function sharePayloadValidationError(error: z.ZodError): Error {
  const firstPath = error.issues[0]?.path[0];
  if (firstPath === 'conn') {
    return new Error('Invalid share token: invalid connection.');
  }
  if (firstPath === 'collection') {
    return new Error('Invalid share token: invalid collection metadata.');
  }
  return new Error('Invalid share token: malformed payload.');
}

/**
 * Validates and normalizes decrypted share payload contents.
 *
 * @param raw - Parsed JSON payload.
 */
function parseDecryptedPayload(raw: unknown): DecryptedSharePayload {
  const result = decryptedSharePayloadSchema.safeParse(raw);
  if (!result.success) {
    throw sharePayloadValidationError(result.error);
  }
  return result.data;
}

/**
 * Parses and validates the share JWT header segment.
 *
 * @param encodedHeader - Base64url-encoded header JSON.
 */
function parseShareHeader(encodedHeader: string): ShareTokenHeader {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(encodedHeader)) as unknown;
  } catch {
    throw new Error('Invalid share token: malformed header.');
  }

  if (typeof parsed !== 'object' || parsed == null) {
    throw new Error('Invalid share token: malformed header.');
  }

  const header = parsed as Partial<ShareTokenHeader>;
  if (!header.v || header.v < SHARE_TOKEN_VERSION) {
    throw new Error(
      'This share token uses an old, insecure format. Ask the sender to re-share the collection.'
    );
  }

  if (header.v !== SHARE_TOKEN_VERSION) {
    throw new Error('Invalid share token: unsupported version.');
  }

  if (
    header.alg !== 'RSA-OAEP-256+A256GCM' ||
    header.sigAlg !== 'RS256' ||
    typeof header.senderKid !== 'string' ||
    typeof header.recipientKid !== 'string'
  ) {
    throw new Error('Invalid share token: malformed header.');
  }

  return {
    v: SHARE_TOKEN_VERSION,
    alg: header.alg,
    sigAlg: header.sigAlg,
    senderKid: header.senderKid,
    recipientKid: header.recipientKid
  };
}

/**
 * Parses and validates the encrypted share envelope segment.
 *
 * @param encodedPayload - Base64url-encoded envelope JSON.
 */
function parseShareEnvelope(encodedPayload: string): ShareTokenEnvelope {
  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecode(encodedPayload)) as unknown;
  } catch {
    throw new Error('Invalid share token: malformed payload.');
  }

  if (typeof parsed !== 'object' || parsed == null) {
    throw new Error('Invalid share token: malformed payload.');
  }

  const envelope = parsed as Partial<ShareTokenEnvelope>;
  if (
    typeof envelope.jti !== 'string' ||
    envelope.jti.trim().length === 0 ||
    typeof envelope.iat !== 'number' ||
    typeof envelope.exp !== 'number' ||
    typeof envelope.encKey !== 'string' ||
    typeof envelope.iv !== 'string' ||
    typeof envelope.ct !== 'string' ||
    typeof envelope.tag !== 'string'
  ) {
    throw new Error('Invalid share token: malformed payload.');
  }

  return {
    jti: envelope.jti,
    iat: envelope.iat,
    exp: envelope.exp,
    encKey: envelope.encKey,
    iv: envelope.iv,
    ct: envelope.ct,
    tag: envelope.tag
  };
}

/**
 * Validates share token freshness (`iat` / `exp`) and caps the signed validity window
 * so trusted senders cannot issue arbitrarily long-lived share tokens.
 *
 * @param envelope - Parsed share envelope.
 * @param now - Current timestamp in milliseconds.
 */
function assertShareFreshness(envelope: ShareTokenEnvelope, now: number): void {
  if (envelope.exp <= now) {
    throw new Error('Invalid share token: share token has expired.');
  }

  if (envelope.iat > now + CLOCK_SKEW_MS) {
    throw new Error('Invalid share token: share token is not yet valid.');
  }

  if (envelope.exp - envelope.iat > SHARE_TTL_MS) {
    throw new Error('Invalid share token: share token validity exceeds maximum allowed lifetime.');
  }
}

/**
 * Creates a signed, recipient-encrypted share token.
 *
 * @param connection - Connection to embed in the token.
 * @param collection - Collection metadata (name and provider id) to embed.
 * @param senderPrivateKeyPem - PEM-encoded RSA private key of the sender.
 * @param senderPublicKeyPem - PEM-encoded RSA public key of the sender.
 * @param recipientPublicKeyPem - PEM-encoded RSA public key of the intended recipient.
 */
export function createShareToken(
  connection: StorageConnection,
  collection: ShareCollectionMeta,
  senderPrivateKeyPem: string,
  senderPublicKeyPem: string,
  recipientPublicKeyPem: string
): string {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', asCipherKey(aesKey), asBinaryLike(iv));
  const plaintext = Buffer.from(JSON.stringify({ conn: connection, collection }), 'utf-8');
  const ciphertext = concatBuffers(
    cipher.update(asBinaryLike(plaintext)) as Buffer,
    cipher.final()
  );
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
      v: SHARE_TOKEN_VERSION,
      alg: 'RSA-OAEP-256+A256GCM',
      sigAlg: 'RS256',
      senderKid: publicKeyFingerprint(senderPublicKeyPem),
      recipientKid: publicKeyFingerprint(recipientPublicKeyPem)
    } satisfies ShareTokenHeader)
  );
  const payload = base64UrlEncode(
    JSON.stringify({
      jti: randomUUID(),
      iat: now,
      exp: now + SHARE_TTL_MS,
      encKey: base64UrlEncodeBuffer(wrappedKey),
      iv: base64UrlEncodeBuffer(iv),
      ct: base64UrlEncodeBuffer(ciphertext),
      tag: base64UrlEncodeBuffer(tag)
    } satisfies ShareTokenEnvelope)
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
 * Verifies and decrypts an share token addressed to the local identity.
 *
 * @param token - JWT string from a share token.
 * @param recipientPrivateKeyPem - PEM-encoded RSA private key of the recipient.
 * @param recipientPublicKeyPem - PEM-encoded RSA public key of the recipient.
 * @param trustedKeys - Public keys of senders the recipient trusts.
 * @param options - Optional overrides, including a custom spent-token store for tests.
 */
export function verifyShareToken(
  token: string,
  recipientPrivateKeyPem: string,
  recipientPublicKeyPem: string,
  trustedKeys: TrustedSharingKey[],
  options?: { spentStore?: SpentShareTokenStore }
): DecodedShare {
  const spentStore = options?.spentStore ?? getDefaultSpentShareTokenStore();
  const trimmed = token.trim();
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid share token: expected three JWT segments.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseShareHeader(encodedHeader);
  const envelope = parseShareEnvelope(encodedPayload);
  const now = Date.now();
  assertShareFreshness(envelope, now);

  if (spentStore.isSpent(envelope.jti)) {
    throw new Error('Invalid share token: share token has already been used.');
  }

  const recipientKid = publicKeyFingerprint(recipientPublicKeyPem);
  if (header.recipientKid !== recipientKid) {
    throw new Error('Invalid share token: this share token was not issued to you.');
  }

  const sender = trustedKeys.find((key) => key.id === header.senderKid);
  if (!sender) {
    throw new Error('Invalid share token: share token is from an untrusted sender.');
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signatureValid = verify(
    'RSA-SHA256',
    new TextEncoder().encode(signingInput),
    createPublicKey(sender.publicKeyPem),
    asArrayBufferView(base64UrlDecodeBuffer(encodedSignature))
  );
  if (!signatureValid) {
    throw new Error('Invalid share token: signature verification failed.');
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
    throw new Error('Invalid share token: unable to decrypt share token.');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    asCipherKey(aesKey),
    asBinaryLike(base64UrlDecodeBuffer(envelope.iv))
  );
  decipher.setAuthTag(asArrayBufferView(base64UrlDecodeBuffer(envelope.tag)));

  let decrypted: Buffer;
  try {
    decrypted = concatBuffers(
      decipher.update(asArrayBufferView(base64UrlDecodeBuffer(envelope.ct))) as Buffer,
      decipher.final()
    );
  } catch {
    throw new Error('Invalid share token: payload tampering detected.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decrypted.toString('utf-8')) as unknown;
  } catch {
    throw new Error('Invalid share token: malformed payload.');
  }

  const payload = parseDecryptedPayload(parsed);
  spentStore.markSpent(envelope.jti, envelope.exp);
  return { connection: payload.conn, collection: payload.collection };
}
