import type { JSX } from 'react';
import type { PluginCatalogEntry } from '#/shared/plugin/catalog';
import type { PluginInfo } from '#/shared/plugin/types';
import { Button } from '#/renderer/src/components/Button';
import { Modal } from '#/renderer/src/components/Modal';

interface Props {
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
export function CatalogDetailModal({
  entry,
  installed,
  actionBusy,
  onClose,
  onInstall,
  onUpdate
}: Props): JSX.Element {
  const displayVersion = installed?.version ?? entry.version;

  return (
    <Modal
      onClose={onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
      labelledBy="plugin-catalog-detail-title"
      title={entry.name}
      closeDisabled={actionBusy}
      disableEscape={actionBusy}
    >
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
