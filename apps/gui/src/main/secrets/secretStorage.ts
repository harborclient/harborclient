import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app, safeStorage } from 'electron';
import {
  asArrayBufferView,
  asBinaryLike,
  asCipherKey,
  concatBuffers
} from '#/main/crypto/bufferAdapters';

const LOCAL_KEY_FILENAME = 'local-secrets.key';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const LOCAL_KEY_LENGTH = 32;

/**
 * Versioned envelope for encrypted secret payloads persisted in local storage.
 */
export interface EncryptedSecret {
  /**
   * Envelope format version.
   */
  v: 1;

  /**
   * Encryption backend used for the ciphertext.
   */
  method: 'safeStorage' | 'local';

  /**
   * Base64-encoded encrypted payload.
   */
  ciphertext: string;
}

/**
 * Encrypts and decrypts sensitive strings for at-rest storage.
 */
export interface SecretEncryptor {
  /**
   * Encrypts a plaintext secret.
   *
   * @param plaintext - Secret value to protect.
   */
  encrypt(plaintext: string): EncryptedSecret;

  /**
   * Decrypts a stored secret envelope.
   *
   * @param payload - Encrypted secret envelope.
   */
  decrypt(payload: EncryptedSecret): string;

  /**
   * Whether OS-backed encryption via Electron safeStorage is available.
   */
  isOsEncryptionAvailable(): boolean;
}

interface DefaultSecretEncryptorOptions {
  /**
   * Optional userData path override for tests.
   */
  userDataPath?: string;

  /**
   * When true, always use local AES encryption (for tests).
   */
  forceLocal?: boolean;
}

let encryptorOverride: SecretEncryptor | null = null;
let defaultEncryptor: SecretEncryptor | null = null;

/**
 * Reads or creates the local AES key file in userData.
 *
 * @param userDataPath - Electron userData directory.
 */
function getLocalEncryptionKey(userDataPath: string): Buffer {
  const keyPath = join(userDataPath, LOCAL_KEY_FILENAME);
  if (existsSync(keyPath)) {
    const key = readFileSync(keyPath);
    if (key.length !== LOCAL_KEY_LENGTH) {
      throw new Error('Invalid local secrets key length.');
    }
    return key;
  }

  const key = randomBytes(LOCAL_KEY_LENGTH);
  writeFileSync(keyPath, new Uint8Array(key), { mode: 0o600 });
  chmodSync(keyPath, 0o600);
  return key;
}

/**
 * Encrypts plaintext with AES-256-GCM using the local userData key.
 *
 * @param plaintext - Secret value to encrypt.
 * @param userDataPath - Electron userData directory.
 */
function encryptLocal(plaintext: string, userDataPath: string): string {
  const key = getLocalEncryptionKey(userDataPath);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', asCipherKey(key), asBinaryLike(iv));
  const encrypted = concatBuffers(cipher.update(plaintext, 'utf8') as Buffer, cipher.final());
  const authTag = cipher.getAuthTag();
  return concatBuffers(iv, authTag, encrypted).toString('base64');
}

/**
 * Decrypts a local AES-256-GCM payload.
 *
 * @param ciphertextBase64 - Base64 iv + authTag + ciphertext.
 * @param userDataPath - Electron userData directory.
 */
function decryptLocal(ciphertextBase64: string, userDataPath: string): string {
  const key = getLocalEncryptionKey(userDataPath);
  const data = Buffer.from(ciphertextBase64, 'base64');
  if (data.length <= IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error('Encrypted payload is too short.');
  }

  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', asCipherKey(key), asBinaryLike(iv));
  decipher.setAuthTag(asArrayBufferView(authTag));
  return concatBuffers(
    decipher.update(asArrayBufferView(encrypted)) as Buffer,
    decipher.final()
  ).toString('utf8');
}

/**
 * Default encryptor using OS safeStorage when available, otherwise local AES.
 */
class DefaultSecretEncryptor implements SecretEncryptor {
  readonly #userDataPath: string | undefined;
  readonly #forceLocal: boolean;

  /**
   * @param options - Optional userData override and local-only test mode.
   */
  constructor(options: DefaultSecretEncryptorOptions = {}) {
    this.#userDataPath = options.userDataPath;
    this.#forceLocal = options.forceLocal === true;
  }

  /**
   * Resolves the userData path for local encryption.
   */
  #resolveUserDataPath(): string {
    return this.#userDataPath ?? app.getPath('userData');
  }

  /**
   * @inheritdoc
   */
  isOsEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  /**
   * @inheritdoc
   */
  encrypt(plaintext: string): EncryptedSecret {
    if (!this.#forceLocal && safeStorage.isEncryptionAvailable()) {
      return {
        v: 1,
        method: 'safeStorage',
        ciphertext: safeStorage.encryptString(plaintext).toString('base64')
      };
    }

    return {
      v: 1,
      method: 'local',
      ciphertext: encryptLocal(plaintext, this.#resolveUserDataPath())
    };
  }

  /**
   * @inheritdoc
   */
  decrypt(payload: EncryptedSecret): string {
    if (payload.v !== 1) {
      throw new Error('Unsupported encrypted secret version.');
    }

    try {
      if (payload.method === 'safeStorage') {
        return safeStorage.decryptString(Buffer.from(payload.ciphertext, 'base64'));
      }
      if (payload.method === 'local') {
        return decryptLocal(payload.ciphertext, this.#resolveUserDataPath());
      }
      throw new Error(`Unsupported encryption method: ${String(payload.method)}`);
    } catch (err) {
      throw new Error(
        `Failed to decrypt secret: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}

/**
 * Returns the active secret encryptor instance.
 */
function getEncryptor(): SecretEncryptor {
  if (encryptorOverride) {
    return encryptorOverride;
  }
  if (!defaultEncryptor) {
    defaultEncryptor = new DefaultSecretEncryptor();
  }
  return defaultEncryptor;
}

/**
 * Encrypts a plaintext secret for at-rest storage.
 *
 * @param plaintext - Secret value to protect.
 */
export function encryptSecret(plaintext: string): EncryptedSecret {
  return getEncryptor().encrypt(plaintext);
}

/**
 * Decrypts a stored secret envelope.
 *
 * @param payload - Encrypted secret envelope.
 */
export function decryptSecret(payload: EncryptedSecret): string {
  return getEncryptor().decrypt(payload);
}

/**
 * Whether OS-backed encryption is available on this system.
 */
export function isOsSecretEncryptionAvailable(): boolean {
  return getEncryptor().isOsEncryptionAvailable();
}

/**
 * Creates an encryptor that uses local AES with a specific userData path.
 *
 * @param userDataPath - Directory for the local secrets key file.
 */
export function createLocalSecretEncryptor(userDataPath: string): SecretEncryptor {
  return new DefaultSecretEncryptor({ userDataPath, forceLocal: true });
}

/**
 * Installs a secret encryptor for unit tests.
 *
 * @param encryptor - Encryptor to use instead of the default.
 */
export function setSecretEncryptorForTesting(encryptor: SecretEncryptor): void {
  encryptorOverride = encryptor;
}

/**
 * Clears the test secret encryptor override.
 */
export function clearSecretEncryptorForTesting(): void {
  encryptorOverride = null;
  defaultEncryptor = null;
}
