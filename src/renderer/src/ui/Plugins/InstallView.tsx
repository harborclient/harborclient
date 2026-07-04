import { Button, FieldError, Input, Page } from '@harborclient/sdk/components';
import type { JSX, KeyboardEvent } from 'react';
import { faDownload } from '#/renderer/src/fontawesome';
import type { PluginManagementKind } from '#/renderer/src/ui/Plugins/constants';
import { pluginManagementNoun } from '#/renderer/src/ui/Plugins/constants';
import { SettingsField } from '#/renderer/src/ui/Settings/components/SettingsField';

interface Props {
  /**
   * Whether installs are scoped to plugins or themes.
   */
  kind: PluginManagementKind;

  /**
   * Repository URL entered by the user for git install.
   */
  gitInstallUrl: string;

  /**
   * Optional git branch or tag for git install.
   */
  gitInstallRef: string;

  /**
   * Validation or IPC error message for git install.
   */
  gitInstallError: string | null;

  /**
   * Whether a git clone operation is in progress.
   */
  gitInstallBusy: boolean;

  /**
   * Updates the repository URL field.
   */
  onGitInstallUrlChange: (url: string) => void;

  /**
   * Updates the branch or tag field.
   */
  onGitInstallRefChange: (ref: string) => void;

  /**
   * Starts the install-from-file flow (native file picker).
   */
  onInstallFromFile: () => void;

  /**
   * Starts the load-unpacked flow (native folder picker).
   */
  onLoadUnpacked: () => void;

  /**
   * Starts the install-from-git flow.
   */
  onInstallFromGit: () => void;
}

/**
 * Install page with file, git, and unpacked plugin install options.
 */
export function InstallView({
  kind,
  gitInstallUrl,
  gitInstallRef,
  gitInstallError,
  gitInstallBusy,
  onGitInstallUrlChange,
  onGitInstallRefChange,
  onInstallFromFile,
  onLoadUnpacked,
  onInstallFromGit
}: Props): JSX.Element {
  const noun = pluginManagementNoun(kind);
  const isThemes = kind === 'themes';
  const urlFieldId = isThemes ? 'theme-git-install-url' : 'plugin-git-install-url';
  const refFieldId = isThemes ? 'theme-git-install-ref' : 'plugin-git-install-ref';

  /**
   * Submits the git install form when Enter is pressed in an input field.
   *
   * @param event - Keyboard event on a form input.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && !gitInstallBusy && gitInstallUrl.trim()) {
      onInstallFromGit();
    }
  };

  return (
    <Page
      embedded
      title="Install"
      icon={faDownload}
      description={
        isThemes
          ? 'Add themes from a package file, git repository, or unpacked source directory.'
          : 'Add plugins from a package file, git repository, or unpacked source directory.'
      }
    >
      <div className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-4 border border-separator p-4 rounded-md">
          {gitInstallError ? (
            <FieldError spacing="section" roleAlert>
              {gitInstallError}
            </FieldError>
          ) : null}

          <SettingsField
            embedded
            label="Install from Git"
            htmlFor={urlFieldId}
            description="Public repository URL using HTTP."
          >
            <Input
              id={urlFieldId}
              className="w-full"
              type="url"
              placeholder={
                isThemes
                  ? 'https://github.com/example/my-theme.git'
                  : 'https://github.com/example/my-plugin.git'
              }
              value={gitInstallUrl}
              disabled={gitInstallBusy}
              onChange={(event) => onGitInstallUrlChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </SettingsField>
          <SettingsField
            embedded
            label="Branch or tag"
            htmlFor={refFieldId}
            description="Name of the branch or tag to install."
          >
            <Input
              id={refFieldId}
              className="w-full"
              type="text"
              placeholder="main"
              value={gitInstallRef}
              disabled={gitInstallBusy}
              onChange={(event) => onGitInstallRefChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </SettingsField>
          <Button
            type="button"
            disabled={gitInstallBusy || !gitInstallUrl.trim()}
            onClick={onInstallFromGit}
          >
            {gitInstallBusy ? 'Cloning…' : 'Install from Git'}
          </Button>
        </div>

        <div className="flex flex-col gap-4 border border-separator p-4 rounded-md">
          <div>
            <Button type="button" className="w-full text-[16px]" onClick={onInstallFromFile}>
              Install from file
            </Button>
            <p className="mt-1 text-[16px] text-muted">
              Install a theme from a <code className="text-text">.hcp</code> package.
            </p>
          </div>

          <div>
            <Button type="button" className="w-full text-[16px]" onClick={onLoadUnpacked}>
              Install from directory
            </Button>
            <p className="mt-1 text-[16px] text-muted">Install a {noun} from a directory.</p>
          </div>
        </div>
      </div>
    </Page>
  );
}
