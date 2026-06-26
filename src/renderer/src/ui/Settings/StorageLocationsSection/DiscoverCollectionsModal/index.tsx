import { useCallback, useId, useState, type JSX } from 'react';
import type { DiscoveredCollection } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { FormGroup } from '#/renderer/src/components/FormGroup';
import { Modal, ModalFooter } from '#/renderer/src/components/Modal';
import { FieldError } from '#/renderer/src/components/FieldError';
import { StatusMessage } from '#/renderer/src/components/StatusMessage';

interface Props {
  /**
   * Display name of the storage location being scanned.
   */
  connectionName: string;

  /**
   * Collections found on the provider that are not yet in the sidebar.
   */
  collections: DiscoveredCollection[];

  /**
   * Called when the user confirms adding selected collections.
   *
   * @param providerCollectionIds - Provider-local ids to register.
   */
  onConfirm: (providerCollectionIds: number[]) => Promise<void>;

  /**
   * Called when the user declines to add collections now.
   */
  onSkip: () => Promise<void>;

  /**
   * Dismisses the modal without persisting a choice (Escape / backdrop).
   */
  onClose: () => void;
}

/**
 * Prompts the user to add existing collections discovered on a new storage provider.
 */
export function DiscoverCollectionsModal({
  connectionName,
  collections,
  onConfirm,
  onSkip,
  onClose
}: Props): JSX.Element {
  const headingId = useId();
  const listId = useId();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(collections.map((collection) => collection.providerCollectionId))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = selectedIds.size === collections.length;
  const noneSelected = selectedIds.size === 0;

  /**
   * Toggles whether a discovered collection is selected for import.
   *
   * @param providerCollectionId - Provider-local collection id.
   * @param checked - New checkbox state.
   */
  const handleToggle = (providerCollectionId: number, checked: boolean): void => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(providerCollectionId);
      } else {
        next.delete(providerCollectionId);
      }
      return next;
    });
  };

  /**
   * Selects or clears every discovered collection in the list.
   *
   * @param selectAll - When true, selects all collections; otherwise clears selection.
   */
  const handleSelectAll = (selectAll: boolean): void => {
    setSelectedIds(
      selectAll
        ? new Set(collections.map((collection) => collection.providerCollectionId))
        : new Set()
    );
  };

  /**
   * Registers the selected collections in the sidebar registry.
   */
  const handleConfirm = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      await onConfirm([...selectedIds]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }, [onConfirm, selectedIds]);

  /**
   * Records that the user skipped adding discovered collections.
   */
  const handleSkip = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      await onSkip();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }, [onSkip]);

  return (
    <Modal
      labelledBy={headingId}
      className="w-[480px]"
      onClose={onClose}
      disableEscape={busy}
      closeDisabled={busy}
      title="Add existing collections?"
      description={
        <>
          &ldquo;{connectionName || 'Untitled'}&rdquo; already contains{' '}
          {collections.length === 1 ? 'a collection' : `${collections.length} collections`}. Choose
          which to show in the sidebar.
        </>
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[14px] font-medium text-text">Collections</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={busy || allSelected}
            onClick={() => handleSelectAll(true)}
          >
            Select all
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy || noneSelected}
            onClick={() => handleSelectAll(false)}
          >
            Deselect all
          </Button>
        </div>
      </div>

      <ul id={listId} className="m-0 max-h-60 list-none space-y-2 overflow-y-auto p-0">
        {collections.map((collection) => {
          const checkboxId = `${listId}-${collection.providerCollectionId}`;
          const checked = selectedIds.has(collection.providerCollectionId);

          return (
            <li
              key={collection.providerCollectionId}
              className="rounded-md border border-separator bg-control px-3 py-2"
            >
              <FormGroup label={collection.name} htmlFor={checkboxId} layout="checkboxAdjacent">
                <input
                  id={checkboxId}
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  disabled={busy}
                  onChange={(event) =>
                    handleToggle(collection.providerCollectionId, event.target.checked)
                  }
                />
              </FormGroup>
            </li>
          );
        })}
      </ul>

      {busy && <StatusMessage>Saving…</StatusMessage>}

      {error && (
        <FieldError spacing="section" roleAlert>
          {error}
        </FieldError>
      )}

      <ModalFooter spaced>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void handleSkip()}>
          Not now
        </Button>
        <Button type="button" disabled={busy || noneSelected} onClick={() => void handleConfirm()}>
          Add to sidebar
        </Button>
      </ModalFooter>
    </Modal>
  );
}
