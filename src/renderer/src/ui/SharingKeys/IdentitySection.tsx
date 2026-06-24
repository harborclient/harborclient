import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { SharingIdentity } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { field } from '#/renderer/src/ui/shared/classes';

/**
 * Local sharing identity: fingerprint, export, and import.
 */
export function IdentitySection(): JSX.Element {
  const [identity, setIdentity] = useState<SharingIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Loads the local sharing identity on mount.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api.getSharingIdentity().then((nextIdentity) => {
      if (cancelled) return;
      setIdentity(nextIdentity);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Copies the local public key PEM to the clipboard.
   */
  const handleCopyPublicKey = async (): Promise<void> => {
    if (!identity) return;
    try {
      await navigator.clipboard.writeText(identity.publicKeyPem);
      toast.success('Public key copied');
    } catch {
      toast.error('Failed to copy public key');
    }
  };

  /**
   * Exports the local private key via a native save dialog.
   */
  const handleExportPrivateKey = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.api.exportSharingPrivateKey();
      if (result.canceled) return;
      toast.success('Private key exported');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Exports the local public key via a native save dialog.
   */
  const handleExportPublicKey = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const result = await window.api.exportSharingPublicKey();
      if (result.canceled) return;
      toast.success('Public key exported');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Replaces the local key pair from a PEM private key file.
   */
  const handleImportKeyPair = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const nextIdentity = await window.api.importSharingKeyPair();
      setIdentity(nextIdentity);
      toast.success('Key pair imported');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message !== 'Import canceled.') {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="m-0 mb-1 text-[14px] font-medium text-text">My identity</h2>
        <p className="m-0 text-[14px] text-muted">
          Your key pair signs share tokens you send and decrypts tokens addressed to you. Share your
          public key so collaborators can trust and encrypt to you.
        </p>
      </div>

      {loading ? (
        <p role="status" className="text-[14px] text-muted">
          Loading…
        </p>
      ) : identity ? (
        <>
          <label
            htmlFor="identity-fingerprint"
            className="mb-1 block text-[14px] font-medium text-text"
          >
            Fingerprint
          </label>
          <input
            id="identity-fingerprint"
            className={`${field} mb-4 w-full font-mono text-[14px]`}
            readOnly
            value={identity.fingerprint}
            onFocus={(event) => event.target.select()}
          />

          <label className="mb-1 block text-[14px] font-medium text-text">Public key</label>
          <textarea
            className={`${field} mb-4 min-h-28 w-full resize-y font-mono text-[14px]`}
            readOnly
            value={identity.publicKeyPem}
            onFocus={(event) => event.target.select()}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void handleCopyPublicKey()}
            >
              Copy public key
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void handleExportPublicKey()}
            >
              Export public key
            </Button>
            <Button
              type="button"
              variant="secondaryDanger"
              disabled={busy}
              onClick={() => void handleExportPrivateKey()}
            >
              Export private key
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleImportKeyPair()}>
              Import key pair
            </Button>
          </div>

          <p className="mb-0 mt-4 text-[14px] text-danger">
            Keep your private key secret. Anyone with it can sign share tokens as you.
          </p>
        </>
      ) : null}

      {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}
    </div>
  );
}
