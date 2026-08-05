import { Button, FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { EditorTab } from '@harborclient/core/types';
import { faCircleInfo, faXmark } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import {
  dismissRequestEditorNoticePatch,
  isRequestEditorNoticeDismissed,
  REQUEST_EDITOR_NOTICES
} from './requestEditorNotices';

interface Props {
  /**
   * Built-in editor tab whose help notice is shown.
   */
  tab: EditorTab;
}

/**
 * Dismissible inline notice describing what a request editor tab does.
 *
 * Renders nothing once the user dismisses the notice; dismissal is persisted
 * per tab in general settings and can be re-enabled from Settings → Backup &
 * Restore → Show confirmations.
 */
export function RequestEditorNotice({ tab }: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const general = useAppSelector((state) => state.settings.general);

  if (isRequestEditorNoticeDismissed(general, tab)) {
    return null;
  }

  const { label, description } = REQUEST_EDITOR_NOTICES[tab];

  /**
   * Persists the dismissal so this tab's notice never shows again until
   * re-enabled from settings.
   */
  const handleDismiss = (): void => {
    void dispatch(patchGeneralSettings(dismissRequestEditorNoticePatch(general, tab)));
  };

  return (
    <div
      role="note"
      className="mb-4 flex shrink-0 items-start gap-3 rounded-lg border border-accent/35 bg-accent/10 py-2.5 pl-3 pr-2 shadow-sm"
    >
      <span
        className="hc-notice-icon-pulse flex size-7 shrink-0 items-center justify-center self-center rounded-full bg-accent/20 text-accent"
        aria-hidden
      >
        <FaIcon icon={faCircleInfo} className="h-4 w-4" />
      </span>
      <p className="m-0 flex-1 self-center text-text">{description}</p>
      <Button
        variant="icon"
        className="size-[24px]"
        aria-label={`Dismiss ${label} tab tip`}
        onClick={handleDismiss}
      >
        <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
