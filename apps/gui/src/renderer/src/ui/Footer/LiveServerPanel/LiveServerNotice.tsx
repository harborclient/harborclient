import { Button, FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { LiveServerSettingsTab } from '@harborclient/core/types';
import { faCircleInfo, faXmark } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { patchGeneralSettings } from '#/renderer/src/store/thunks/settings';
import {
  dismissLiveServerNoticePatch,
  isLiveServerNoticeDismissed,
  LIVE_SERVER_NOTICES
} from './liveServerNotices';

interface Props {
  /**
   * Live Server settings tab whose help notice is shown.
   */
  tab: LiveServerSettingsTab;
}

/**
 * Dismissible inline notice describing what a Live Server settings tab does.
 *
 * Renders nothing once the user dismisses the notice; dismissal is persisted
 * per tab in general settings and can be re-enabled from Settings → Backup &
 * Restore → Show confirmations.
 */
export function LiveServerNotice({ tab }: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const general = useAppSelector((state) => state.settings.general);

  if (isLiveServerNoticeDismissed(general, tab)) {
    return null;
  }

  const { label, description } = LIVE_SERVER_NOTICES[tab];

  /**
   * Persists the dismissal so this tab's notice never shows again until
   * re-enabled from settings.
   */
  const handleDismiss = (): void => {
    void dispatch(patchGeneralSettings(dismissLiveServerNoticePatch(general, tab)));
  };

  return (
    <div
      role="note"
      className="mb-4 flex shrink-0 items-start gap-2 rounded-md border border-separator bg-sidebar/40 py-2 pl-3 pr-2"
    >
      <FaIcon icon={faCircleInfo} className="h-4 w-4 shrink-0 self-center text-yellow-500" />
      <p className="m-0 flex-1 self-center">{description}</p>
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
