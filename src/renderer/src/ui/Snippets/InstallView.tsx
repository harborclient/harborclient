import { Button, FieldError, Input, Page } from '@harborclient/sdk/components';
import type { JSX, KeyboardEvent } from 'react';
import { faDownload } from '#/renderer/src/fontawesome';
import { SettingsField } from '#/renderer/src/ui/Settings/components/SettingsField';

interface Props {
  gitInstallUrl: string;
  gitInstallRef: string;
  gitInstallError: string | null;
  gitInstallBusy: boolean;
  fileInstallBusy: boolean;
  directoryInstallBusy: boolean;
  onGitInstallUrlChange: (url: string) => void;
  onGitInstallRefChange: (ref: string) => void;
  onInstallFromGit: () => void;
  onInstallFromFile: () => void;
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
  /**
   * Starts git install when Enter is pressed in the ref field.
   *
   * @param event - Keyboard event on the ref input.
   */
  const handleRefKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onInstallFromGit();
    }
  };

  return (
    <Page
      embedded
      title="Install"
      description="Install a snippet bundle from a package file, git repository, or unpacked source directory."
      icon={faDownload}
    >
      <div className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-4 border border-separator p-4 rounded-md">
          <SettingsField label="Repository URL" htmlFor="snippet-git-install-url">
            <Input
              id="snippet-git-install-url"
              type="url"
              placeholder="https://github.com/owner/snippet-bundle"
              value={gitInstallUrl}
              disabled={gitInstallBusy}
              onChange={(event) => onGitInstallUrlChange(event.target.value)}
            />
          </SettingsField>

          <SettingsField label="Branch or tag (optional)" htmlFor="snippet-git-install-ref">
            <Input
              id="snippet-git-install-ref"
              type="text"
              placeholder="main"
              value={gitInstallRef}
              disabled={gitInstallBusy}
              onChange={(event) => onGitInstallRefChange(event.target.value)}
              onKeyDown={handleRefKeyDown}
            />
          </SettingsField>

          {gitInstallError ? <FieldError>{gitInstallError}</FieldError> : null}

          <Button type="button" disabled={gitInstallBusy} onClick={onInstallFromGit}>
            {gitInstallBusy ? 'Installing…' : 'Install from Git'}
          </Button>
        </div>

        <div className="flex flex-col gap-4 border border-separator p-4 rounded-md">
          <div>
            <Button
              type="button"
              className="w-full text-[16px]"
              disabled={fileInstallBusy}
              onClick={onInstallFromFile}
            >
              {fileInstallBusy ? 'Installing…' : 'Install from file'}
            </Button>
            <p className="mt-1 text-[16px] text-muted">
              Install a snippet bundle from a <code className="text-text">.hcs</code> package.
            </p>
          </div>

          <div>
            <Button
              type="button"
              className="w-full text-[16px]"
              disabled={directoryInstallBusy}
              onClick={onLoadUnpacked}
            >
              {directoryInstallBusy ? 'Installing…' : 'Install from directory'}
            </Button>
            <p className="mt-1 text-[16px] text-muted">
              Install a snippet bundle from a directory containing snippets.json.
            </p>
          </div>
        </div>
      </div>
    </Page>
  );
}
