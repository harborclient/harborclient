import { useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { TrustedSharingKey } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { PageHeader } from '#/renderer/src/components/PageHeader';
import { PanelCloseButton } from '#/renderer/src/components/PanelCloseButton';
import {
  ResourceList,
  ResourceListEmptyItem,
  ResourceListPrimary,
  ResourceListRow
} from '#/renderer/src/components/ResourceList';
import { FieldError } from '#/renderer/src/components/FieldError';
import { AsyncListState, LoadingMessage } from '#/renderer/src/components/AsyncListState';
import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { Input, Textarea } from '#/renderer/src/components/forms';
import { FormGroup } from '#/renderer/src/components/FormGroup';

interface Props {
  /**
   * Closes the sharing keys overlay.
   */
  onClose: () => void;
}

/**
 * Trusted collaborator public keys for verifying share token signatures.
 */
export function TrustedKeysSection({ onClose }: Props): JSX.Element {
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
      <PageHeader
        title="Trusted keys"
        description="Add public keys for people you trust. Share tokens must be signed by a trusted sender, and you can only create share tokens for keys listed here."
      >
        <PanelCloseButton onClose={onClose} ariaLabel="Close sharing keys" />
      </PageHeader>

      <div className="mb-4 rounded-md border border-separator p-3">
        <FormGroup label="Label">
          <Input
            className="mb-3 w-full"
            type="text"
            placeholder="e.g. Alex"
            value={label}
            disabled={busy}
            onChange={(event) => setLabel(event.target.value)}
          />
        </FormGroup>

        <FormGroup label="Public key (PEM)">
          <Textarea
            className="mb-3 min-h-24 w-full resize-y font-mono text-[14px]"
            placeholder="-----BEGIN PUBLIC KEY-----"
            value={publicKeyPem}
            disabled={busy}
            onChange={(event) => setPublicKeyPem(event.target.value)}
          />
        </FormGroup>

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

      <AsyncListState loading={loading} loadingMessage={<LoadingMessage>Loading…</LoadingMessage>}>
        <ResourceList>
          {keys.map((key) => (
            <ResourceListRow
              key={key.id}
              primary={<ResourceListPrimary>{key.label}</ResourceListPrimary>}
              secondary={<span className="font-mono">{key.id}</span>}
              actions={
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => handleDeleteClick(key)}
                >
                  Delete
                </Button>
              }
            />
          ))}
          {keys.length === 0 && <ResourceListEmptyItem>No trusted keys yet.</ResourceListEmptyItem>}
        </ResourceList>
      </AsyncListState>

      {error && <FieldError spacing="section">{error}</FieldError>}
    </div>
  );
}
