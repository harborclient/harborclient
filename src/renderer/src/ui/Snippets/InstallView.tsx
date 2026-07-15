import type { JSX } from 'react';
import { CatalogInstallView } from '#/renderer/src/ui/shared/Marketplace/CatalogInstallView';

interface Props {
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
   * Whether a git install operation is in progress.
   */
  gitInstallBusy: boolean;

  /**
   * Whether a file install operation is in progress.
   */
  fileInstallBusy: boolean;

  /**
   * Whether a directory install operation is in progress.
   */
  directoryInstallBusy: boolean;

  /**
   * Updates the repository URL field.
   */
  onGitInstallUrlChange: (url: string) => void;

  /**
   * Updates the branch or tag field.
   */
  onGitInstallRefChange: (ref: string) => void;

  /**
   * Starts the install-from-git flow.
   */
  onInstallFromGit: () => void;

  /**
   * Starts the install-from-file flow (native file picker).
   */
  onInstallFromFile: () => void;

  /**
   * Starts the load-unpacked flow (native folder picker).
   */
  onLoadUnpacked: () => void;
}

/**
 * Install section for snippet bundles from git, package file, or unpacked directory.
 */
export function InstallView({
  gitInstallUrl,
  gitInstallRef,
  gitInstallError,
  gitInstallBusy,
  fileInstallBusy,
  directoryInstallBusy,
  onGitInstallUrlChange,
  onGitInstallRefChange,
  onInstallFromGit,
  onInstallFromFile,
  onLoadUnpacked
}: Props): JSX.Element {
  return (
    <CatalogInstallView
      description="Install a snippet bundle from a package file, git repository, or unpacked source directory."
      urlFieldId="snippet-git-install-url"
      refFieldId="snippet-git-install-ref"
      urlLabel="Repository URL"
      urlPlaceholder="https://github.com/owner/snippet-bundle"
      refLabel="Branch or tag (optional)"
      refPlaceholder="main"
      gitUrl={gitInstallUrl}
      gitRef={gitInstallRef}
      gitError={gitInstallError}
      gitBusy={gitInstallBusy}
      installLabel="Install from Git"
      installBusyLabel="Installing…"
      errorPlacement="bottom"
      onGitUrlChange={onGitInstallUrlChange}
      onGitRefChange={onGitInstallRefChange}
      onInstallFromGit={onInstallFromGit}
      fileLabel="Install from file"
      fileBusyLabel="Installing…"
      fileBusy={fileInstallBusy}
      fileHint={
        <>
          Install a snippet bundle from a <code className="text-text">.hcs</code> package.
        </>
      }
      onInstallFromFile={onInstallFromFile}
      directoryLabel="Install from directory"
      directoryBusyLabel="Installing…"
      directoryBusy={directoryInstallBusy}
      directoryHint={<>Install a snippet bundle from a directory containing snippets.json.</>}
      onLoadUnpacked={onLoadUnpacked}
    />
  );
}
