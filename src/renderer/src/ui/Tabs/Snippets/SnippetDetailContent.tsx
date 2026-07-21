import { CatalogReadmeMarkdown, ScreenshotCarousel, Spinner } from '@harborclient/sdk/components';
import { useMemo, type JSX } from 'react';
import type { SnippetCatalogEntry } from '#/shared/snippet/catalog';
import type { SnippetGitPreview } from '#/shared/snippet/types';
import { resolveCatalogScreenshotUrls } from '#/shared/plugin/githubRaw';
import { stripPluginScreenshotImagesFromMarkdown } from '#/shared/plugin/stripPluginScreenshotImagesFromMarkdown';
import { snippetScopeLabel } from '#/shared/snippetScope';
import { scriptStageLabel } from '#/shared/scriptStage';

const SCREENSHOT_FALLBACK_PATH = 'screenshot.png';

/**
 * Collects catalog screenshot paths used to dedupe README images.
 *
 * @param entry - Marketplace listing being inspected.
 * @param screenshotSrcs - Resolved carousel URLs when a preview is shown.
 * @returns Manifest-relative paths and catalog URLs that match README image targets.
 */
function collectSnippetScreenshotImageRefs(
  entry: SnippetCatalogEntry,
  screenshotSrcs: string[]
): string[] {
  const refs: string[] = [];

  if (entry.screenshots?.length) {
    refs.push(...entry.screenshots);
  }
  if (entry.screenshot) {
    refs.push(entry.screenshot);
  }

  if (refs.length === 0 && screenshotSrcs.length > 0) {
    refs.push(SCREENSHOT_FALLBACK_PATH);
  }

  return refs;
}

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
  /**
   * Resolves carousel screenshot URLs from git preview or catalog listing.
   * Relative catalog paths are resolved against the listing's repoUrl and ref.
   */
  const screenshotSrcs = useMemo(
    () =>
      preview?.screenshotSrcs.length
        ? preview.screenshotSrcs
        : resolveCatalogScreenshotUrls(
            entry.repoUrl,
            entry.ref,
            entry.screenshots,
            entry.screenshot
          ),
    [preview, entry.repoUrl, entry.ref, entry.screenshots, entry.screenshot]
  );
  const descriptionMarkdown =
    preview?.descriptionMarkdown ?? entry.description ?? 'No description available.';

  /**
   * Removes screenshot images from the description body when the carousel already shows them.
   */
  const displayDescriptionMarkdown = useMemo(() => {
    const screenshotRefs = collectSnippetScreenshotImageRefs(entry, screenshotSrcs);
    return stripPluginScreenshotImagesFromMarkdown(descriptionMarkdown, screenshotRefs);
  }, [descriptionMarkdown, entry, screenshotSrcs]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4">
        <p className="m-0 text-muted">
          {entry.author} · v{entry.version}
        </p>
        {screenshotSrcs.length > 0 ? (
          <ScreenshotCarousel
            variant="tab"
            images={screenshotSrcs}
            ariaLabel="Snippet screenshots"
            lightboxLabel="Snippet screenshot preview"
          />
        ) : null}

        <p className="m-0 text-text">{entry.summary}</p>

        <div>
          <h3 className="m-0 mb-2 font-medium text-text">Included snippets</h3>
          <ul className="m-0 list-disc pl-5 text-text">
            {(preview?.snippets ?? entry.snippets).map((snippet) => (
              <li key={`${snippet.name}-${snippet.file}`}>
                {snippet.name} ({snippetScopeLabel(snippet.phase)} ·{' '}
                {scriptStageLabel(snippet['stage'])})
              </li>
            ))}
          </ul>
        </div>

        {previewLoadState === 'loading' ? (
          <div className="flex items-center gap-2 text-muted" role="status">
            <Spinner className="h-4 w-4" />
            Loading README…
          </div>
        ) : null}

        {previewError ? <p className="m-0 text-danger">{previewError}</p> : null}

        <CatalogReadmeMarkdown content={displayDescriptionMarkdown} />
      </div>
    </div>
  );
}
