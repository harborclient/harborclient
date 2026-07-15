import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearSecretEncryptorForTesting,
  createLocalSecretEncryptor,
  type EncryptedSecret,
  type SecretEncryptor,
  setSecretEncryptorForTesting
} from './secretStorage';

describe('secretStorage', () => {
  afterEach(() => {
    clearSecretEncryptorForTesting();
  });

  describe('local AES encryptor', () => {
    let userDataDir: string;

    beforeEach(() => {
      userDataDir = mkdtempSync(join(tmpdir(), 'harborclient-secrets-'));
    });

    afterEach(() => {
      rmSync(userDataDir, { recursive: true, force: true });
    });

    it('round-trips plaintext with local encryption', () => {
      const encryptor = createLocalSecretEncryptor(userDataDir);
      const payload = encryptor.encrypt('sk-test-key');

      expect(payload.v).toBe(1);
      expect(payload.method).toBe('local');
      expect(payload.ciphertext).not.toContain('sk-test-key');

      expect(encryptor.decrypt(payload)).toBe('sk-test-key');
    });

    it('reuses the same local key file across encrypt operations', () => {
      const encryptor = createLocalSecretEncryptor(userDataDir);
      encryptor.encrypt('first');
      encryptor.encrypt('second');

      expect(encryptor.decrypt(encryptor.encrypt('third'))).toBe('third');
    });

    it('throws when decrypting tampered ciphertext', () => {
      const encryptor = createLocalSecretEncryptor(userDataDir);
      const payload = encryptor.encrypt('sk-test-key');
      const tampered: EncryptedSecret = {
        ...payload,
        ciphertext:
          Buffer.from(payload.ciphertext, 'base64').toString('base64').slice(0, -4) + 'AAAA'
      };

      expect(() => encryptor.decrypt(tampered)).toThrow(/Failed to decrypt secret/);
    });
  });

  describe('test encryptor override', () => {
    it('uses the injected encryptor for round-trip', () => {
      const mockEncryptor: SecretEncryptor = {
        isOsEncryptionAvailable: () => true,
        encrypt: (plaintext) => ({
          v: 1,
          method: 'safeStorage',
          ciphertext: Buffer.from(`mock:${plaintext}`, 'utf8').toString('base64')
        }),
        decrypt: (payload) => {
          const decoded = Buffer.from(payload.ciphertext, 'base64').toString('utf8');
          if (!decoded.startsWith('mock:')) {
            throw new Error('Invalid mock ciphertext.');
          }
          return decoded.slice('mock:'.length);
        }
      };

      setSecretEncryptorForTesting(mockEncryptor);
      const payload = mockEncryptor.encrypt('secret-value');

      expect(mockEncryptor.decrypt(payload)).toBe('secret-value');
    });
  });
});
