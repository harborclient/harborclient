import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'crypto';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { publicKeyFingerprint } from './shareToken';
import type { SharingIdentity } from '#/shared/types';

const PRIVATE_KEY_FILENAME = 'sharing-key.pem';
const PUBLIC_KEY_FILENAME = 'sharing-pub.pem';

export interface SharingKeyPair {
  privateKey: string;
  publicKey: string;
}

let cachedKeys: SharingKeyPair | null = null;

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
  const message = new TextEncoder().encode('harborclient-sharing-key-check');
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
 * Ensures an RSA key pair exists for signing share JWTs.
 *
 * Keys are stored in userData as sharing-key.pem and sharing-pub.pem.
 *
 * @param userDataPath - Electron userData directory.
 */
export async function ensureSharingKeys(userDataPath: string): Promise<SharingKeyPair> {
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
 * Returns the local sharing identity, generating keys when missing.
 *
 * @param userDataPath - Electron userData directory.
 */
export async function getSharingIdentity(userDataPath: string): Promise<SharingIdentity> {
  const { publicKey } = await ensureSharingKeys(userDataPath);
  return {
    publicKeyPem: publicKey,
    fingerprint: publicKeyFingerprint(publicKey)
  };
}

/**
 * Replaces the local sharing key pair from a PEM private key.
 *
 * @param userDataPath - Electron userData directory.
 * @param privateKeyPem - PEM-encoded RSA private key.
 */
export async function importSharingKeyPair(
  userDataPath: string,
  privateKeyPem: string
): Promise<SharingIdentity> {
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
