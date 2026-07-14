import { Button, Checkbox, FaIcon, Modal, ModalFooter, Page } from '@harborclient/sdk/components';
import { useCallback, useEffect, useState, type ChangeEvent, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { GitIdentity } from '#/shared/types';
import { normalizeGitHostKey } from '#/shared/gitUrl';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { faGithub, faPlus } from '#/renderer/src/fontawesome';
import { GitAuthForm } from '#/renderer/src/ui/git/GitAuthForm';
import { SettingLabel } from '#/renderer/src/ui/Settings/components/SettingLabel';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';

/**
 * Settings page for managing shared git host identities.
 */
export function GitIdentitiesSection(): JSX.Element {
  const confirm = useConfirm();
  const dispatch = useAppDispatch();
  const gitAutoAdd = useAppSelector((state) => state.settings.general.gitAutoAdd);
  const externalMergeEditorPath = useAppSelector(
    (state) => state.settings.general.externalMergeEditorPath
  );
  const [identities, setIdentities] = useState<GitIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorHost, setEditorHost] = useState('');
  const [editorUrl, setEditorUrl] = useState('');

  /**
   * Reloads saved git identities from the main process.
   */
  const reloadIdentities = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const next = await window.api.listGitIdentities();
      setIdentities(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Loads identities when the settings section mounts.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const next = await window.api.listGitIdentities();
        if (!cancelled) {
          setIdentities(next);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadIdentities]);

  /**
   * Opens the editor modal for a new or existing host identity.
   *
   * @param identity - Existing identity to edit, if any.
   */
  const openEditor = (identity?: GitIdentity): void => {
    if (identity) {
      setEditorHost(identity.host);
      setEditorUrl(`https://${identity.host}/`);
    } else {
      setEditorHost('');
      setEditorUrl('');
    }
    setEditorOpen(true);
  };

  /**
   * Removes credentials for a host after confirmation.
   *
   * @param identity - Identity to revoke.
   */
  const handleRemove = async (identity: GitIdentity): Promise<void> => {
    const confirmed = await confirm({
      title: 'Remove git credentials',
      message: `Remove stored credentials for ${identity.host}? Git-backed collections using this host will fail push, pull, and fetch until you authorize again.`,
      confirmLabel: 'Remove credentials',
      variant: 'danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      await window.api.gitRevokeHost(identity.host);
      await reloadIdentities();
      toast.success(`Removed credentials for ${identity.host}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  const editorHostKey = normalizeGitHostKey(editorUrl || editorHost);

  /**
   * Persists the global git auto-track preference.
   */
  const handleAutoAddChange = (event: ChangeEvent<HTMLInputElement>): void => {
    void dispatch(patchGeneralSettings({ gitAutoAdd: event.target.checked }));
  };

  /**
   * Persists the external merge editor executable path.
   */
  const handleExternalMergeEditorPathChange = (event: ChangeEvent<HTMLInputElement>): void => {
    void dispatch(patchGeneralSettings({ externalMergeEditorPath: event.target.value }));
  };

  /**
   * Opens a file picker for the external merge editor executable.
   */
  const handleBrowseExternalMergeEditor = async (): Promise<void> => {
    try {
      const selected = await window.api.selectFiles();
      const nextPath = selected[0];
      if (nextPath != null) {
        await dispatch(patchGeneralSettings({ externalMergeEditorPath: nextPath }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Page
      embedded
      title="Git"
      icon={faGithub}
      description="Manage shared credentials for git hosts. One identity per host is reused by all git-backed collections."
      className="mb-6 flex flex-col"
      actions={[
        <Button
          key="add"
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          onClick={() => openEditor()}
        >
          <FaIcon icon={faPlus} />
          Add
        </Button>
      ]}
    >
      <div className="mb-6 rounded-md border border-separator px-3 py-3">
        <label
          htmlFor="git-auto-track"
          className="flex cursor-pointer items-start gap-3 text-[14px] text-text"
        >
          <Checkbox
            id="git-auto-track"
            checked={gitAutoAdd}
            onChange={handleAutoAddChange}
            aria-describedby="git-auto-track-description"
          />
          <span className="flex min-w-0 flex-col gap-1">
            <SettingLabel settingId="git.autoTrack">Auto track</SettingLabel>
            <span id="git-auto-track-description" className="text-muted">
              When enabled, HarborClient automatically tracks all requests and files added to
              git-backed collections. When disabled, use Add on individual requests to track changes
              before committing.
            </span>
          </span>
        </label>
      </div>

      <div className="mb-6 rounded-md border border-separator px-3 py-3">
        <label
          htmlFor="git-external-merge-editor-path"
          className="mb-2 block text-[14px] text-text"
        >
          <SettingLabel settingId="git.externalMergeEditorPath">External merge editor</SettingLabel>
        </label>
        <p id="git-external-merge-editor-description" className="m-0 mb-3 text-muted">
          Optional executable used to resolve merge conflicts. Leave empty to use
          HarborClient&apos;s built-in merge editor.
        </p>
        <div className="flex items-center gap-2">
          <input
            id="git-external-merge-editor-path"
            className="min-w-0 flex-1 rounded border border-separator bg-surface px-3 py-2 text-[14px] text-text"
            type="text"
            value={externalMergeEditorPath}
            placeholder="/path/to/merge-editor"
            aria-describedby="git-external-merge-editor-description"
            onChange={handleExternalMergeEditorPathChange}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => void handleBrowseExternalMergeEditor()}
          >
            Browse
          </Button>
        </div>
      </div>

      <span className="text-[18px] font-medium text-text mb-2">
        <SettingLabel settingId="git.identities">Git Identities</SettingLabel>
      </span>
      {loading ? (
        <p className="m-0 text-muted" role="status">
          Loading git identities…
        </p>
      ) : identities.length === 0 ? (
        <p className="m-0 text-muted">No git credentials saved yet.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {identities.map((identity) => (
            <li
              key={identity.host}
              className="flex items-center justify-between gap-3 rounded border border-separator px-3 py-2"
            >
              <div className="min-w-0">
                <p className="m-0 font-medium text-text">{identity.host}</p>
                <p className="m-0 text-muted">
                  {identity.auth.kind === 'oauth'
                    ? 'GitHub OAuth'
                    : `Personal access token (${identity.auth.username})`}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="secondary" onClick={() => openEditor(identity)}>
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleRemove(identity)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editorOpen ? (
        <Modal
          onClose={() => setEditorOpen(false)}
          className="w-[32rem]"
          labelledBy="git-identity-editor-title"
          title={editorHost ? `Edit ${editorHost}` : 'Add git host'}
          description="Enter a repository URL on the host you want to authenticate with."
        >
          {!editorHost && (
            <label className="mb-3 flex flex-col gap-1 text-[14px] text-text">
              Repository URL
              <input
                className="rounded border border-separator bg-surface px-3 py-2 text-[14px] text-text"
                type="url"
                value={editorUrl}
                placeholder="https://github.com/org/repo.git"
                onChange={(event) => setEditorUrl(event.target.value)}
              />
            </label>
          )}

          {editorHostKey ? (
            <GitAuthForm
              host={editorHostKey}
              url={editorUrl || `https://${editorHostKey}/`}
              onAuthorized={() => {
                setEditorOpen(false);
                void reloadIdentities();
              }}
            />
          ) : (
            <p className="m-0 text-[14px] text-muted">Enter a valid HTTPS repository URL.</p>
          )}

          <ModalFooter spaced>
            <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>
              Close
            </Button>
          </ModalFooter>
        </Modal>
      ) : null}
    </Page>
  );
}
