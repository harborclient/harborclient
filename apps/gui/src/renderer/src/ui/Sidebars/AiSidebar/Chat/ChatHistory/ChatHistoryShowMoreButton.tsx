import type { JSX } from 'react';

interface Props {
  /**
   * Accessible name describing what additional items will be revealed.
   */
  label: string;

  /**
   * Reveals the remaining hidden items.
   */
  onClick: () => void;
}

/**
 * Shared Show more control for section and flat-list pagination.
 */
export function ChatHistoryShowMoreButton({ label, onClick }: Props): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      className="mx-1 mt-1 w-[calc(100%-0.5rem)] cursor-pointer rounded-md border-none bg-transparent px-2 py-1.5 text-left text-accent hover:bg-selection app-no-drag"
      onClick={onClick}
    >
      Show more
    </button>
  );
}
