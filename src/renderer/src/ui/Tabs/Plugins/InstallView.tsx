import type { JSX } from 'react';
import type { PluginManagementKind } from './constants';
import { pluginManagementNoun } from './constants';
import { CatalogInstallView } from '#/renderer/src/ui/Shared/Marketplace/CatalogInstallView';

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

  return (
    <CatalogInstallView
      description={
        isThemes
          ? 'Add themes from a package file, git repository, or unpacked source directory.'
          : 'Add plugins from a package file, git repository, or unpacked source directory.'
      }
      urlFieldId={urlFieldId}
      refFieldId={refFieldId}
      urlLabel="Install from Git"
      urlDescription="Public repository URL using HTTP."
      urlPlaceholder={
        isThemes
          ? 'https://github.com/example/my-theme.git'
          : 'https://github.com/example/my-plugin.git'
      }
      refLabel="Branch or tag"
      refDescription="Name of the branch or tag to install."
      refPlaceholder="main"
      gitUrl={gitInstallUrl}
      gitRef={gitInstallRef}
      gitError={gitInstallError}
      gitBusy={gitInstallBusy}
      installLabel="Install from Git"
      installBusyLabel="Cloning…"
      errorPlacement="top"
      onGitUrlChange={onGitInstallUrlChange}
      onGitRefChange={onGitInstallRefChange}
      onInstallFromGit={onInstallFromGit}
      fileLabel="Install from file"
      fileHint={
        <>
          Install a {noun} from a <code className="text-text">.hcp</code> package.
        </>
      }
      onInstallFromFile={onInstallFromFile}
      directoryLabel="Install from directory"
      directoryHint={<>Install a {noun} from a directory.</>}
      onLoadUnpacked={onLoadUnpacked}
    />
  );
}
