import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { publicKeyFingerprint } from '#/main/invite/inviteToken';
import type { InviteIdentity } from '#/shared/types';

const PRIVATE_KEY_FILENAME = 'invite-key.pem';
const PUBLIC_KEY_FILENAME = 'invite-pub.pem';

export interface InviteKeyPair {
  privateKey: string;
  publicKey: string;
}

let cachedKeys: InviteKeyPair | null = null;

/**
 * Reads a PEM file from userData, returning undefined when missing.
 *
 * @param filePath - Absolute path to the PEM file.
 */
async function readPem(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Validates that a private/public PEM pair can sign and verify.
 *
 * @param privateKeyPem - PEM-encoded RSA private key.
 * @param publicKeyPem - PEM-encoded RSA public key.
 */
function assertValidKeyPair(privateKeyPem: string, publicKeyPem: string): void {
  const message = new TextEncoder().encode('harborclient-invite-key-check');
  const signature = sign('RSA-SHA256', message, createPrivateKey(privateKeyPem));
  const valid = verify(
    'RSA-SHA256',
    message,
    createPublicKey(publicKeyPem),
    signature as unknown as NodeJS.ArrayBufferView
  );
  if (!valid) {
    throw new Error('Invalid key pair: public key does not match the private key.');
  }
}

/**
 * Ensures an RSA key pair exists for signing invite JWTs.
 *
 * Keys are stored in userData as invite-key.pem and invite-pub.pem.
 *
 * @param userDataPath - Electron userData directory.
 */
export async function ensureInviteKeys(userDataPath: string): Promise<InviteKeyPair> {
  if (cachedKeys) return cachedKeys;

  const privatePath = join(userDataPath, PRIVATE_KEY_FILENAME);
  const publicPath = join(userDataPath, PUBLIC_KEY_FILENAME);

  const existingPrivate = await readPem(privatePath);
  const existingPublic = await readPem(publicPath);

  if (existingPrivate && existingPublic) {
    cachedKeys = { privateKey: existingPrivate, publicKey: existingPublic };
    return cachedKeys;
  }

  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });

  await writeFile(privatePath, privateKey, 'utf-8');
  await writeFile(publicPath, publicKey, 'utf-8');

  cachedKeys = { privateKey, publicKey };
  return cachedKeys;
}

/**
 * Returns the local invite identity, generating keys when missing.
 *
 * @param userDataPath - Electron userData directory.
 */
export async function getInviteIdentity(userDataPath: string): Promise<InviteIdentity> {
  const { publicKey } = await ensureInviteKeys(userDataPath);
  return {
    publicKeyPem: publicKey,
    fingerprint: publicKeyFingerprint(publicKey)
  };
}

/**
 * Replaces the local invite key pair from a PEM private key.
 *
 * @param userDataPath - Electron userData directory.
 * @param privateKeyPem - PEM-encoded RSA private key.
 */
export async function importInviteKeyPair(
  userDataPath: string,
  privateKeyPem: string
): Promise<InviteIdentity> {
  const trimmedPrivate = privateKeyPem.trim();
  if (!trimmedPrivate) {
    throw new Error('Private key file is empty.');
  }

  let publicKeyPem: string;
  try {
    publicKeyPem = createPublicKey(createPrivateKey(trimmedPrivate)).export({
      type: 'spki',
      format: 'pem'
    }) as string;
  } catch {
    throw new Error('Invalid private key PEM.');
  }

  assertValidKeyPair(trimmedPrivate, publicKeyPem);

  const privatePath = join(userDataPath, PRIVATE_KEY_FILENAME);
  const publicPath = join(userDataPath, PUBLIC_KEY_FILENAME);
  await writeFile(privatePath, trimmedPrivate, 'utf-8');
  await writeFile(publicPath, publicKeyPem, 'utf-8');

  cachedKeys = { privateKey: trimmedPrivate, publicKey: publicKeyPem };
  return {
    publicKeyPem,
    fingerprint: publicKeyFingerprint(publicKeyPem)
  };
}
