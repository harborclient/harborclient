import { RoundButton } from '@harborclient/sdk/components';
import type { JSX, MouseEvent } from 'react';
import { faArrowUpRightFromSquare } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppStore } from '#/renderer/src/store/hooks';
import { openExternalLinkWithConfirm } from '#/renderer/src/ui/Modals/OpenExternalLinkModal/openExternalLinkWithConfirm';

interface Props {
  /**
   * Absolute http(s) URL to open, or null when the control should stay disabled.
   */
  url: string | null;

  /**
   * When true, the button cannot be activated.
   */
  disabled?: boolean;
}

/**
 * Compact omnibox control that opens the current address in the OS default browser.
 *
 * @param props - Component props.
 * @returns Icon button for the trailing edge of the address field.
 */
export function BrowserAddressOpenExternalButton({ url, disabled = false }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  /**
   * Keeps address-field focus so blur does not clear the edit buffer before click.
   *
   * @param event - Pointer down on the button.
   */
  function handleMouseDown(event: MouseEvent<HTMLButtonElement>): void {
    event.preventDefault();
  }

  /**
   * Confirms (when needed) then opens {@link url} via the system browser.
   */
  async function handleClick(): Promise<void> {
    if (!url) {
      return;
    }
    await openExternalLinkWithConfirm(dispatch, store.getState, url);
  }

  return (
    <RoundButton
      icon={faArrowUpRightFromSquare}
      ariaLabel="Open in system browser"
      disabled={disabled || url == null}
      onMouseDown={handleMouseDown}
      onClick={() => {
        void handleClick();
      }}
      className="h-6 w-6 shrink-0"
      iconClassName="h-4 w-4"
    />
  );
}
