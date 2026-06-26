import { useCallback, useEffect, useMemo, useState, type JSX, type KeyboardEvent } from 'react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type {
  PluginCatalog,
  PluginCatalogEntry,
  PluginSource,
  PluginSourcesSettings
} from '#/shared/plugin/catalog';
import {
  getDefaultPluginSources,
  isHarborClientEndpoint,
  pluginSourcesSchema
} from '#/shared/plugin/catalog';
import { buildPluginCatalogSearchIndex, searchPluginCatalog } from '#/shared/plugin/catalogSearch';
import type { PluginInfo, PluginPermission } from '#/shared/plugin/types';
import type { TeamHubPluginSource, TeamHubPluginSourcesView } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { Input } from '#/renderer/src/components/forms';
import { Modal } from '#/renderer/src/components/Modal';
import { PageHeader } from '#/renderer/src/components/PageHeader';
import {
  faAngleLeft,
  faCircleCheck,
  faDownload,
  faGear,
  faPuzzlePiece,
  faStore
} from '#/renderer/src/fontawesome';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import {
  showAlert,
  showConfirm,
  formatIpcErrorMessage
} from '#/renderer/src/ui/modals/dialogHelpers';

const PERMISSION_LABELS: Record<PluginPermission, string> = {
  ui: 'UI contributions (settings, themes, toasts, commands)',
  storage: 'Plugin-scoped persistent storage',
  'filesystem:pick': 'Open/save dialogs for user-selected paths',
  'filesystem:read': 'Read from allowlisted filesystem paths',
  'filesystem:write': 'Write to allowlisted filesystem paths',
  http: 'HTTP request hooks in the main process',
  ipc: 'Custom IPC between renderer and main plugin halves'
};

interface PluginErrorMessagesProps {
  /**
   * Plugin whose manifest or runtime errors should be shown.
   */
  plugin: PluginInfo;
}

/**
 * Renders manifest load errors and runtime activation/hook failures for one plugin.
 */
function PluginErrorMessages({ plugin }: PluginErrorMessagesProps): JSX.Element | null {
  if (!plugin.error && !plugin.runtimeError) {
    return null;
  }

  return (
    <div className="mt-1 space-y-1">
      {plugin.error ? (
        <p className="m-0 text-[14px] text-danger" role="alert">
          <span className="font-medium">Load error:</span> {plugin.error}
        </p>
      ) : null}
      {plugin.runtimeError ? (
        <p className="m-0 text-[14px] text-danger" role="alert">
          <span className="font-medium">Runtime error:</span> {plugin.runtimeError}
        </p>
      ) : null}
    </div>
  );
}

interface PluginDetailModalProps {
  /**
   * Plugin whose read-only metadata and description are shown.
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
   * Closes the detail dialog.
   */
  onClose: () => void;
}

/**
 * Read-only modal showing installed plugin metadata, permissions, and description.
 */
function PluginDetailModal({
  plugin,
  descriptionMarkdown,
  descriptionLoadState,
  onClose
}: PluginDetailModalProps): JSX.Element {
  return (
    <Modal
      onClose={onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
      labelledBy="plugin-detail-title"
    >
      <h2
        id="plugin-detail-title"
        className="m-0 mb-3 flex flex-wrap items-center gap-2 text-[15px] font-semibold text-text"
      >
        {plugin.name}
        {plugin.signature?.status === 'verified' ? (
          <FaIcon
            icon={faCircleCheck}
            className="h-3.5 w-3.5 shrink-0 text-success"
            title={`Verified publisher: ${plugin.signature.author ?? plugin.manifest.author ?? 'unknown'}`}
          />
        ) : null}
      </h2>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
        <dt className="text-muted">Version</dt>
        <dd className="m-0 text-text">{plugin.version}</dd>
        <dt className="text-muted">Publisher</dt>
        <dd className="m-0 text-text">{plugin.manifest.author ?? '—'}</dd>
        <dt className="text-muted">Source</dt>
        <dd className="m-0 break-all text-text">{plugin.path}</dd>
        {plugin.repoUrl ? (
          <>
            <dt className="text-muted">Repository</dt>
            <dd className="m-0 break-all text-text">
              <a href={plugin.repoUrl} target="_blank" rel="noreferrer" className="text-accent">
                {plugin.repoUrl}
              </a>
              {plugin.repoRef ? <span className="text-muted">{` (${plugin.repoRef})`}</span> : null}
            </dd>
          </>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap gap-3 text-[14px]">
        {plugin.manifest.homepage ? (
          <a
            href={plugin.manifest.homepage}
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            Website
          </a>
        ) : null}
        {plugin.manifest.bugs?.url ? (
          <a
            href={plugin.manifest.bugs.url}
            target="_blank"
            rel="noreferrer"
            className="text-accent"
          >
            Report issue
          </a>
        ) : null}
      </div>

      <PluginErrorMessages plugin={plugin} />

      <div className="mt-4 border-t border-separator pt-4">
        <h3 className="m-0 mb-2 text-[14px] font-medium text-text">Permissions</h3>
        <ul className="m-0 list-disc pl-5 text-[14px] text-text">
          {plugin.permissions.map((permission) => (
            <li key={permission}>{PERMISSION_LABELS[permission] ?? permission}</li>
          ))}
        </ul>
      </div>

      {plugin.manifest.description ? (
        <div className="prose prose-base mt-4 max-h-[min(28rem,50vh)] max-w-none overflow-y-auto border-t border-separator pt-4 text-text">
          {descriptionLoadState === 'loading' ? (
            <p className="text-muted" role="status">
              Loading description…
            </p>
          ) : descriptionLoadState === 'error' ? (
            <p className="text-danger" role="alert">
              Could not load the plugin description.
            </p>
          ) : descriptionMarkdown ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{descriptionMarkdown}</ReactMarkdown>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}

/**
 * Returns whether a plugin is installed under userData (file or git), not dev-unpacked.
 *
 * @param plugin - Plugin metadata row.
 */
function isManagedInstall(plugin: PluginInfo): boolean {
  return plugin.source === 'installed' || plugin.source === 'git';
}

/**
 * Returns the installed plugin row matching a catalog entry id, if any.
 *
 * @param plugins - Installed plugin rows from the main process.
 * @param entryId - Catalog manifest id.
 */
function findInstalledCatalogPlugin(
  plugins: PluginInfo[],
  entryId: string
): PluginInfo | undefined {
  return plugins.find((plugin) => plugin.id === entryId);
}

/**
 * Stops row-level click handlers from firing when interacting with row action buttons.
 *
 * @param event - DOM event from an action control inside a table row.
 */
function stopRowActivation(event: { stopPropagation(): void }): void {
  event.stopPropagation();
}

interface PluginTableExternalLinkProps {
  /**
   * Destination URL opened in the system browser.
   */
  href: string;

  /**
   * Visible link text shown in the table cell.
   */
  label: string;

  /**
   * Plugin display name used in the accessible link label.
   */
  pluginName: string;
}

/**
 * External link in a plugin table row that does not activate the row click handler.
 */
function PluginTableExternalLink({
  href,
  label,
  pluginName
}: PluginTableExternalLinkProps): JSX.Element {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-accent"
      aria-label={`${label} for ${pluginName}`}
      onClick={stopRowActivation}
      onMouseDown={stopRowActivation}
    >
      {label}
    </a>
  );
}

interface PluginCatalogCardProps {
  /**
   * Marketplace listing rendered in the browse grid.
   */
  entry: PluginCatalogEntry;

  /**
   * Opens the catalog detail modal for this listing.
   */
  onOpen: () => void;
}

/**
 * Compact marketplace preview card; opens the detail modal on activation.
 */
function PluginCatalogCard({ entry, onOpen }: PluginCatalogCardProps): JSX.Element {
  /**
   * Opens the detail modal when the card is activated from the keyboard.
   *
   * @param event - Keyboard event on the card.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <li
      tabIndex={0}
      className="flex h-full min-w-0 cursor-pointer flex-col overflow-hidden rounded-md border border-separator bg-control hover:bg-selection/40"
      aria-label={`View details for ${entry.name}`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      {entry.screenshot ? (
        <img
          src={entry.screenshot}
          alt=""
          className="aspect-video w-full border-b border-separator object-cover object-top"
        />
      ) : (
        <div
          className="flex aspect-video w-full items-center justify-center border-b border-separator bg-panel text-[14px] text-muted"
          aria-hidden
        >
          No preview
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="m-0 truncate text-[14px] font-semibold text-text">{entry.name}</h3>
        <p className="m-0 line-clamp-3 text-[14px] text-text">{entry.summary}</p>
        <p className="m-0 text-[14px] text-muted">{entry.version}</p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
          {entry.categories.map((category) => (
            <span key={category} className="rounded bg-accent/15 px-2 py-0.5 text-[14px] text-text">
              {category}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

interface PluginCatalogDetailModalProps {
  /**
   * Marketplace listing shown in the detail dialog.
   */
  entry: PluginCatalogEntry;

  /**
   * Installed plugin row when this catalog id is already present.
   */
  installed: PluginInfo | undefined;

  /**
   * Whether an install or update action is in progress for this listing.
   */
  actionBusy: boolean;

  /**
   * Closes the detail dialog.
   */
  onClose: () => void;

  /**
   * Installs the plugin from its git repository URL.
   */
  onInstall: () => void;

  /**
   * Re-clones an installed git plugin from its stored origin.
   */
  onUpdate: () => void;
}

/**
 * Marketplace detail dialog with catalog metadata and install actions.
 */
function PluginCatalogDetailModal({
  entry,
  installed,
  actionBusy,
  onClose,
  onInstall,
  onUpdate
}: PluginCatalogDetailModalProps): JSX.Element {
  const displayVersion = installed?.version ?? entry.version;

  return (
    <Modal
      onClose={onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
      labelledBy="plugin-catalog-detail-title"
    >
      <h2 id="plugin-catalog-detail-title" className="m-0 mb-3 text-[15px] font-semibold text-text">
        {entry.name}
      </h2>

      {entry.screenshot ? (
        <img
          src={entry.screenshot}
          alt=""
          className="mb-4 aspect-video w-full rounded-md border border-separator object-cover object-top"
        />
      ) : null}

      <p className="m-0 mb-4 text-[14px] text-text">{entry.summary}</p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[14px]">
        <dt className="text-muted">Publisher</dt>
        <dd className="m-0 text-text">{entry.author}</dd>
        <dt className="text-muted">Version</dt>
        <dd className="m-0 text-text">{displayVersion}</dd>
        <dt className="text-muted">Plugin id</dt>
        <dd className="m-0 break-all text-text">{entry.id}</dd>
        {entry.ref ? (
          <>
            <dt className="text-muted">Git ref</dt>
            <dd className="m-0 text-text">{entry.ref}</dd>
          </>
        ) : null}
        {entry.minAppVersion ? (
          <>
            <dt className="text-muted">Minimum app version</dt>
            <dd className="m-0 text-text">{entry.minAppVersion}</dd>
          </>
        ) : null}
      </dl>

      <div className="mt-3 flex flex-wrap gap-2">
        {entry.categories.map((category) => (
          <span key={category} className="rounded bg-accent/15 px-2 py-0.5 text-[14px] text-text">
            {category}
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[14px]">
        <a href={entry.repoUrl} target="_blank" rel="noreferrer" className="text-accent">
          View on GitHub
        </a>
        {entry.homepage ? (
          <a href={entry.homepage} target="_blank" rel="noreferrer" className="text-accent">
            Website
          </a>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        {installed ? (
          installed.source === 'git' ? (
            <Button
              type="button"
              disabled={actionBusy}
              aria-label={`Update ${entry.name}`}
              onClick={onUpdate}
            >
              {actionBusy ? 'Updating…' : 'Update'}
            </Button>
          ) : (
            <Button type="button" disabled aria-label={`${entry.name} is installed`}>
              Installed
            </Button>
          )
        ) : (
          <Button
            type="button"
            disabled={actionBusy}
            aria-label={`Install ${entry.name}`}
            onClick={onInstall}
          >
            {actionBusy ? 'Installing…' : 'Install'}
          </Button>
        )}
      </div>
    </Modal>
  );
}

type PluginSourceKind = 'catalogs' | 'trusted';

interface PluginInstallModalProps {
  /**
   * Closes the install chooser without starting an install flow.
   */
  onClose: () => void;

  /**
   * Starts the install-from-file flow (native file picker).
   */
  onInstallFromFile: () => void;

  /**
   * Opens the install-from-git form modal.
   */
  onInstallFromGit: () => void;

  /**
   * Starts the load-unpacked flow (native folder picker).
   */
  onLoadUnpacked: () => void;
}

/**
 * Chooser modal listing the three ways to add a plugin to HarborClient.
 */
function PluginInstallModal({
  onClose,
  onInstallFromFile,
  onInstallFromGit,
  onLoadUnpacked
}: PluginInstallModalProps): JSX.Element {
  return (
    <Modal onClose={onClose} labelledBy="plugin-install-title">
      <h2 id="plugin-install-title" className="m-0 mb-2 text-[15px] font-semibold text-text">
        Install plugin
      </h2>
      <p className="mb-4 text-[14px] text-muted">
        Choose how you want to add a plugin to HarborClient.
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <Button type="button" variant="secondary" className="w-full" onClick={onInstallFromFile}>
            Install from file
          </Button>
          <p className="mt-1 text-[14px] text-muted">
            Select a <code className="text-text">.hcp</code> plugin package.
          </p>
        </div>
        <div>
          <Button type="button" variant="secondary" className="w-full" onClick={onInstallFromGit}>
            Install from Git…
          </Button>
          <p className="mt-1 text-[14px] text-muted">
            Clone a public repository that ships a built manifest and entry files.
          </p>
        </div>
        <div>
          <Button type="button" variant="secondary" className="w-full" onClick={onLoadUnpacked}>
            Load unpacked…
          </Button>
          <p className="mt-1 text-[14px] text-muted">
            Load a plugin source directory in place for development.
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

interface PluginSourcesModalProps {
  /**
   * Draft plugin source settings edited in the modal.
   */
  settings: PluginSourcesSettings;

  /**
   * Whether settings are being loaded or saved.
   */
  busy: boolean;

  /**
   * Load or save error message shown inside the modal.
   */
  error: string | null;

  /**
   * Closes the modal without saving.
   */
  onClose: () => void;

  /**
   * Persists the draft settings.
   */
  onSave: () => void;

  /**
   * Replaces the draft with HarborClient default endpoints.
   */
  onResetDefaults: () => void;

  /**
   * Updates one draft source row.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index within the list.
   * @param source - Updated source row.
   */
  onUpdateSource: (kind: PluginSourceKind, index: number, source: PluginSource) => void;

  /**
   * Removes one draft source row.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index to remove.
   */
  onRemoveSource: (kind: PluginSourceKind, index: number) => void;

  /**
   * Adds a new draft source row.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param url - Endpoint URL to append.
   */
  onAddSource: (kind: PluginSourceKind, url: string) => string | null;

  /**
   * Read-only plugin source rows provided by connected Team Hubs.
   */
  hubSources: TeamHubPluginSourcesView;
}

/**
 * Validates a plugin source URL before it is added to the draft settings.
 *
 * @param url - Raw URL from the add-endpoint input.
 * @returns Trimmed URL when valid.
 */
function parseDraftPluginSourceUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error('URL is required.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid http:// or https:// URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Enter a valid http:// or https:// URL.');
  }

  return trimmed;
}

interface PluginSourceListSectionProps {
  /**
   * Stable id prefix used for form control ids in this section.
   */
  sectionId: string;

  /**
   * Section heading shown above the endpoint list.
   */
  title: string;

  /**
   * Helper text describing what the endpoint list controls.
   */
  description: string;

  /**
   * Catalog or trusted endpoint rows in the draft settings.
   */
  sources: PluginSource[];

  /**
   * Whether the parent modal is loading or saving.
   */
  busy: boolean;

  /**
   * Adds a new endpoint row to this section.
   *
   * @param url - Endpoint URL to append.
   */
  onAdd: (url: string) => string | null;

  /**
   * Updates one endpoint row.
   *
   * @param index - Row index within the list.
   * @param source - Updated source row.
   */
  onUpdate: (index: number, source: PluginSource) => void;

  /**
   * Removes one endpoint row.
   *
   * @param index - Row index to remove.
   */
  onRemove: (index: number) => void;

  /**
   * Read-only plugin source rows provided by connected Team Hubs.
   */
  hubSources: TeamHubPluginSource[];
}

/**
 * Renders one editable list of plugin catalog or trusted-key endpoints.
 */
function PluginSourceListSection({
  sectionId,
  title,
  description,
  sources,
  hubSources,
  busy,
  onAdd,
  onUpdate,
  onRemove
}: PluginSourceListSectionProps): JSX.Element {
  const [draftUrl, setDraftUrl] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingUntrustedUrl, setPendingUntrustedUrl] = useState<string | null>(null);

  /**
   * Attempts to add the current draft URL to the section list.
   */
  const handleAdd = (): void => {
    try {
      const trimmed = parseDraftPluginSourceUrl(draftUrl);
      if (
        sources.some((source) => source.url === trimmed) ||
        hubSources.some((source) => source.url === trimmed)
      ) {
        setAddError('That endpoint is already in the list.');
        return;
      }

      const error = onAdd(trimmed);
      if (error) {
        setAddError(error);
        return;
      }

      if (!isHarborClientEndpoint(trimmed)) {
        setPendingUntrustedUrl(trimmed);
      }

      setDraftUrl('');
      setAddError(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    }
  };

  const addInputId = `${sectionId}-add-url`;
  const addErrorId = `${sectionId}-add-error`;
  const untrustedWarningId = `${sectionId}-untrusted-warning`;

  return (
    <section className="space-y-3" aria-labelledby={`${sectionId}-title`}>
      <div>
        <h3 id={`${sectionId}-title`} className="m-0 text-[14px] font-medium text-text">
          {title}
        </h3>
        <p className="m-0 mt-1 text-[14px] text-muted">{description}</p>
      </div>

      {sources.length === 0 && hubSources.length === 0 ? (
        <p className="m-0 text-[14px] text-muted" role="status">
          No endpoints configured.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0 mb-3">
          {sources.map((source, index) => {
            const checkboxId = `${sectionId}-enabled-${index}`;
            const untrusted = !isHarborClientEndpoint(source.url);

            return (
              <li
                key={source.url}
                className="flex flex-wrap items-start gap-2 rounded-md border border-separator bg-control p-3"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="mt-1"
                    checked={source.enabled}
                    disabled={busy}
                    aria-label={`Enable ${source.url}`}
                    onChange={(event) => {
                      onUpdate(index, { ...source, enabled: event.target.checked });
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={checkboxId} className="block break-all text-[14px] text-text">
                      {source.url}
                    </label>
                    {untrusted ? (
                      <span className="mt-1 inline-block rounded bg-danger/20 px-1.5 py-0.5 text-[14px] text-danger">
                        Untrusted source
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  aria-label={`Remove ${source.url}`}
                  onClick={() => onRemove(index)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
          {hubSources.map((source) => {
            const checkboxId = `${sectionId}-hub-${source.hubId}-${source.url}`;

            return (
              <li
                key={`${source.hubId}:${source.url}`}
                className="flex flex-wrap items-start gap-2 rounded-md border border-separator bg-control p-3"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="mt-1"
                    checked
                    disabled
                    aria-label={`${source.url} from ${source.hubName}`}
                    readOnly
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={checkboxId} className="block break-all text-[14px] text-text">
                      {source.url}
                    </label>
                    <span className="mt-1 inline-block rounded bg-accent/15 px-1.5 py-0.5 text-[14px] text-text">
                      From {source.hubName}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sources.some((source) => !isHarborClientEndpoint(source.url)) ? (
        <p id={untrustedWarningId} className="m-0 text-[14px] text-danger" role="alert">
          Third-party endpoints can list or vouch for unverified plugins. Only add catalogs and
          trusted-key registries from sources you trust.
        </p>
      ) : null}

      <div>
        <label htmlFor={addInputId} className="mb-1 block text-[14px] text-muted">
          Add endpoint URL
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={addInputId}
            type="url"
            className="min-w-[min(100%,20rem)] flex-1"
            placeholder="https://example.com/plugin_catalog.json"
            value={draftUrl}
            disabled={busy}
            aria-invalid={addError ? true : undefined}
            aria-describedby={
              [addError ? addErrorId : null, pendingUntrustedUrl ? untrustedWarningId : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onChange={(event) => {
              setDraftUrl(event.target.value);
              setAddError(null);
              setPendingUntrustedUrl(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAdd();
              }
            }}
          />
          <Button type="button" variant="secondary" disabled={busy} onClick={handleAdd}>
            Add
          </Button>
        </div>
        {addError ? (
          <p id={addErrorId} className="mt-2 text-[14px] text-danger" role="alert">
            {addError}
          </p>
        ) : null}
        {pendingUntrustedUrl ? (
          <p id={untrustedWarningId} className="mt-2 text-[14px] text-danger" role="alert">
            {pendingUntrustedUrl} is not hosted on harborclient.com. Third-party endpoints can list
            or vouch for unverified plugins. Only add this source if you trust it.
          </p>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Modal for configuring plugin marketplace catalog and trusted publisher endpoints.
 */
function PluginSourcesModal({
  settings,
  hubSources,
  busy,
  error,
  onClose,
  onSave,
  onResetDefaults,
  onUpdateSource,
  onRemoveSource,
  onAddSource
}: PluginSourcesModalProps): JSX.Element {
  return (
    <Modal
      onClose={onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
      labelledBy="plugin-sources-title"
    >
      <h2 id="plugin-sources-title" className="m-0 mb-2 text-[15px] font-semibold text-text">
        Plugin sources
      </h2>
      <p className="mb-4 text-[14px] text-muted">
        Configure where HarborClient loads marketplace catalogs and trusted publisher keys. Enabled
        endpoints are fetched in list order; the first source wins when entries overlap. Team Hub
        endpoints are managed by your hub administrator and cannot be removed here.
      </p>

      {error ? (
        <p className="mb-4 text-[14px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="max-h-[min(32rem,60vh)] space-y-6 overflow-y-auto pr-1">
        <PluginSourceListSection
          sectionId="plugin-catalog-sources"
          title="Catalog endpoints"
          description="JSON catalogs listing installable plugins for the Marketplace view."
          sources={settings.catalogs}
          hubSources={hubSources.catalogs}
          busy={busy}
          onAdd={(url) => onAddSource('catalogs', url)}
          onUpdate={(index, source) => onUpdateSource('catalogs', index, source)}
          onRemove={(index) => onRemoveSource('catalogs', index)}
        />
        <PluginSourceListSection
          sectionId="plugin-trusted-sources"
          title="Trusted publisher endpoints"
          description="JSON registries mapping publisher names to trusted signing key URLs."
          sources={settings.trusted}
          hubSources={hubSources.trusted}
          busy={busy}
          onAdd={(url) => onAddSource('trusted', url)}
          onUpdate={(index, source) => onUpdateSource('trusted', index, source)}
          onRemove={(index) => onRemoveSource('trusted', index)}
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-separator pt-4">
        <Button type="button" variant="secondary" disabled={busy} onClick={onResetDefaults}>
          Reset defaults
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={onSave}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Settings section for installing, enabling, and inspecting plugins.
 */
export function PluginsSection(): JSX.Element {
  const dispatch = useAppDispatch();
  const [showBrowse, setShowBrowse] = useState(false);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [catalog, setCatalog] = useState<PluginCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogActionBusyId, setCatalogActionBusyId] = useState<string | null>(null);
  const [catalogDetailEntry, setCatalogDetailEntry] = useState<PluginCatalogEntry | null>(null);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<PluginInfo | null>(null);
  const [pendingInstall, setPendingInstall] = useState<PluginInfo | null>(null);
  const [descriptionMarkdown, setDescriptionMarkdown] = useState<string>('');
  const [descriptionLoadState, setDescriptionLoadState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle');
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showGitInstallModal, setShowGitInstallModal] = useState(false);
  const [gitInstallUrl, setGitInstallUrl] = useState('');
  const [gitInstallRef, setGitInstallRef] = useState('');
  const [gitInstallError, setGitInstallError] = useState<string | null>(null);
  const [gitInstallBusy, setGitInstallBusy] = useState(false);
  const [gitUpdateBusyId, setGitUpdateBusyId] = useState<string | null>(null);
  const [showPluginSourcesModal, setShowPluginSourcesModal] = useState(false);
  const [pluginSourcesDraft, setPluginSourcesDraft] =
    useState<PluginSourcesSettings>(getDefaultPluginSources());
  const [pluginSourcesBusy, setPluginSourcesBusy] = useState(false);
  const [pluginSourcesLoadError, setPluginSourcesLoadError] = useState<string | null>(null);
  const [teamHubPluginSources, setTeamHubPluginSources] = useState<{
    catalogs: TeamHubPluginSource[];
    trusted: TeamHubPluginSource[];
  }>({ catalogs: [], trusted: [] });

  /**
   * Opens the plugin sources settings modal and loads persisted endpoints.
   */
  const openPluginSourcesModal = (): void => {
    setPluginSourcesLoadError(null);
    setPluginSourcesBusy(true);
    setShowPluginSourcesModal(true);
    void Promise.all([window.api.getPluginSources(), window.api.getTeamHubPluginSources()])
      .then(([settings, hubSources]) => {
        setPluginSourcesDraft(settings);
        setTeamHubPluginSources(hubSources);
      })
      .catch((err) => {
        setPluginSourcesLoadError(err instanceof Error ? err.message : String(err));
        setPluginSourcesDraft(getDefaultPluginSources());
        setTeamHubPluginSources({ catalogs: [], trusted: [] });
      })
      .finally(() => {
        setPluginSourcesBusy(false);
      });
  };

  /**
   * Closes the plugin sources settings modal without saving.
   */
  const closePluginSourcesModal = (): void => {
    if (pluginSourcesBusy) {
      return;
    }
    setShowPluginSourcesModal(false);
    setPluginSourcesLoadError(null);
  };

  /**
   * Replaces the draft plugin source settings with HarborClient defaults.
   */
  const resetPluginSourcesDraft = (): void => {
    setPluginSourcesDraft(getDefaultPluginSources());
    setPluginSourcesLoadError(null);
  };

  /**
   * Updates one draft plugin source row in the modal.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index within the list.
   * @param source - Updated source row.
   */
  const updatePluginSourceDraft = (
    kind: PluginSourceKind,
    index: number,
    source: PluginSource
  ): void => {
    setPluginSourcesDraft((current) => ({
      ...current,
      [kind]: current[kind].map((entry, entryIndex) => (entryIndex === index ? source : entry))
    }));
  };

  /**
   * Removes one draft plugin source row from the modal.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index to remove.
   */
  const removePluginSourceDraft = (kind: PluginSourceKind, index: number): void => {
    setPluginSourcesDraft((current) => ({
      ...current,
      [kind]: current[kind].filter((_entry, entryIndex) => entryIndex !== index)
    }));
  };

  /**
   * Adds one draft plugin source row to the modal.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param url - Endpoint URL to append.
   * @returns Validation error message, or null when the row was added.
   */
  const addPluginSourceDraft = (kind: PluginSourceKind, url: string): string | null => {
    const candidate: PluginSourcesSettings = {
      ...pluginSourcesDraft,
      [kind]: [...pluginSourcesDraft[kind], { url, enabled: true }]
    };
    const parsed = pluginSourcesSchema.safeParse(candidate);
    if (!parsed.success) {
      return 'Enter a valid http:// or https:// URL.';
    }
    setPluginSourcesDraft(parsed.data);
    return null;
  };

  /**
   * Persists draft plugin source settings and refreshes the marketplace catalog.
   */
  const savePluginSources = async (): Promise<void> => {
    setPluginSourcesBusy(true);
    setPluginSourcesLoadError(null);
    try {
      const saved = await window.api.setPluginSources(pluginSourcesDraft);
      setPluginSourcesDraft(saved);
      setShowPluginSourcesModal(false);
      if (showBrowse) {
        setCatalog(null);
        await loadCatalog();
      }
      toast.success('Plugin sources saved.');
    } catch (err) {
      setPluginSourcesLoadError(
        formatIpcErrorMessage(err, 'Plugin source settings could not be saved.')
      );
    } finally {
      setPluginSourcesBusy(false);
    }
  };

  /**
   * Shows a blocking alert when a user-initiated plugin action fails.
   *
   * @param title - Dialog heading.
   * @param err - Caught error from the IPC call.
   * @param fallback - Message when the error cannot be parsed.
   */
  const showPluginActionError = (title: string, err: unknown, fallback: string): void => {
    showAlert(dispatch, formatIpcErrorMessage(err, fallback), title, { icon: 'warning' });
  };

  /**
   * Loads the plugin list from the main process and keeps the open detail row in sync.
   *
   * @returns Fresh plugin rows from the main process.
   */
  const refresh = useCallback(async (): Promise<PluginInfo[]> => {
    setLoading(true);
    setError(null);
    try {
      const next = await window.api.listPlugins();
      setPlugins(next);
      setDetailPlugin((current) =>
        current ? (next.find((plugin) => plugin.id === current.id) ?? null) : null
      );
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Loads plugins on mount and when the main process reports changes.
   */
  useEffect(() => {
    let active = true;
    void window.api
      .listPlugins()
      .then((next) => {
        if (active) {
          setPlugins(next);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    const unsubscribe = window.api.onPluginsChanged(() => {
      void refresh();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [refresh]);

  /**
   * Loads the detail plugin description markdown when the detail modal opens.
   */
  useEffect(() => {
    let active = true;
    const descriptionPath = detailPlugin?.manifest.description;
    if (!detailPlugin || !descriptionPath) {
      return () => {
        active = false;
      };
    }
    void window.api
      .readPluginAsset(detailPlugin.id, descriptionPath)
      .then((asset) => {
        if (active) {
          setDescriptionMarkdown(atob(asset.content));
          setDescriptionLoadState('loaded');
        }
      })
      .catch(() => {
        if (active) {
          setDescriptionMarkdown('');
          setDescriptionLoadState('error');
        }
      });
    return () => {
      active = false;
    };
  }, [detailPlugin]);

  /**
   * Loads the marketplace catalog from harborclient.com.
   */
  const loadCatalog = useCallback(async (): Promise<void> => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const next = await window.api.getPluginCatalog();
      setCatalog(next);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : String(err));
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  /**
   * Toggles between the installed-plugins list and the marketplace catalog.
   */
  const toggleBrowseView = (): void => {
    setShowBrowse((current) => {
      const next = !current;
      if (!next) {
        setCatalogDetailEntry(null);
        setCatalogSearchQuery('');
      }
      if (next && !catalog && !catalogLoading) {
        void loadCatalog();
      }
      return next;
    });
  };

  /**
   * Opens the marketplace detail modal for one catalog listing.
   *
   * @param entry - Catalog row to inspect.
   */
  const openCatalogDetail = (entry: PluginCatalogEntry): void => {
    setCatalogError(null);
    setCatalogDetailEntry(entry);
  };

  /**
   * Closes the marketplace detail modal.
   */
  const closeCatalogDetail = (): void => {
    setCatalogDetailEntry(null);
    setCatalogError(null);
  };

  /**
   * Builds a searchable index over the loaded marketplace catalog.
   */
  const catalogSearchIndex = useMemo(() => {
    if (!catalog?.plugins.length) {
      return null;
    }
    return buildPluginCatalogSearchIndex(catalog.plugins);
  }, [catalog]);

  /**
   * Filters marketplace catalog rows by the current search query.
   */
  const filteredCatalogPlugins = useMemo(() => {
    if (!catalog?.plugins.length || !catalogSearchIndex) {
      return catalog?.plugins ?? [];
    }
    return searchPluginCatalog(catalog.plugins, catalogSearchIndex, catalogSearchQuery);
  }, [catalog, catalogSearchIndex, catalogSearchQuery]);

  /**
   * Opens the read-only detail modal for one installed plugin.
   *
   * @param plugin - Plugin row to inspect.
   */
  const openDetail = (plugin: PluginInfo): void => {
    setDescriptionMarkdown('');
    setDescriptionLoadState(plugin.manifest.description ? 'loading' : 'idle');
    setDetailPlugin(plugin);
  };

  /**
   * Closes the read-only detail modal and clears loaded description text.
   */
  const closeDetail = (): void => {
    setDetailPlugin(null);
    setDescriptionMarkdown('');
    setDescriptionLoadState('idle');
  };

  /**
   * Opens the detail modal when a table row is activated from the keyboard.
   *
   * @param event - Keyboard event on the row.
   * @param plugin - Plugin row to inspect.
   */
  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    plugin: PluginInfo
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDetail(plugin);
    }
  };

  /**
   * Closes the permissions dialog and optionally removes a just-installed plugin.
   *
   * @param keep - When false, uninstall/remove the pending plugin.
   */
  const closePendingInstall = async (keep: boolean): Promise<void> => {
    if (!pendingInstall) {
      return;
    }
    const plugin = pendingInstall;
    setPendingInstall(null);
    if (!keep) {
      if (isManagedInstall(plugin)) {
        await window.api.uninstallPlugin(plugin.id);
      } else {
        await window.api.removeUnpackedPlugin(plugin.id);
      }
      await refresh();
      return;
    }
    await window.api.setPluginEnabled(plugin.id, true);
    const next = await refresh();
    const enabled = next.find((entry) => entry.id === plugin.id);
    if (enabled) {
      openDetail(enabled);
    }
  };

  /**
   * Opens the install method chooser modal.
   */
  const openInstallModal = (): void => {
    setShowInstallModal(true);
  };

  /**
   * Closes the install method chooser modal.
   */
  const closeInstallModal = (): void => {
    setShowInstallModal(false);
  };

  /**
   * Opens the install-from-file dialog and shows the permissions modal.
   */
  const handleInstall = async (): Promise<void> => {
    try {
      const installed = await window.api.installPlugin();
      if (installed) {
        setPendingInstall(installed);
      }
    } catch (err) {
      showPluginActionError('Install failed', err, 'The plugin could not be installed.');
    }
  };

  /**
   * Opens the install-from-git modal with a cleared form.
   */
  const openGitInstallModal = (): void => {
    setGitInstallUrl('');
    setGitInstallRef('');
    setGitInstallError(null);
    setShowGitInstallModal(true);
  };

  /**
   * Closes the install-from-git modal.
   */
  const closeGitInstallModal = (): void => {
    if (gitInstallBusy) {
      return;
    }
    setShowGitInstallModal(false);
    setGitInstallError(null);
  };

  /**
   * Clones a plugin from a public git repository URL.
   */
  const handleInstallFromGit = async (): Promise<void> => {
    const url = gitInstallUrl.trim();
    if (!url) {
      setGitInstallError('Repository URL is required.');
      return;
    }
    setGitInstallBusy(true);
    setGitInstallError(null);
    try {
      const ref = gitInstallRef.trim() || undefined;
      const installed = await window.api.installPluginFromGit(url, ref);
      setShowGitInstallModal(false);
      setPendingInstall(installed);
    } catch (err) {
      showPluginActionError('Install failed', err, 'The plugin could not be installed from git.');
    } finally {
      setGitInstallBusy(false);
    }
  };

  /**
   * Re-clones a git-installed plugin from its stored origin.
   *
   * @param pluginId - Plugin manifest id.
   */
  const handleUpdateFromGit = async (pluginId: string): Promise<void> => {
    setGitUpdateBusyId(pluginId);
    try {
      await window.api.updatePluginFromGit(pluginId);
      await refresh();
    } catch (err) {
      showPluginActionError('Update failed', err, 'The plugin could not be updated from git.');
    } finally {
      setGitUpdateBusyId(null);
    }
  };

  /**
   * Installs a marketplace plugin via the existing git clone flow.
   *
   * @param entry - Catalog listing to install.
   */
  const handleCatalogInstall = async (entry: PluginCatalogEntry): Promise<void> => {
    setCatalogActionBusyId(entry.id);
    try {
      const installed = await window.api.installPluginFromGit(entry.repoUrl, entry.ref);
      setCatalogDetailEntry(null);
      setPendingInstall(installed);
    } catch (err) {
      showPluginActionError('Install failed', err, 'The plugin could not be installed.');
    } finally {
      setCatalogActionBusyId(null);
    }
  };

  /**
   * Re-clones a git-installed marketplace plugin from its stored origin.
   *
   * @param pluginId - Plugin manifest id.
   */
  const handleCatalogUpdate = async (pluginId: string): Promise<void> => {
    setCatalogActionBusyId(pluginId);
    try {
      await window.api.updatePluginFromGit(pluginId);
      await refresh();
    } catch (err) {
      showPluginActionError('Update failed', err, 'The plugin could not be updated.');
    } finally {
      setCatalogActionBusyId(null);
    }
  };

  /**
   * Opens the load-unpacked dialog and shows the permissions modal.
   */
  const handleLoadUnpacked = async (): Promise<void> => {
    try {
      const loaded = await window.api.loadUnpackedPlugin();
      if (loaded) {
        setPendingInstall(loaded);
      }
    } catch (err) {
      showPluginActionError('Load failed', err, 'The unpacked plugin could not be loaded.');
    }
  };

  /**
   * Closes the chooser and starts the install-from-file flow.
   */
  const handleInstallFromFileChoice = (): void => {
    closeInstallModal();
    void handleInstall();
  };

  /**
   * Closes the chooser and opens the install-from-git form.
   */
  const handleInstallFromGitChoice = (): void => {
    closeInstallModal();
    openGitInstallModal();
  };

  /**
   * Closes the chooser and starts the load-unpacked flow.
   */
  const handleLoadUnpackedChoice = (): void => {
    closeInstallModal();
    void handleLoadUnpacked();
  };

  /**
   * Toggles enablement for one plugin row.
   *
   * @param plugin - Plugin to enable or disable.
   */
  const handleToggleEnabled = async (plugin: PluginInfo): Promise<void> => {
    await window.api.setPluginEnabled(plugin.id, !plugin.enabled);
    await refresh();
  };

  /**
   * Reloads one unpacked plugin from disk.
   *
   * @param plugin - Plugin to reload from its unpacked source path.
   */
  const handleReload = async (plugin: PluginInfo): Promise<void> => {
    await window.api.reloadPlugin(plugin.id);
    await refresh();
    toast.success(`${plugin.name} reloaded.`);
  };

  /**
   * Removes an installed or unpacked plugin after confirmation.
   *
   * @param plugin - Plugin to remove.
   */
  const handleRemove = async (plugin: PluginInfo): Promise<void> => {
    const confirmed = await showConfirm(dispatch, {
      title: isManagedInstall(plugin) ? 'Uninstall plugin?' : 'Remove dev plugin?',
      message: isManagedInstall(plugin)
        ? `Remove ${plugin.name} and delete its files from HarborClient?`
        : `Stop loading ${plugin.name} from ${plugin.path}? Your source folder will not be deleted.`,
      confirmLabel: isManagedInstall(plugin) ? 'Uninstall' : 'Remove',
      variant: 'danger'
    });
    if (!confirmed) {
      return;
    }
    if (isManagedInstall(plugin)) {
      await window.api.uninstallPlugin(plugin.id);
    } else {
      await window.api.removeUnpackedPlugin(plugin.id);
    }
    if (detailPlugin?.id === plugin.id) {
      closeDetail();
    }
    await refresh();
  };

  return (
    <section>
      <PageHeader title="Plugins" icon={faPuzzlePiece}>
        <Button
          type="button"
          aria-pressed={showBrowse}
          className="inline-flex items-center gap-1.5"
          onClick={toggleBrowseView}
        >
          {showBrowse ? (
            <>
              <FaIcon icon={faAngleLeft} className="h-3.5 w-3.5" />
              Installed
            </>
          ) : (
            <>
              <FaIcon icon={faStore} className="h-3.5 w-3.5" />
              Marketplace
            </>
          )}
        </Button>
        {!showBrowse ? (
          <>
            <Button
              type="button"
              className="inline-flex items-center gap-1.5"
              onClick={openInstallModal}
            >
              <FaIcon icon={faDownload} className="h-3.5 w-3.5" />
              Install
            </Button>
            <Button
              type="button"
              className="inline-flex items-center gap-1.5"
              onClick={openPluginSourcesModal}
            >
              <FaIcon icon={faGear} className="h-3.5 w-3.5" />
              Settings
            </Button>
          </>
        ) : null}
      </PageHeader>

      {showBrowse ? (
        <div className="mb-4">
          <label htmlFor="plugin-catalog-search" className="sr-only">
            Search plugins
          </label>
          <Input
            id="plugin-catalog-search"
            type="search"
            placeholder="Search plugins"
            value={catalogSearchQuery}
            disabled={catalogLoading}
            className="w-full max-w-md"
            onChange={(event) => setCatalogSearchQuery(event.target.value)}
          />
        </div>
      ) : null}

      {!showBrowse ? (
        <>
          {error ? <p className="text-danger">{error}</p> : null}
          {loading ? (
            <p className="text-muted" role="status">
              Loading plugins…
            </p>
          ) : null}

          {!loading && plugins.length === 0 ? (
            <p className="text-muted">No plugins installed yet.</p>
          ) : null}

          {!loading && plugins.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-separator">
              <table className="w-full border-collapse text-[14px]">
                <caption className="sr-only">Installed plugins</caption>
                <thead>
                  <tr className="border-b border-separator bg-sidebar/40 text-left">
                    <th scope="col" className="px-3 py-2 font-medium text-text">
                      Plugin
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium text-text">
                      Version
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium text-text">
                      Publisher
                    </th>
                    <th
                      scope="col"
                      className="w-0 whitespace-nowrap px-3 py-2 font-medium text-text"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plugins.map((plugin) => {
                    const gitUpdateBusy = gitUpdateBusyId === plugin.id;

                    return (
                      <tr
                        key={plugin.id}
                        tabIndex={0}
                        className="cursor-pointer border-b border-separator last:border-b-0 hover:bg-selection/40"
                        aria-label={`View details for ${plugin.name}`}
                        onClick={() => openDetail(plugin)}
                        onKeyDown={(event) => handleRowKeyDown(event, plugin)}
                      >
                        <td className="px-3 py-2 align-top">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-text">{plugin.name}</span>
                            {plugin.signature?.status === 'verified' ? (
                              <FaIcon
                                icon={faCircleCheck}
                                className="h-3.5 w-3.5 shrink-0 text-success"
                                title={`Verified publisher: ${plugin.signature.author ?? plugin.manifest.author ?? 'unknown'}`}
                              />
                            ) : null}
                            {plugin.signature?.status === 'invalid' ? (
                              <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[14px] text-danger">
                                Invalid signature
                              </span>
                            ) : null}
                            {plugin.signature?.status === 'untrusted' ? (
                              <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[14px] text-danger">
                                Untrusted publisher
                              </span>
                            ) : null}
                            {plugin.runtimeError && plugin.enabled ? (
                              <span className="rounded bg-danger/20 px-1.5 py-0.5 text-[14px] text-danger">
                                Error
                              </span>
                            ) : null}
                            {plugin.manifest.homepage ? (
                              <PluginTableExternalLink
                                href={plugin.manifest.homepage}
                                label="Homepage"
                                pluginName={plugin.name}
                              />
                            ) : null}
                            {plugin.source === 'unpacked' ? (
                              <span className="rounded bg-info/20 px-1.5 py-0.5 text-[14px] text-text">
                                Development
                              </span>
                            ) : null}
                            {plugin.source === 'git' ? (
                              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[14px] text-text">
                                Git
                              </span>
                            ) : null}
                          </div>
                          <div className="text-[14px] text-muted">{plugin.id}</div>
                          <PluginErrorMessages plugin={plugin} />
                        </td>
                        <td className="px-3 py-2 align-top text-text">{plugin.version}</td>
                        <td className="px-3 py-2 align-top text-text">
                          {plugin.manifest.author ? (
                            plugin.manifest.author
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td
                          className="w-0 whitespace-nowrap px-3 py-2 align-top"
                          onClick={stopRowActivation}
                          onMouseDown={stopRowActivation}
                        >
                          <div className="flex flex-nowrap gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              aria-label={
                                plugin.enabled ? `Disable ${plugin.name}` : `Enable ${plugin.name}`
                              }
                              onClick={() => void handleToggleEnabled(plugin)}
                            >
                              {plugin.enabled ? 'Disable' : 'Enable'}
                            </Button>
                            {plugin.source === 'unpacked' ? (
                              <Button
                                type="button"
                                variant="secondary"
                                aria-label={`Reload ${plugin.name}`}
                                onClick={() => void handleReload(plugin)}
                              >
                                Reload
                              </Button>
                            ) : null}
                            {plugin.source === 'git' ? (
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={gitUpdateBusy}
                                aria-label={`Update ${plugin.name}`}
                                onClick={() => void handleUpdateFromGit(plugin.id)}
                              >
                                {gitUpdateBusy ? 'Updating…' : 'Update'}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="primaryDanger"
                              aria-label={
                                isManagedInstall(plugin)
                                  ? `Uninstall ${plugin.name}`
                                  : `Remove ${plugin.name}`
                              }
                              onClick={() => void handleRemove(plugin)}
                            >
                              {isManagedInstall(plugin) ? 'Uninstall' : 'Remove'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {catalogError ? (
            <p className="text-danger" role="alert">
              {catalogError}
            </p>
          ) : null}
          {catalogLoading ? (
            <p className="text-muted" role="status">
              Loading plugin catalog…
            </p>
          ) : null}

          {!catalogLoading && catalog?.plugins.length === 0 ? (
            <p className="text-muted">
              No plugins are listed yet. See the{' '}
              <a
                href="https://harborclient.com/plugins"
                target="_blank"
                rel="noreferrer"
                className="text-accent"
              >
                plugin marketplace
              </a>{' '}
              for submission instructions.
            </p>
          ) : null}

          {!catalogLoading &&
          catalog &&
          catalog.plugins.length > 0 &&
          filteredCatalogPlugins.length === 0 ? (
            <p className="text-muted" role="status">
              No plugins match your search.
            </p>
          ) : null}

          {!catalogLoading && catalog && filteredCatalogPlugins.length > 0 ? (
            <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
              {filteredCatalogPlugins.map((entry) => (
                <PluginCatalogCard
                  key={entry.id}
                  entry={entry}
                  onOpen={() => openCatalogDetail(entry)}
                />
              ))}
            </ul>
          ) : null}
        </>
      )}

      {catalogDetailEntry ? (
        <PluginCatalogDetailModal
          entry={catalogDetailEntry}
          installed={findInstalledCatalogPlugin(plugins, catalogDetailEntry.id)}
          actionBusy={catalogActionBusyId === catalogDetailEntry.id}
          onClose={closeCatalogDetail}
          onInstall={() => void handleCatalogInstall(catalogDetailEntry)}
          onUpdate={() => {
            const installed = findInstalledCatalogPlugin(plugins, catalogDetailEntry.id);
            if (installed) {
              void handleCatalogUpdate(installed.id);
            }
          }}
        />
      ) : null}

      {detailPlugin ? (
        <PluginDetailModal
          plugin={detailPlugin}
          descriptionMarkdown={descriptionMarkdown}
          descriptionLoadState={descriptionLoadState}
          onClose={closeDetail}
        />
      ) : null}

      {showInstallModal ? (
        <PluginInstallModal
          onClose={closeInstallModal}
          onInstallFromFile={handleInstallFromFileChoice}
          onInstallFromGit={handleInstallFromGitChoice}
          onLoadUnpacked={handleLoadUnpackedChoice}
        />
      ) : null}

      {showPluginSourcesModal ? (
        <PluginSourcesModal
          settings={pluginSourcesDraft}
          hubSources={teamHubPluginSources}
          busy={pluginSourcesBusy}
          error={pluginSourcesLoadError}
          onClose={closePluginSourcesModal}
          onSave={() => void savePluginSources()}
          onResetDefaults={resetPluginSourcesDraft}
          onUpdateSource={updatePluginSourceDraft}
          onRemoveSource={removePluginSourceDraft}
          onAddSource={addPluginSourceDraft}
        />
      ) : null}

      {showGitInstallModal ? (
        <Modal onClose={closeGitInstallModal} labelledBy="plugin-git-install-title">
          <h2
            id="plugin-git-install-title"
            className="m-0 mb-2 text-[14px] font-semibold text-text"
          >
            Install from Git
          </h2>
          <p className="mb-3 text-[14px] text-muted">
            Enter a public repository URL. The repo must include a built{' '}
            <code className="text-text">manifest.json</code> and entry files at the repository root.
          </p>
          <label htmlFor="plugin-git-install-url" className="mb-1 block text-[14px] text-muted">
            Repository URL
          </label>
          <Input
            id="plugin-git-install-url"
            className="mb-3 w-full"
            type="url"
            autoFocus
            placeholder="https://github.com/example/my-plugin.git"
            value={gitInstallUrl}
            disabled={gitInstallBusy}
            onChange={(event) => {
              setGitInstallUrl(event.target.value);
              setGitInstallError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleInstallFromGit();
              }
            }}
          />
          <label htmlFor="plugin-git-install-ref" className="mb-1 block text-[14px] text-muted">
            Branch or tag (optional)
          </label>
          <Input
            id="plugin-git-install-ref"
            className="w-full"
            type="text"
            placeholder="main"
            value={gitInstallRef}
            disabled={gitInstallBusy}
            onChange={(event) => {
              setGitInstallRef(event.target.value);
              setGitInstallError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleInstallFromGit();
              }
            }}
          />
          {gitInstallError ? (
            <p className="mt-3 text-[14px] text-danger" role="alert">
              {gitInstallError}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={gitInstallBusy}
              onClick={closeGitInstallModal}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={gitInstallBusy || !gitInstallUrl.trim()}
              onClick={() => void handleInstallFromGit()}
            >
              {gitInstallBusy ? 'Cloning…' : 'Install'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {pendingInstall ? (
        <Modal
          onClose={() => void closePendingInstall(false)}
          labelledBy="plugin-permissions-title"
        >
          <h2
            id="plugin-permissions-title"
            className="m-0 mb-2 text-[14px] font-semibold text-text"
          >
            Enable {pendingInstall.name}?
          </h2>
          <p className="mb-3 text-[14px] text-text">
            Version {pendingInstall.version} requests the following permissions:
          </p>
          {pendingInstall.signature?.status === 'verified' ? (
            <p className="mb-3 flex items-center gap-2 text-[14px] text-text" role="status">
              <FaIcon icon={faCircleCheck} className="h-3.5 w-3.5 shrink-0 text-success" />
              Verified by {pendingInstall.signature.author ?? pendingInstall.manifest.author}
            </p>
          ) : null}
          {pendingInstall.signature?.status === 'unsigned' ? (
            <p className="mb-3 text-[14px] text-danger" role="alert">
              This plugin is not signed by a trusted publisher. Only enable it if you trust the
              source.
            </p>
          ) : null}
          <ul className="mb-4 list-disc pl-5 text-[14px] text-text">
            {pendingInstall.permissions.map((permission) => (
              <li key={permission}>{PERMISSION_LABELS[permission] ?? permission}</li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void closePendingInstall(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void closePendingInstall(true)}>
              {pendingInstall.signature?.status === 'unsigned' ? 'Enable anyway' : 'Enable plugin'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
