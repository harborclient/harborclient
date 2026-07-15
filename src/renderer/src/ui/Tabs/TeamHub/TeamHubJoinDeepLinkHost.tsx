import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  consumePendingTeamHubJoin,
  selectPendingTeamHubJoin
} from '#/renderer/src/store/slices/navigationSlice';
import { TeamHubOnboardModal } from '#/renderer/src/ui/Tabs/TeamHub/TeamHubOnboardModal';
import type { JSX } from 'react';

/**
 * Opens the Team Hub onboarding modal when a join deep link is queued in navigation state.
 */
export function TeamHubJoinDeepLinkHost(): JSX.Element | null {
  const dispatch = useAppDispatch();
  const pendingJoin = useAppSelector(selectPendingTeamHubJoin);

  if (!pendingJoin) {
    return null;
  }

  return (
    <TeamHubOnboardModal join={pendingJoin} onClose={() => dispatch(consumePendingTeamHubJoin())} />
  );
}
