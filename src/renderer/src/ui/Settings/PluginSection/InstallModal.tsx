import type { JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { Modal } from '#/renderer/src/components/Modal';

interface Props {
  /**
   * Closes the install chooser without starting an install flow.
   */
  onClose: () => void;

  /**
   * Starts the install-from-file flow (native file picker).
   */
  onInstallFromFile: () => void;

  /**
   * Opens the install-from-git form modal.
   */
  onInstallFromGit: () => void;

  /**
   * Starts the load-unpacked flow (native folder picker).
   */
  onLoadUnpacked: () => void;
}

/**
 * Chooser modal listing the three ways to add a plugin to HarborClient.
 */
export function InstallModal({
  onClose,
  onInstallFromFile,
  onInstallFromGit,
  onLoadUnpacked
}: Props): JSX.Element {
  return (
    <Modal onClose={onClose} labelledBy="plugin-install-title">
      <h2 id="plugin-install-title" className="m-0 mb-2 text-[15px] font-semibold text-text">
        Install plugin
      </h2>
      <p className="mb-4 text-[14px] text-muted">
        Choose how you want to add a plugin to HarborClient.
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <Button type="button" variant="secondary" className="w-full" onClick={onInstallFromFile}>
            Install from file
          </Button>
          <p className="mt-1 text-[14px] text-muted">
            Select a <code className="text-text">.hcp</code> plugin package.
          </p>
        </div>
        <div>
          <Button type="button" variant="secondary" className="w-full" onClick={onInstallFromGit}>
            Install from Git…
          </Button>
          <p className="mt-1 text-[14px] text-muted">
            Clone a public repository that ships a built manifest and entry files.
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
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
