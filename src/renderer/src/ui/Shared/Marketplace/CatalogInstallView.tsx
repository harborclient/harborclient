import { Button, FieldError, FormGroup, Input, Page } from '@harborclient/sdk/components';
import type { JSX, KeyboardEvent, ReactNode } from 'react';
import { faDownload } from '#/renderer/src/fontawesome';

interface Props {
  /**
   * Page title shown in the embedded install header.
   */
  title?: string;

  /**
   * Short description below the install page title.
   */
  description: string;

  /**
   * Stable id for the repository URL input.
   */
  urlFieldId: string;

  /**
   * Stable id for the branch or tag input.
   */
  refFieldId: string;

  /**
   * Visible label for the repository URL field.
   */
  urlLabel: string;

  /**
   * Helper text below the repository URL label.
   */
  urlDescription?: ReactNode;

  /**
   * Placeholder for the repository URL input.
   */
  urlPlaceholder: string;

  /**
   * Visible label for the branch or tag field.
   */
  refLabel: string;

  /**
   * Helper text below the branch or tag label.
   */
  refDescription?: ReactNode;

  /**
   * Placeholder for the branch or tag input.
   */
  refPlaceholder: string;

  /**
   * Repository URL entered by the user for git install.
   */
  gitUrl: string;

  /**
   * Optional git branch or tag for git install.
   */
  gitRef: string;

  /**
   * Validation or IPC error message for git install.
   */
  gitError: string | null;

  /**
   * Whether a git install operation is in progress.
   */
  gitBusy: boolean;

  /**
   * Label for the git install submit button when idle.
   */
  installLabel: string;

  /**
   * Label for the git install submit button while busy.
   */
  installBusyLabel: string;

  /**
   * Whether git errors render above or below the git form fields.
   */
  errorPlacement: 'top' | 'bottom';

  /**
   * Updates the repository URL field.
   */
  onGitUrlChange: (url: string) => void;

  /**
   * Updates the branch or tag field.
   */
  onGitRefChange: (ref: string) => void;

  /**
   * Starts the install-from-git flow.
   */
  onInstallFromGit: () => void;

  /**
   * Label for the install-from-file button when idle.
   */
  fileLabel: string;

  /**
   * Label for the install-from-file button while busy.
   */
  fileBusyLabel?: string;

  /**
   * Whether a file install operation is in progress.
   */
  fileBusy?: boolean;

  /**
   * Hint text below the install-from-file button.
   */
  fileHint: ReactNode;

  /**
   * Starts the install-from-file flow (native file picker).
   */
  onInstallFromFile: () => void;

  /**
   * Label for the install-from-directory button when idle.
   */
  directoryLabel: string;

  /**
   * Label for the install-from-directory button while busy.
   */
  directoryBusyLabel?: string;

  /**
   * Whether a directory install operation is in progress.
   */
  directoryBusy?: boolean;

  /**
   * Hint text below the install-from-directory button.
   */
  directoryHint: ReactNode;

  /**
   * Starts the load-unpacked flow (native folder picker).
   */
  onLoadUnpacked: () => void;
}

/**
 * Shared catalog install layout with git, package file, and unpacked directory
 * panels. Feature folders pass IPC-backed handlers and feature-specific copy.
 */
export function CatalogInstallView({
  title = 'Install',
  description,
  urlFieldId,
  refFieldId,
  urlLabel,
  urlDescription,
  urlPlaceholder,
  refLabel,
  refDescription,
  refPlaceholder,
  gitUrl,
  gitRef,
  gitError,
  gitBusy,
  installLabel,
  installBusyLabel,
  errorPlacement,
  onGitUrlChange,
  onGitRefChange,
  onInstallFromGit,
  fileLabel,
  fileBusyLabel,
  fileBusy = false,
  fileHint,
  onInstallFromFile,
  directoryLabel,
  directoryBusyLabel,
  directoryBusy = false,
  directoryHint,
  onLoadUnpacked
}: Props): JSX.Element {
  /**
   * Submits the git install form when Enter is pressed in an input field.
   *
   * @param event - Keyboard event on a form input.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && !gitBusy && gitUrl.trim()) {
      event.preventDefault();
      onInstallFromGit();
    }
  };

  const gitErrorBlock =
    gitError != null ? (
      errorPlacement === 'top' ? (
        <FieldError spacing="section" roleAlert>
          {gitError}
        </FieldError>
      ) : (
        <FieldError>{gitError}</FieldError>
      )
    ) : null;

  return (
    <Page embedded title={title} icon={faDownload} description={description}>
      <div className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-md border border-separator p-4">
          {errorPlacement === 'top' ? gitErrorBlock : null}

          <FormGroup
            bordered={false}
            label={urlLabel}
            htmlFor={urlFieldId}
            description={urlDescription}
          >
            <Input
              id={urlFieldId}
              className="w-full"
              type="url"
              placeholder={urlPlaceholder}
              value={gitUrl}
              disabled={gitBusy}
              onChange={(event) => onGitUrlChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </FormGroup>

          <FormGroup
            bordered={false}
            label={refLabel}
            htmlFor={refFieldId}
            description={refDescription}
          >
            <Input
              id={refFieldId}
              className="w-full"
              type="text"
              placeholder={refPlaceholder}
              value={gitRef}
              disabled={gitBusy}
              onChange={(event) => onGitRefChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />
          </FormGroup>

          {errorPlacement === 'bottom' ? gitErrorBlock : null}

          <Button type="button" disabled={gitBusy || !gitUrl.trim()} onClick={onInstallFromGit}>
            {gitBusy ? installBusyLabel : installLabel}
          </Button>
        </div>

        <div className="flex flex-col gap-4 rounded-md border border-separator p-4">
          <div>
            <Button
              type="button"
              className="w-full"
              disabled={fileBusy}
              onClick={onInstallFromFile}
            >
              {fileBusy && fileBusyLabel ? fileBusyLabel : fileLabel}
            </Button>
            <p className="mt-1 text-muted">{fileHint}</p>
          </div>

          <div>
            <Button
              type="button"
              className="w-full"
              disabled={directoryBusy}
              onClick={onLoadUnpacked}
            >
              {directoryBusy && directoryBusyLabel ? directoryBusyLabel : directoryLabel}
            </Button>
            <p className="mt-1 text-muted">{directoryHint}</p>
          </div>
        </div>
      </div>
    </Page>
  );
}
