import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { InviteIdentity } from '#/shared/types';
import { field, primaryButton, secondaryButton } from '#/renderer/src/ui/shared/classes';

/**
 * Local invite identity: fingerprint, export, and import.
 */
export function IdentitySection(): JSX.Element {
  const [identity, setIdentity] = useState<InviteIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void window.api.getInviteIdentity().then((nextIdentity) => {
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
      const result = await window.api.exportInvitePrivateKey();
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
      const result = await window.api.exportInvitePublicKey();
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
      const nextIdentity = await window.api.importInviteKeyPair();
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
        <h2 className="m-0 mb-1 text-[13px] font-medium text-text">My identity</h2>
        <p className="m-0 text-[12px] text-muted">
          Your key pair signs invites you send and decrypts invites addressed to you. Share your
          public key so collaborators can trust and encrypt to you.
        </p>
      </div>

      {loading ? (
        <p className="text-[12px] text-muted">Loading…</p>
      ) : identity ? (
        <>
          <label className="mb-1 block text-[12px] font-medium text-text">Fingerprint</label>
          <p className="mb-4 font-mono text-[12px] text-muted break-all">{identity.fingerprint}</p>

          <label className="mb-1 block text-[12px] font-medium text-text">Public key</label>
          <textarea
            className={`${field} mb-4 min-h-28 w-full resize-y font-mono text-[12px]`}
            readOnly
            value={identity.publicKeyPem}
            onFocus={(event) => event.target.select()}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryButton}
              disabled={busy}
              onClick={() => void handleCopyPublicKey()}
            >
              Copy public key
            </button>
            <button
              type="button"
              className={secondaryButton}
              disabled={busy}
              onClick={() => void handleExportPublicKey()}
            >
              Export public key
            </button>
            <button
              type="button"
              className={`${secondaryButton} text-danger hover:bg-danger/15`}
              disabled={busy}
              onClick={() => void handleExportPrivateKey()}
            >
              Export private key
            </button>
            <button
              type="button"
              className={primaryButton}
              disabled={busy}
              onClick={() => void handleImportKeyPair()}
            >
              Import key pair
            </button>
          </div>

          <p className="mb-0 mt-4 text-[12px] text-danger">
            Keep your private key secret. Anyone with it can sign invites as you.
          </p>
        </>
      ) : null}

      {error && <p className="mt-3 text-[12px] text-danger">{error}</p>}
    </div>
  );
}
