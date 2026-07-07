import { Button, Modal, ModalFooter, ModalHeader, Spinner } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import type { SnippetGitPreview } from '#/shared/snippet/types';
import { snippetScopeLabel } from '#/shared/snippetScope';
import { ScreenshotCarousel } from '#/renderer/src/ui/Plugins/ScreenshotCarousel';
import { PluginReadmeMarkdown } from '#/renderer/src/ui/Plugins/PluginReadmeMarkdown';

interface Props {
  entry: SnippetCatalogEntry;
  preview: SnippetGitPreview | null;
  previewLoadState: 'idle' | 'loading' | 'loaded' | 'error';
  previewError: string | null;
  actionBusy: boolean;
  onClose: () => void;
  onInstall: () => void;
}

/**
 * Marketplace detail modal for one snippet bundle listing.
 */
export function SnippetDetailModal({
  entry,
  preview,
  previewLoadState,
  previewError,
  actionBusy,
  onClose,
  onInstall
}: Props): JSX.Element {
  const screenshotSrcs = preview?.screenshotSrcs.length
    ? preview.screenshotSrcs
    : (entry.screenshots ?? []);
  const description =
    preview?.descriptionMarkdown ?? entry.description ?? 'No description available.';

  return (
    <Modal
      onClose={onClose}
      className="flex w-[min(46.2rem,calc(100vw-2rem))] max-h-[85vh] flex-col overflow-hidden !p-0"
      labelledBy="snippet-detail-title"
    >
      <ModalHeader titleId="snippet-detail-title" title={entry.name} onClose={onClose} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <p className="m-0 text-[14px] text-muted">
          {entry.author} · v{entry.version}
        </p>
        {screenshotSrcs.length > 0 ? (
          <ScreenshotCarousel variant="modal" images={screenshotSrcs} />
        ) : null}

        <p className="m-0 text-[14px] text-text">{entry.summary}</p>

        <div>
          <h3 className="m-0 mb-2 text-[16px] font-medium text-text">Included snippets</h3>
          <ul className="m-0 list-disc pl-5 text-[14px] text-text">
            {(preview?.snippets ?? entry.snippets).map((snippet) => (
              <li key={`${snippet.name}-${snippet.file}`}>
                {snippet.name} ({snippetScopeLabel(snippet.where)})
              </li>
            ))}
          </ul>
        </div>

        {previewLoadState === 'loading' ? (
          <div className="flex items-center gap-2 text-[14px] text-muted" role="status">
            <Spinner className="h-4 w-4" />
            Loading README…
          </div>
        ) : null}

        {previewError ? <p className="m-0 text-[14px] text-danger">{previewError}</p> : null}

        <PluginReadmeMarkdown content={description} />
      </div>
      <ModalFooter className="shrink-0 border-t border-separator bg-surface px-4 pb-4 pt-4 shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.12)]">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button type="button" disabled={actionBusy} onClick={onInstall}>
          {actionBusy ? 'Installing…' : 'Install'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
