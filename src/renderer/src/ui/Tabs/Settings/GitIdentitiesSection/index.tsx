import {
  Button,
  Checkbox,
  FaIcon,
  FormGroup,
  Input,
  Modal,
  ModalFooter,
  Page,
  SettingIdLabel,
  SettingSectionHeading
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { GitIdentity } from '#/shared/types';
import { normalizeGitHostKey } from '#/shared/gitUrl';

import { useConfirm } from '#/renderer/src/hooks/useConfirm';
import { faGithub, faPlus } from '#/renderer/src/fontawesome';
import {
  GitAuthForm,
  type GitAuthAuthorizedResult
} from '#/renderer/src/ui/Shared/Git/GitAuthForm';
import { GitAuthorForm } from '#/renderer/src/ui/Shared/Git/GitAuthorForm';
import { entryById } from '#/renderer/src/ui/Tabs/Settings/catalog/catalog';
import type { SettingsSectionComponentProps } from '#/renderer/src/ui/Tabs/Settings/catalog/registry';
import { SettingsSaveAction } from '#/renderer/src/ui/Tabs/Settings/components/SettingsSaveAction';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectDraftGeneral,
  selectSettingsDraftDisabled,
  setDraftGeneralField
} from '#/renderer/src/store/slices/settingsDraftSlice';

const GIT_AUTO_TRACK_INPUT_ID = 'git-auto-track';
const GIT_EXTERNAL_MERGE_EDITOR_INPUT_ID = 'git-external-merge-editor-path';

/**
 * Settings page for managing shared git host identities.
 */
export function GitIdentitiesSection({ tabId }: SettingsSectionComponentProps): JSX.Element {
  const confirm = useConfirm();
  const dispatch = useAppDispatch();
  const general = useAppSelector(selectDraftGeneral);
  const baseline = useAppSelector((state) => state.settingsDraft.baseline);
  const disabled = useAppSelector(selectSettingsDraftDisabled);
  const authorPrefilledRef = useRef(false);
  const [identities, setIdentities] = useState<GitIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorHost, setEditorHost] = useState('');
  const [editorUrl, setEditorUrl] = useState('');

  const autoTrackCatalog = entryById('git.autoTrack');
  const commitAuthorCatalog = entryById('git.commitAuthor');

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
   * Prefills commit author draft fields from git config when saved settings are unset.
   */
  useEffect(() => {
    if (
      baseline == null ||
      baseline.general.gitCommitAuthorName.trim() !== '' ||
      baseline.general.gitCommitAuthorEmail.trim() !== '' ||
      authorPrefilledRef.current
    ) {
      return;
    }

    authorPrefilledRef.current = true;

    void (async () => {
      try {
        const connections = await window.api.listStorageConnections();
        const gitConnection = connections.find((conn) => conn.type === 'git');
        const suggested = gitConnection
          ? await window.api.gitSuggestedAuthor(gitConnection.id)
          : await window.api.gitSuggestedAuthor();

        if (suggested.name.trim()) {
          dispatch(setDraftGeneralField({ key: 'gitCommitAuthorName', value: suggested.name }));
        }
        if (suggested.email.trim()) {
          dispatch(setDraftGeneralField({ key: 'gitCommitAuthorEmail', value: suggested.email }));
        }
      } catch {
        // Suggestion is best-effort; the user can enter values manually.
      }
    })();
  }, [baseline, dispatch]);

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
   * Updates the global git auto-track preference in the settings draft.
   */
  const handleAutoAddChange = (event: ChangeEvent<HTMLInputElement>): void => {
    dispatch(setDraftGeneralField({ key: 'gitAutoAdd', value: event.target.checked }));
  };

  /**
   * Updates the external merge editor executable path in the settings draft.
   */
  const handleExternalMergeEditorPathChange = (event: ChangeEvent<HTMLInputElement>): void => {
    dispatch(setDraftGeneralField({ key: 'externalMergeEditorPath', value: event.target.value }));
  };

  /**
   * Updates the git commit author name in the settings draft.
   */
  const handleCommitAuthorNameChange = (value: string): void => {
    dispatch(setDraftGeneralField({ key: 'gitCommitAuthorName', value }));
  };

  /**
   * Updates the git commit author email in the settings draft.
   */
  const handleCommitAuthorEmailChange = (value: string): void => {
    dispatch(setDraftGeneralField({ key: 'gitCommitAuthorEmail', value }));
  };

  /**
   * Opens a file picker and stores the selected merge editor path in the settings draft.
   */
  const handleBrowseExternalMergeEditor = async (): Promise<void> => {
    try {
      const selected = await window.api.selectFiles();
      const nextPath = selected[0];
      if (nextPath != null) {
        dispatch(setDraftGeneralField({ key: 'externalMergeEditorPath', value: nextPath }));
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
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
            onClick={() => openEditor()}
          >
            <FaIcon icon={faPlus} />
            Add
          </Button>
          <SettingsSaveAction tabId={tabId} />
        </div>
      }
    >
      <div className="mb-6 flex flex-col gap-6">
        <FormGroup
          label={
            <SettingIdLabel settingId="git.autoTrack">{autoTrackCatalog.label}</SettingIdLabel>
          }
          description={autoTrackCatalog.description}
          htmlFor={GIT_AUTO_TRACK_INPUT_ID}
          layout="checkbox"
        >
          <Checkbox
            id={GIT_AUTO_TRACK_INPUT_ID}
            checked={general.gitAutoAdd}
            disabled={disabled}
            onChange={handleAutoAddChange}
          />
        </FormGroup>

        <FormGroup
          label={
            <SettingIdLabel settingId="git.externalMergeEditorPath">
              External merge editor
            </SettingIdLabel>
          }
          description="Optional executable used to resolve merge conflicts. Leave empty to use HarborClient's built-in merge editor."
          htmlFor={GIT_EXTERNAL_MERGE_EDITOR_INPUT_ID}
        >
          <div className="flex gap-2">
            <Input
              id={GIT_EXTERNAL_MERGE_EDITOR_INPUT_ID}
              type="text"
              className="min-w-0 flex-1"
              value={general.externalMergeEditorPath}
              placeholder="/path/to/merge-editor"
              disabled={disabled}
              onChange={handleExternalMergeEditorPathChange}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => void handleBrowseExternalMergeEditor()}
            >
              Browse
            </Button>
          </div>
        </FormGroup>

        <FormGroup
          label={
            <SettingIdLabel settingId="git.commitAuthor">
              {commitAuthorCatalog.label}
            </SettingIdLabel>
          }
        >
          <GitAuthorForm
            name={general.gitCommitAuthorName}
            email={general.gitCommitAuthorEmail}
            disabled={disabled}
            onNameChange={handleCommitAuthorNameChange}
            onEmailChange={handleCommitAuthorEmailChange}
          />
        </FormGroup>
      </div>

      <SettingSectionHeading settingId="git.identities" title="Git Identities" className="mb-2" />
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
              className="flex flex-col gap-2 rounded border border-separator px-3 py-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 font-medium text-text">{identity.host}</p>
                  <p className="m-0 text-muted">
                    {identity.auth.kind === 'oauth'
                      ? 'GitHub OAuth'
                      : `Personal access token (${identity.auth.username})`}
                    {identity.githubLogin ? ` — signed in as ${identity.githubLogin}` : null}
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
              onAuthorized={(result?: GitAuthAuthorizedResult) => {
                void reloadIdentities();
                if (result?.validationError) {
                  return;
                }
                setEditorOpen(false);
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
