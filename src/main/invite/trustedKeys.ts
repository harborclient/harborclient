import { getLocalRegistry } from '#/main/db/localRegistryInstance';
import { publicKeyFingerprint } from '#/main/invite/inviteToken';
import type { TrustedInviteKey } from '#/shared/types';
import { parseJson } from '#/shared/parseJson';

const TRUSTED_KEYS_SETTING = 'trustedInviteKeys';

/**
 * Persists trusted invite public keys to the local registry.
 *
 * @param keys - Trusted keys to store.
 */
function persistTrustedKeys(keys: TrustedInviteKey[]): void {
  getLocalRegistry().setSetting(TRUSTED_KEYS_SETTING, JSON.stringify(keys));
}

/**
 * Returns all trusted invite public keys.
 */
export function listTrustedKeys(): TrustedInviteKey[] {
  const raw = getLocalRegistry().getSetting(TRUSTED_KEYS_SETTING);
  const keys = parseJson<TrustedInviteKey[]>(raw, []);
  return keys.filter(
    (key) =>
      typeof key.id === 'string' &&
      typeof key.label === 'string' &&
      typeof key.publicKeyPem === 'string' &&
      typeof key.addedAt === 'number'
  );
}

/**
 * Adds or updates a trusted invite public key.
 *
 * @param label - User-defined label for the key owner.
 * @param publicKeyPem - PEM-encoded RSA public key.
 */
export function addTrustedKey(label: string, publicKeyPem: string): TrustedInviteKey[] {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    throw new Error('Trusted key label is required.');
  }

  const trimmedPem = publicKeyPem.trim();
  if (!trimmedPem) {
    throw new Error('Trusted public key is required.');
  }

  const id = publicKeyFingerprint(trimmedPem);
  const existing = listTrustedKeys();
  const nextKey: TrustedInviteKey = {
    id,
    label: trimmedLabel,
    publicKeyPem: trimmedPem,
    addedAt: Date.now()
  };

  const withoutDuplicate = existing.filter((key) => key.id !== id);
  const next = [...withoutDuplicate, nextKey];
  persistTrustedKeys(next);
  return next;
}

/**
 * Removes a trusted invite public key by fingerprint id.
 *
 * @param id - SHA-256 fingerprint of the public key to remove.
 */
export function removeTrustedKey(id: string): TrustedInviteKey[] {
  const next = listTrustedKeys().filter((key) => key.id !== id);
  persistTrustedKeys(next);
  return next;
}
