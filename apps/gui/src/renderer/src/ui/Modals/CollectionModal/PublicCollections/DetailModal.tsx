import { useCallback, useEffect, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import {
  apisIoCollectionFormatLabel,
  apisIoCollectionPageUrl,
  detectApisIoCollectionFormat,
  type ApisIoCollection
} from '@harborclient/core/apisio/catalog';
import type { PublicCollectionPreview } from '@harborclient/core/types/api/collections';
import {
  Button,
  FieldError,
  Modal,
  ModalFooter,
  StatusMessage
} from '@harborclient/sdk/components';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { closeCollectionModal } from '#/renderer/src/store/slices/modalsSlice';
import { importPublicCollection } from '#/renderer/src/store/thunks';
import { formatErrorMessage } from '#/renderer/src/ui/Modals/dialogHelpers';

interface Props {
  /**
   * Catalog listing to preview and optionally import.
   */
  item: ApisIoCollection;

  /**
   * Closes the detail modal without importing.
   */
  onClose: () => void;
}

/**
 * Nested modal showing apis.io collection details with an Import action.
 *
 * Remount with a stable `key` when `item` changes so loading state resets without
 * synchronous setState inside the effect.
 */
export function DetailModal({ item, onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [preview, setPreview] = useState<PublicCollectionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fallbackFormat = detectApisIoCollectionFormat(item);
  const pageUrl = apisIoCollectionPageUrl(item);
  const providerLabel = item.provider_name?.trim() || item.provider_slug;

  /**
   * Loads a preview summary (counts and outline) when the detail modal mounts.
   */
  useEffect(() => {
    let cancelled = false;

    void window.api
      .previewPublicCollection(item)
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(formatErrorMessage(err, 'Failed to load collection details'));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [item]);

  /**
   * Imports the public collection into the default data provider and closes both modals.
   */
  const handleImport = useCallback(async (): Promise<void> => {
    setError(null);
    setImporting(true);
    try {
      const collection = await dispatch(importPublicCollection(item)).unwrap();
      if (!collection) {
        return;
      }
      toast.success('Collection imported');
      onClose();
      dispatch(closeCollectionModal());
    } catch (err) {
      setError(formatErrorMessage(err, 'Failed to import collection'));
    } finally {
      setImporting(false);
    }
  }, [dispatch, item, onClose]);

  const formatLabel = preview
    ? apisIoCollectionFormatLabel(preview.format)
    : fallbackFormat
      ? apisIoCollectionFormatLabel(fallbackFormat)
      : item.type;
  const requestCount = preview?.requestCount ?? item.meta?.item_count;
  const folderCount = preview?.folderCount;
  const outline = preview?.outline ?? [];
  const tags = item.tags ?? [];

  return (
    <Modal
      onClose={onClose}
      className="w-[min(40rem,calc(100vw-2rem))]"
      title={item.name}
      labelledBy="public-collection-detail-title"
    >
      <div className="flex flex-col gap-3">
        <p className="m-0 text-[14px] text-muted">
          {providerLabel}
          {' · '}
          {formatLabel}
          {typeof requestCount === 'number'
            ? ` · ${requestCount} ${requestCount === 1 ? 'request' : 'requests'}`
            : ''}
          {typeof folderCount === 'number'
            ? ` · ${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`
            : ''}
        </p>

        {item.description?.trim() ? (
          <p className="m-0 whitespace-pre-wrap text-text">{item.description.trim()}</p>
        ) : null}

        {tags.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label="Tags">
            {tags.map((tag) => (
              <li key={tag} className="rounded bg-control px-1.5 py-0.5 text-[14px] text-muted">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="m-0 text-[14px]">
          <a href={pageUrl} target="_blank" rel="noopener noreferrer" className="text-accent">
            View on apis.io
          </a>
        </p>

        {loading ? (
          <StatusMessage live className="mb-0">
            Loading collection details…
          </StatusMessage>
        ) : null}

        {!loading && outline.length > 0 ? (
          <div>
            <h3 className="m-0 mb-2 text-[15px] font-medium text-text">Requests &amp; Folders</h3>
            <ul className="m-0 max-h-48 list-disc overflow-y-auto pl-5 text-[14px] text-text">
              {outline.map((name, index) => (
                <li key={`${index}-${name}`}>{name}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <FieldError spacing="section" className="mb-0 mt-0">
            {error}
          </FieldError>
        ) : null}
      </div>

      <ModalFooter spaced>
        <Button type="button" variant="secondary" onClick={onClose} disabled={importing}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void handleImport()}
          disabled={loading || importing || Boolean(error && !preview)}
        >
          {importing ? 'Importing…' : 'Import'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
