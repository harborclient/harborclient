import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { TrustedInviteKey } from '#/shared/types';
import { field, primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';

/**
 * Trusted collaborator public keys for verifying invite signatures.
 */
export function TrustedKeysSection(): JSX.Element {
  const [keys, setKeys] = useState<TrustedInviteKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [publicKeyPem, setPublicKeyPem] = useState('');
  const [deletingKey, setDeletingKey] = useState<TrustedInviteKey | null>(null);

  useEffect(() => {
    let cancelled = false;

    void window.api.listTrustedKeys().then((nextKeys) => {
      if (cancelled) return;
      setKeys(nextKeys);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!deletingKey) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setDeletingKey(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deletingKey]);

  /**
   * Adds a trusted public key from the form.
   */
  const handleAdd = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const nextKeys = await window.api.addTrustedKey(label, publicKeyPem);
      setKeys(nextKeys);
      setLabel('');
      setPublicKeyPem('');
      toast.success('Trusted key added');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Imports a trusted public key from a PEM file.
   */
  const handleImport = async (): Promise<void> => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Enter a label before importing a public key.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const nextKeys = await window.api.importTrustedPublicKey(trimmedLabel);
      setKeys(nextKeys);
      setPublicKeyPem('');
      toast.success('Trusted key imported');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== 'Import canceled.') {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  /**
   * Removes a trusted key by id.
   *
   * @param id - Fingerprint of the key to remove.
   */
  const handleDelete = async (id: string): Promise<void> => {
    setError(null);
    setDeletingKey(null);
    try {
      const nextKeys = await window.api.removeTrustedKey(id);
      setKeys(nextKeys);
      toast.success('Trusted key removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <div>
        <div className="mb-4">
          <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Trusted keys</h2>
          <p className="m-0 text-[12px] text-muted">
            Add public keys for people you trust. Invites must be signed by a trusted sender, and
            you can only create invites for keys listed here.
          </p>
        </div>

        <div className="mb-4 rounded-md border border-separator p-3">
          <label className="mb-1 block text-[12px] font-medium text-text">Label</label>
          <input
            className={`${field} mb-3 w-full`}
            type="text"
            placeholder="e.g. Alex"
            value={label}
            disabled={busy}
            onChange={(event) => setLabel(event.target.value)}
          />

          <label className="mb-1 block text-[12px] font-medium text-text">Public key (PEM)</label>
          <textarea
            className={`${field} mb-3 min-h-24 w-full resize-y font-mono text-[12px]`}
            placeholder="-----BEGIN PUBLIC KEY-----"
            value={publicKeyPem}
            disabled={busy}
            onChange={(event) => setPublicKeyPem(event.target.value)}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primaryButton}
              disabled={busy || !label.trim() || !publicKeyPem.trim()}
              onClick={() => void handleAdd()}
            >
              Add trusted key
            </button>
            <button
              type="button"
              className={secondaryButton}
              disabled={busy || !label.trim()}
              onClick={() => void handleImport()}
            >
              Import from file
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-[12px] text-muted">Loading…</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex items-center justify-between gap-3 rounded-md border border-separator px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-text">{key.label}</div>
                  <div className="truncate font-mono text-[11px] text-muted">{key.id}</div>
                </div>
                <button
                  type="button"
                  className={`${secondaryButton} shrink-0`}
                  onClick={() => setDeletingKey(key)}
                >
                  Delete
                </button>
              </li>
            ))}
            {keys.length === 0 && <li className="text-[12px] text-muted">No trusted keys yet.</li>}
          </ul>
        )}

        {error && !deletingKey && <p className="mt-3 text-[12px] text-danger">{error}</p>}
      </div>

      {deletingKey && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setDeletingKey(null)}
        >
          <div
            className="w-96 rounded-lg border border-separator bg-surface p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="m-0 mb-1 text-[13px] font-semibold text-text">Remove trusted key?</h2>
            <p className="mb-4 text-[12px] text-muted">
              Remove &ldquo;{deletingKey.label}&rdquo;? Invites signed by this key will no longer be
              accepted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={secondaryButton}
                onClick={() => setDeletingKey(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${secondaryButton} text-danger hover:bg-danger/15`}
                onClick={() => void handleDelete(deletingKey.id)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
