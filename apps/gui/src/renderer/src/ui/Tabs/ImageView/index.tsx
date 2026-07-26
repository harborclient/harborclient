import { Button, FaIcon, Page } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { PageRef } from '#/renderer/src/store/tabs';
import { faCopy, faDownload, faImage } from '#/renderer/src/fontawesome';
import { imageViewLocation } from '#/renderer/src/ui/Tabs/ImageView/imageViewHelpers';

interface Props {
  /**
   * Active image-view page tab identity.
   */
  page: Extract<PageRef, { type: 'image-view' }>;
}

/**
 * Resolves an immediate display URL for non-path image sources.
 *
 * @param source - Image source from the page tab.
 * @returns URL string for url/data sources, otherwise null.
 */
function immediateSrc(source: Extract<PageRef, { type: 'image-view' }>['source']): string | null {
  if (source.kind === 'url') {
    return source.url;
  }
  if (source.kind === 'data') {
    return source.dataUrl;
  }
  return null;
}

/**
 * Full-page image viewer with copy-location and download header actions.
 */
export function ImageViewPage({ page }: Props): JSX.Element {
  const immediate = useMemo(() => immediateSrc(page.source), [page.source]);
  const pathKey = page.source.kind === 'path' ? page.source.path : '';
  const [pathSrc, setPathSrc] = useState<string | null>(null);
  const [loadedPathKey, setLoadedPathKey] = useState('');
  const [pathError, setPathError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  /**
   * Clipboard / download location string for the current source.
   */
  const location = useMemo(() => imageViewLocation(page.source), [page.source]);

  /**
   * Loads a local file path into a data URL when the tab opens or the path changes.
   */
  useEffect(() => {
    if (page.source.kind !== 'path') {
      return;
    }

    const path = page.source.path;
    let cancelled = false;

    void window.api
      .readImageDataUrl(path)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setPathSrc(result.dataUrl);
        setPathError(null);
        setLoadedPathKey(path);
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setPathSrc(null);
        setPathError(message);
        setLoadedPathKey(path);
      });

    return () => {
      cancelled = true;
    };
  }, [page.source]);

  /**
   * Effective image URL shown in the viewer.
   */
  const resolvedSrc = immediate ?? (loadedPathKey === pathKey ? pathSrc : null);
  const loading = page.source.kind === 'path' && loadedPathKey !== pathKey;
  const error = page.source.kind === 'path' && loadedPathKey === pathKey ? pathError : null;

  /**
   * Copies the image path, URL, or data URL to the clipboard.
   */
  const handleCopyLocation = useCallback((): void => {
    void navigator.clipboard.writeText(location).then(
      () => {
        toast.success('Location copied');
      },
      () => {
        toast.error('Failed to copy location');
      }
    );
  }, [location]);

  /**
   * Saves the image to a user-chosen destination via a native save dialog.
   */
  const handleDownload = useCallback(async (): Promise<void> => {
    if (downloading) {
      return;
    }

    setDownloading(true);
    try {
      let result: { canceled: boolean; path?: string };
      if (page.source.kind === 'path') {
        result = await window.api.copyFileToSaveDialog(page.source.path, page.fileName);
      } else if (page.source.kind === 'url') {
        result = await window.api.saveDataUrlToFile({
          url: page.source.url,
          defaultFileName: page.fileName
        });
      } else {
        result = await window.api.saveDataUrlToFile({
          dataUrl: page.source.dataUrl,
          defaultFileName: page.fileName
        });
      }

      if (!result.canceled) {
        toast.success('Image saved');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message);
    } finally {
      setDownloading(false);
    }
  }, [downloading, page.fileName, page.source]);

  return (
    <Page
      embedded
      title={page.fileName}
      icon={faImage}
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0!"
      actions={
        <>
          <Button
            type="button"
            variant="toolbar"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            onClick={handleCopyLocation}
          >
            <FaIcon icon={faCopy} className="h-3.5 w-3.5" />
            Copy location
          </Button>
          <Button
            type="button"
            variant="toolbar"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            disabled={downloading || loading || error != null}
            onClick={() => void handleDownload()}
          >
            <FaIcon icon={faDownload} className="h-3.5 w-3.5" />
            {downloading ? 'Downloading…' : 'Download'}
          </Button>
        </>
      }
    >
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
        {loading ? (
          <p className="m-0 text-muted" role="status">
            Loading image…
          </p>
        ) : error != null ? (
          <p className="m-0 text-danger" role="alert">
            {error}
          </p>
        ) : resolvedSrc != null ? (
          <img
            src={resolvedSrc}
            alt={page.fileName}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="m-0 text-muted" role="status">
            Image preview is unavailable.
          </p>
        )}
      </div>
    </Page>
  );
}
