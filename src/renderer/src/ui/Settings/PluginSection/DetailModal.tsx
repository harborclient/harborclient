import type { JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PluginInfo } from '#/shared/plugin/types';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { Modal } from '#/renderer/src/components/Modal';
import { faCircleCheck } from '#/renderer/src/fontawesome';
import { PERMISSION_LABELS } from './constants';
import { ErrorMessages } from './ErrorMessages';

interface Props {
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
export function DetailModal({
  plugin,
  descriptionMarkdown,
  descriptionLoadState,
  onClose
}: Props): JSX.Element {
  return (
    <Modal
      onClose={onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
      labelledBy="plugin-detail-title"
      title={
        <>
          {plugin.name}
          {plugin.signature?.status === 'verified' ? (
            <FaIcon
              icon={faCircleCheck}
              className="h-3.5 w-3.5 shrink-0 text-success"
              title={`Verified publisher: ${plugin.signature.author ?? plugin.manifest.author ?? 'unknown'}`}
            />
          ) : null}
        </>
      }
    >
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

      <ErrorMessages plugin={plugin} />

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
    </Modal>
  );
}
