import type { JSX } from 'react';
import { Button } from '#/renderer/src/components/Button';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faXmark } from '#/renderer/src/fontawesome';
import { TeamHubList } from './TeamHubList';

interface Props {
  /**
   * Closes the team hubs view.
   */
  onClose: () => void;
}

/**
 * Full-area team hub management with list, add, edit, and delete flows.
 */
export function TeamHubs({ onClose }: Props): JSX.Element {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-separator px-6 py-4">
        <h1 className="m-0 text-[15px] font-semibold text-text">Team Hubs</h1>
        <Button
          type="button"
          variant="icon"
          className="opacity-100 text-[28px]"
          title="Close"
          aria-label="Close"
          onClick={onClose}
        >
          <FaIcon icon={faXmark} className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <TeamHubList />
      </div>
    </div>
  );
}
