import { Spinner } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import type { SnippetGitPreview } from '#/shared/snippet/types';
import { snippetScopeLabel } from '#/shared/snippetScope';
import { ScreenshotCarousel } from '#/renderer/src/ui/Plugins/ScreenshotCarousel';
import { PluginReadmeMarkdown } from '#/renderer/src/ui/Plugins/PluginReadmeMarkdown';

interface Props {
  /**
   * Marketplace listing being inspected.
   */
  entry: SnippetCatalogEntry;

  /**
   * Remote git preview for the listing.
   */
  preview: SnippetGitPreview | null;

  /**
   * Whether the remote preview is loading, ready, or failed.
   */
  previewLoadState: 'idle' | 'loading' | 'loaded' | 'error';

  /**
   * Preview fetch error message, if any.
   */
  previewError: string | null;
}

/**
 * Marketplace snippet bundle detail body for detail tabs.
 */
export function SnippetDetailContent({
  entry,
  preview,
  previewLoadState,
  previewError
}: Props): JSX.Element {
  const screenshotSrcs = preview?.screenshotSrcs.length
    ? preview.screenshotSrcs
    : (entry.screenshots ?? []);
  const description =
    preview?.descriptionMarkdown ?? entry.description ?? 'No description available.';

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-[16px] text-muted">
          {entry.author} · v{entry.version}
        </p>
        {screenshotSrcs.length > 0 ? (
          <ScreenshotCarousel variant="tab" images={screenshotSrcs} />
        ) : null}

        <p className="m-0 text-[16px] text-text">{entry.summary}</p>

        <div>
          <h3 className="m-0 mb-2 text-[16px] font-medium text-text">Included snippets</h3>
          <ul className="m-0 list-disc pl-5 text-[16px] text-text">
            {(preview?.snippets ?? entry.snippets).map((snippet) => (
              <li key={`${snippet.name}-${snippet.file}`}>
                {snippet.name} ({snippetScopeLabel(snippet.where)})
              </li>
            ))}
          </ul>
        </div>

        {previewLoadState === 'loading' ? (
          <div className="flex items-center gap-2 text-[16px] text-muted" role="status">
            <Spinner className="h-4 w-4" />
            Loading README…
          </div>
        ) : null}

        {previewError ? <p className="m-0 text-[16px] text-danger">{previewError}</p> : null}

        <PluginReadmeMarkdown content={description} />
      </div>
    </div>
  );
}
