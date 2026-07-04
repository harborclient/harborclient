import {
  Badge,
  Button,
  FaIcon,
  Modal,
  ModalFooter,
  ModalHeader,
  Spinner
} from '@harborclient/sdk/components';
import { faBug, faGlobe } from '#/renderer/src/fontawesome';
import { useMemo, type JSX } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import { stripPluginScreenshotImagesFromMarkdown } from '#/shared/plugin/stripPluginScreenshotImagesFromMarkdown';
import type {
  PluginGitPreview,
  PluginInfo,
  PluginManifest,
  PluginScreenshot
} from '#/shared/plugin/types';

import { PERMISSION_DESCRIPTIONS, PERMISSION_NAMES, type PluginManagementKind } from './constants';
import { installedPluginInstallationLabel } from './helpers';
import { VerifiedPublisherBadge } from '#/renderer/src/ui/shared/VerifiedPublisherBadge';
import { ErrorMessages } from './ErrorMessages';
import { InstalledPluginFooterActions } from './InstalledPluginFooterActions';
import { PluginReadmeMarkdown } from './PluginReadmeMarkdown';
import { ScreenshotCarousel } from './ScreenshotCarousel';

interface InstalledProps {
  /**
   * Read-only detail view for an installed plugin row.
   */
  mode: 'installed';

  /**
   * Installed plugin metadata and runtime state.
   */
  plugin: PluginInfo;

  /**
   * Loaded Markdown description body.
   */
  descriptionMarkdown: string;

  /**
   * Whether the description asset is loading, ready, or failed.
   */
  descriptionLoadState: 'idle' | 'loading' | 'loaded' | 'error';

  /**
   * Screenshot URLs or data URLs when available.
   */
  screenshotSrcs?: string[];
}

interface CatalogProps {
  /**
   * Marketplace preview for a plugin that is not installed yet.
   */
  mode: 'catalog';

  /**
   * Marketplace listing being inspected.
   */
  entry: PluginCatalogEntry;

  /**
   * Remote manifest preview fetched from the plugin repository.
   */
  preview: PluginGitPreview | null;

  /**
   * Whether the remote preview is loading, ready, or failed.
   */
  previewLoadState: 'idle' | 'loading' | 'loaded' | 'error';

  /**
   * Error message when the remote preview could not be loaded.
   */
  previewError: string | null;

  /**
   * Screenshot URLs or data URLs when available.
   */
  screenshotSrcs?: string[];

  /**
   * Installed plugin row when this catalog id is already present.
   */
  installed: PluginInfo | undefined;

  /**
   * Whether an install or update action is in progress for this listing.
   */
  actionBusy: boolean;

  /**
   * Installs the plugin from its git repository URL.
   */
  onInstall: () => void;
}

interface InstalledActionProps {
  /**
   * Whether this screen shows plugins or themes for footer copy.
   */
  kind: PluginManagementKind;

  /**
   * Whether a git update is in progress for the open plugin.
   */
  gitUpdateBusy: boolean;

  /**
   * Toggles enablement for the open plugin.
   */
  onToggleEnabled: (plugin: PluginInfo) => void;

  /**
   * Reloads an unpacked plugin from disk.
   */
  onReload: (plugin: PluginInfo) => void;

  /**
   * Re-clones a git-installed plugin from its stored origin.
   */
  onUpdateFromGit: (pluginId: string) => void;

  /**
   * Removes or uninstalls the open plugin after confirmation.
   */
  onRemove: (plugin: PluginInfo) => void;
}

type Props = (InstalledProps | CatalogProps) &
  InstalledActionProps & {
    /**
     * Closes the detail dialog.
     */
    onClose: () => void;
  };

const SCREENSHOT_FALLBACK_PATH = 'screenshot.png';

/**
 * Returns the repository-relative path from a manifest screenshot entry.
 *
 * @param screenshot - Manifest screenshot string or object.
 */
function screenshotRelativePath(screenshot: PluginScreenshot): string {
  return typeof screenshot === 'string' ? screenshot : screenshot.path;
}

/**
 * Collects manifest and catalog screenshot paths used to dedupe README images.
 *
 * @param manifest - Parsed plugin manifest when available.
 * @param entry - Marketplace listing when the modal is in catalog mode.
 * @param screenshotSrcs - Resolved carousel URLs when a preview is shown.
 */
function collectPluginScreenshotImageRefs(
  manifest: PluginManifest | undefined,
  entry: PluginCatalogEntry | undefined,
  screenshotSrcs: string[] | undefined
): string[] {
  const refs: string[] = [];

  for (const screenshot of manifest?.screenshots ?? []) {
    refs.push(screenshotRelativePath(screenshot));
  }

  if (entry?.screenshots?.length) {
    refs.push(...entry.screenshots);
  }
  if (entry?.screenshot) {
    refs.push(entry.screenshot);
  }

  if (refs.length === 0 && screenshotSrcs && screenshotSrcs.length > 0) {
    refs.push(SCREENSHOT_FALLBACK_PATH);
  }

  return refs;
}

/**
 * Returns manifest fields used by both installed and catalog detail views.
 *
 * @param manifest - Parsed plugin manifest.
 * @param fallbackAuthor - Catalog author when manifest omits author.
 */
function manifestDetails(
  manifest: PluginManifest,
  fallbackAuthor?: string
): {
  author: string;
  homepage?: string;
  bugsUrl?: string;
  permissions: PluginManifest['permissions'];
  hasDescription: boolean;
} {
  return {
    author: manifest.author ?? fallbackAuthor ?? '—',
    homepage: manifest.homepage,
    bugsUrl: manifest.bugs?.url,
    permissions: manifest.permissions,
    hasDescription: Boolean(manifest.description)
  };
}

/**
 * Resolves marketplace description Markdown, preferring the catalog payload
 * over a live git preview fetch.
 *
 * @param entry - Marketplace listing when the modal is in catalog mode.
 * @param preview - Remote preview payload when manifest fetch succeeded.
 * @returns Description body suitable for {@link PluginReadmeMarkdown}.
 */
function resolveCatalogDescriptionMarkdown(
  entry: PluginCatalogEntry | undefined,
  preview: PluginGitPreview | null
): string {
  if (entry?.description) {
    return entry.description;
  }

  return preview?.descriptionMarkdown ?? '';
}

/**
 * Read-only plugin detail modal shared by installed plugins and marketplace previews.
 */
export function PluginDetailModal(props: Props): JSX.Element {
  const { onClose } = props;
  const isInstalled = props.mode === 'installed';
  const plugin = isInstalled ? props.plugin : props.installed;
  const manifest = isInstalled ? props.plugin.manifest : props.preview?.manifest;
  const entry = props.mode === 'catalog' ? props.entry : undefined;
  const title = isInstalled ? props.plugin.name : (entry?.name ?? 'Plugin');
  const summary = entry?.summary ?? manifest?.summary;
  const version = isInstalled
    ? props.plugin.version
    : (plugin?.version ?? entry?.version ?? props.preview?.manifest.version ?? '—');
  const repoUrl = isInstalled ? props.plugin.repoUrl : entry?.repoUrl;
  const repoRef = isInstalled ? props.plugin.repoRef : entry?.ref;
  const screenshotSrcs = props.screenshotSrcs;
  const details = manifest
    ? manifestDetails(manifest, entry?.author)
    : entry
      ? {
          author: entry.author,
          homepage: entry.homepage,
          bugsUrl: undefined,
          permissions: [] as PluginManifest['permissions'],
          hasDescription: Boolean(entry.description)
        }
      : null;
  const descriptionMarkdown = isInstalled
    ? props.descriptionMarkdown
    : resolveCatalogDescriptionMarkdown(entry, props.mode === 'catalog' ? props.preview : null);

  /**
   * Removes screenshot images from the description body when the carousel already shows them.
   */
  const displayDescriptionMarkdown = useMemo(() => {
    const screenshotRefs = collectPluginScreenshotImageRefs(manifest, entry, screenshotSrcs);
    return stripPluginScreenshotImagesFromMarkdown(descriptionMarkdown, screenshotRefs);
  }, [descriptionMarkdown, entry, manifest, screenshotSrcs]);

  const descriptionLoadState = isInstalled
    ? props.descriptionLoadState
    : entry?.description
      ? 'loaded'
      : props.previewLoadState === 'loading'
        ? 'loading'
        : props.previewLoadState === 'error'
          ? 'error'
          : props.previewLoadState === 'loaded' && descriptionMarkdown
            ? 'loaded'
            : props.previewLoadState === 'loaded' && details?.hasDescription
              ? 'error'
              : 'idle';
  const showDescriptionSection = isInstalled
    ? Boolean(props.plugin.manifest.description) ||
      descriptionMarkdown.length > 0 ||
      descriptionLoadState === 'loading' ||
      descriptionLoadState === 'error'
    : Boolean(entry?.description) ||
      props.previewLoadState === 'loading' ||
      Boolean(details?.hasDescription) ||
      descriptionMarkdown.length > 0 ||
      (descriptionLoadState === 'error' && Boolean(details?.hasDescription));
  const closeDisabled = (props.mode === 'catalog' && props.actionBusy) || props.gitUpdateBusy;

  const detailBody = (
    <>
      {screenshotSrcs && screenshotSrcs.length > 0 ? (
        <ScreenshotCarousel variant="modal" images={screenshotSrcs} />
      ) : null}

      {props.mode === 'catalog' && props.previewError ? (
        <p className="m-0 mb-4 text-[16px] text-danger" role="alert">
          {props.previewError}
        </p>
      ) : null}

      {summary ? <p className="m-0 mb-2 text-[16px] text-text">{summary}</p> : null}
      {details?.homepage && details?.bugsUrl ? (
        <>
          <div className="mt-4 border-t border-separator pt-4"></div>
          <div className="mb-2 flex flex-wrap gap-3 text-[16px]">
            {details?.homepage ? (
              <a
                href={details.homepage}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-accent"
              >
                <FaIcon icon={faGlobe} className="h-3.5 w-3.5" aria-hidden />
                Website
              </a>
            ) : null}
            {details?.bugsUrl ? (
              <a
                href={details.bugsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-accent"
              >
                <FaIcon icon={faBug} className="h-3.5 w-3.5" aria-hidden />
                Report issue
              </a>
            ) : null}
          </div>
        </>
      ) : null}

      <div className="mt-4 border-t border-separator pt-4"></div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[16px]">
        <dt className="text-muted">Version</dt>
        <dd className="m-0 text-text">{version}</dd>
        <dt className="text-muted">Publisher</dt>
        <dd className="m-0 text-text">
          <span className="inline-flex items-center gap-1.5">
            {details?.author ?? '—'}
            {isInstalled && props.plugin.signature?.status === 'verified' ? (
              <VerifiedPublisherBadge />
            ) : null}
          </span>
        </dd>
        {isInstalled ? (
          <>
            <dt className="text-muted">Installation</dt>
            <dd className="m-0 text-text">
              {installedPluginInstallationLabel(props.plugin.source)}
            </dd>
          </>
        ) : null}
        {isInstalled && props.plugin.source === 'unpacked' ? (
          <>
            <dt className="text-muted">Source</dt>
            <dd className="m-0 break-all text-text">{props.plugin.path}</dd>
          </>
        ) : null}
        {repoUrl ? (
          <>
            <dt className="text-muted">Repository</dt>
            <dd className="m-0 break-all text-text">
              <a href={repoUrl} target="_blank" rel="noreferrer" className="text-accent">
                {repoUrl}
              </a>
              {repoRef ? <span className="text-muted">{` (${repoRef})`}</span> : null}
            </dd>
          </>
        ) : null}
      </dl>

      {isInstalled ? <ErrorMessages plugin={props.plugin} /> : null}

      {details && details.permissions.length > 0 ? (
        <div className="mt-4 border-t border-separator pt-4">
          <h3 className="m-0 mb-2 text-[16px] font-medium text-text">Permissions</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {details.permissions.map((permission) => (
              <li key={permission} className="flex items-start gap-2 text-[16px] text-text">
                <Badge variant="warning" className="shrink-0">
                  {PERMISSION_NAMES[permission] ?? permission}
                </Badge>
                <span>{PERMISSION_DESCRIPTIONS[permission] ?? ''}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : props.mode === 'catalog' &&
        props.previewLoadState === 'loaded' &&
        !details?.permissions.length ? (
        <div className="mt-4 border-t border-separator pt-4">
          <h3 className="m-0 mb-2 text-[16px] font-medium text-text">Permissions</h3>
          <p className="m-0 text-[16px] text-muted">No permissions declared.</p>
        </div>
      ) : null}

      {showDescriptionSection ? (
        <div className="mt-4 border-t border-separator border-t-2 pt-4">
          {descriptionLoadState === 'loading' ? (
            <div
              className="flex items-center gap-2 text-[16px] text-muted"
              role="status"
              aria-label="Loading description"
            >
              <span aria-hidden="true">
                <Spinner size="sm" />
              </span>
              <span>Loading description…</span>
            </div>
          ) : descriptionLoadState === 'error' ? (
            <p className="m-0 text-[16px] text-danger" role="alert">
              Could not load the plugin description.
            </p>
          ) : displayDescriptionMarkdown ? (
            <PluginReadmeMarkdown content={displayDescriptionMarkdown} />
          ) : null}
        </div>
      ) : null}
    </>
  );

  const installedPlugin = isInstalled ? props.plugin : props.installed;

  const footerContent = installedPlugin ? (
    <InstalledPluginFooterActions
      kind={props.kind}
      plugin={installedPlugin}
      gitUpdateBusy={props.gitUpdateBusy}
      onToggleEnabled={props.onToggleEnabled}
      onReload={props.onReload}
      onUpdateFromGit={props.onUpdateFromGit}
      onRemove={props.onRemove}
    />
  ) : props.mode === 'catalog' ? (
    <Button
      type="button"
      disabled={props.actionBusy}
      aria-label={`Install ${props.entry.name}`}
      onClick={props.onInstall}
    >
      {props.actionBusy ? 'Installing…' : 'Install'}
    </Button>
  ) : null;

  return (
    <Modal
      onClose={onClose}
      className="flex w-[min(46.2rem,calc(100vw-2rem))] max-h-[85vh] flex-col overflow-hidden !p-0"
      labelledBy="plugin-detail-title"
      disableEscape={closeDisabled}
    >
      <ModalHeader
        titleId="plugin-detail-title"
        title={title}
        closeDisabled={closeDisabled}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{detailBody}</div>
      <ModalFooter className="shrink-0 border-t border-separator bg-surface px-4 pb-4 pt-4 shadow-[0_-8px_16px_-8px_rgba(0,0,0,0.12)]">
        <div className="flex flex-wrap gap-2">{footerContent}</div>
      </ModalFooter>
    </Modal>
  );
}
