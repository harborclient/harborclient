import { Button, FaIcon, Page } from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { PageRef } from '#/renderer/src/store/tabs';
import { faCopy, faDownload, faImage } from '#/renderer/src/fontawesome';
import { imageViewLocation } from '#/renderer/src/ui/Tabs/ImageView/imageViewHelpers';
import { ImageViewContent } from '#/renderer/src/ui/Tabs/ImageView/ImageViewContent';
import { saveImageViewPage } from '#/renderer/src/ui/Tabs/ImageView/saveImageViewPage';

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
      await saveImageViewPage(page);
    } catch {
      // saveImageViewPage reports errors via toast.
    } finally {
      setDownloading(false);
    }
  }, [downloading, page]);

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
      <ImageViewContent
        loading={loading}
        error={error}
        resolvedSrc={resolvedSrc}
        fileName={page.fileName}
        saving={downloading}
        onSave={() => void handleDownload()}
      />
    </Page>
  );
}
