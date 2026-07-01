import { Button, FieldError, FormGroup, Input, Page } from '@harborclient/sdk/components';
import type { JSX, KeyboardEvent } from 'react';
import { faDownload } from '#/renderer/src/fontawesome';

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
      description="Add plugins from a package file, git repository, or unpacked source directory."
    >
      <div className="flex max-w-xl flex-col gap-6">
        <div>
          <Button type="button" variant="secondary" className="w-full" onClick={onInstallFromFile}>
            Install from file
          </Button>
          <p className="mt-1 text-[14px] text-muted">
            Select a <code className="text-text">.hcp</code> plugin package.
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

        <div className="rounded-md border border-separator p-4">
          <h2 className="m-0 mb-1 text-[14px] font-medium text-text">Install from Git</h2>
          <p className="m-0 mb-4 text-[14px] text-muted">
            Enter a public repository URL. The repo must include a built{' '}
            <code className="text-text">manifest.json</code> and entry files at the repository root.
          </p>

          {gitInstallError ? (
            <FieldError spacing="section" roleAlert>
              {gitInstallError}
            </FieldError>
          ) : null}

          <FormGroup label="Repository URL" htmlFor="plugin-git-install-url" labelTone="muted">
            <Input
              id="plugin-git-install-url"
              className="mb-3 w-full"
              type="url"
              placeholder="https://github.com/example/my-plugin.git"
              value={gitInstallUrl}
              disabled={gitInstallBusy}
              onChange={(event) => onGitInstallUrlChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </FormGroup>
          <FormGroup
            label="Branch or tag (optional)"
            htmlFor="plugin-git-install-ref"
            labelTone="muted"
          >
            <Input
              id="plugin-git-install-ref"
              className="mb-4 w-full"
              type="text"
              placeholder="main"
              value={gitInstallRef}
              disabled={gitInstallBusy}
              onChange={(event) => onGitInstallRefChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </FormGroup>
          <Button
            type="button"
            disabled={gitInstallBusy || !gitInstallUrl.trim()}
            onClick={onInstallFromGit}
          >
            {gitInstallBusy ? 'Cloning…' : 'Install from Git'}
          </Button>
        </div>
      </div>
    </Page>
  );
}
