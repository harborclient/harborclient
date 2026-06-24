import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { TrustedSharingKey } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { field } from '#/renderer/src/ui/shared/classes';

/**
 * Trusted collaborator public keys for verifying share token signatures.
 */
export function TrustedKeysSection(): JSX.Element {
  const confirm = useConfirm();
  const [keys, setKeys] = useState<TrustedSharingKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [publicKeyPem, setPublicKeyPem] = useState('');

  /**
   * Loads trusted sharing public keys on mount.
   */
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
    try {
      const nextKeys = await window.api.removeTrustedKey(id);
      setKeys(nextKeys);
      toast.success('Trusted key removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  /**
   * Prompts for confirmation before removing a trusted key.
   *
   * @param key - Trusted key the user chose to delete.
   */
  const handleDeleteClick = (key: TrustedSharingKey): void => {
    void (async () => {
      const confirmed = await confirm({
        title: 'Remove trusted key?',
        message: `Remove "${key.label}"? Share tokens signed by this key will no longer be accepted.`,
        confirmLabel: 'Remove',
        variant: 'danger'
      });
      if (confirmed) void handleDelete(key.id);
    })();
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="m-0 mb-1 text-[14px] font-medium text-text">Trusted keys</h2>
        <p className="m-0 text-[14px] text-muted">
          Add public keys for people you trust. Share tokens must be signed by a trusted sender, and
          you can only create share tokens for keys listed here.
        </p>
      </div>

      <div className="mb-4 rounded-md border border-separator p-3">
        <label className="mb-1 block text-[14px] font-medium text-text">Label</label>
        <input
          className={`${field} mb-3 w-full`}
          type="text"
          placeholder="e.g. Alex"
          value={label}
          disabled={busy}
          onChange={(event) => setLabel(event.target.value)}
        />

        <label className="mb-1 block text-[14px] font-medium text-text">Public key (PEM)</label>
        <textarea
          className={`${field} mb-3 min-h-24 w-full resize-y font-mono text-[14px]`}
          placeholder="-----BEGIN PUBLIC KEY-----"
          value={publicKeyPem}
          disabled={busy}
          onChange={(event) => setPublicKeyPem(event.target.value)}
        />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy || !label.trim() || !publicKeyPem.trim()}
            onClick={() => void handleAdd()}
          >
            Add trusted key
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || !label.trim()}
            onClick={() => void handleImport()}
          >
            Import from file
          </Button>
        </div>
      </div>

      {loading ? (
        <p role="status" className="text-[14px] text-muted">
          Loading…
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {keys.map((key) => (
            <li
              key={key.id}
              className="flex items-center justify-between gap-3 rounded-md border border-separator px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-text">{key.label}</div>
                <div className="truncate font-mono text-[14px] text-muted">{key.id}</div>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={() => handleDeleteClick(key)}
              >
                Delete
              </Button>
            </li>
          ))}
          {keys.length === 0 && <li className="text-[14px] text-muted">No trusted keys yet.</li>}
        </ul>
      )}

      {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}
    </div>
  );
}
