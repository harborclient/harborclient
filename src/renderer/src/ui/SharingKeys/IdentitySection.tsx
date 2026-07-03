import { Button, FaIcon, Page, Input, Textarea, FormGroup } from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { SharingIdentity } from '#/shared/types';
import { faPlus } from '#/renderer/src/fontawesome';

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
    <Page
      embedded
      title="My identity"
      description="Your key pair signs share tokens you send and decrypts tokens addressed to you. Share your public key so collaborators can trust and encrypt to you."
      actions={
        <Button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          disabled={busy}
          onClick={() => void handleImportKeyPair()}
        >
          <FaIcon icon={faPlus} className="h-3.5 w-3.5" />
          Import key pair
        </Button>
      }
    >
      {loading ? (
        <p role="status" className="text-[14px] text-muted">
          Loading…
        </p>
      ) : identity ? (
        <div className="flex flex-col gap-4">
          <FormGroup label="Fingerprint" htmlFor="identity-fingerprint">
            <p className="mb-0 text-[16px] mb-2 text-muted">
              The SHA-256 fingerprint of your public key.
            </p>
            <Input
              id="identity-fingerprint"
              className="w-full font-mono text-[14px]"
              readOnly
              value={identity.fingerprint}
              onFocus={(event) => event.target.select()}
            />
          </FormGroup>

          <FormGroup label="Public key">
            <p className="mb-0 text-[16px] mb-2 text-muted">
              Keep your private key secret. Anyone with it can sign share tokens as you.
            </p>

            <Textarea
              className="min-h-66 w-full resize-y font-mono text-[16px] mb-2"
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
                variant="secondary"
                disabled={busy}
                onClick={() => void handleExportPrivateKey()}
              >
                Export private key
              </Button>
            </div>
          </FormGroup>
        </div>
      ) : null}

      {error && <p className="mt-3 text-[14px] text-danger">{error}</p>}
    </Page>
  );
}
