import { Button, FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { faWandMagicSparkles } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  selectAiSidebarVisible,
  toggleAiSidebar
} from '#/renderer/src/store/slices/navigationSlice';

/**
 * Toggles the agent chat sidebar from the request editor breadcrumb row.
 * Matches the footer icon pattern for show/hide labeling and pressed state.
 */
export function AiChatToggleButton(): JSX.Element {
  const dispatch = useAppDispatch();
  const aiSidebarOpen = useAppSelector(selectAiSidebarVisible);

  /**
   * Accessible name for the Agent Chat toggle, matching the footer icon pattern.
   */
  const aiChatLabel = aiSidebarOpen ? 'Hide agent chat' : 'Show agent chat';

  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={aiChatLabel}
      aria-pressed={aiSidebarOpen}
      title={aiChatLabel}
      onClick={() => dispatch(toggleAiSidebar())}
      className={`hc-ai-chat-button inline-flex w-16 shrink-0 items-center justify-center${aiSidebarOpen ? ' bg-selection' : ''}`}
    >
      <FaIcon icon={faWandMagicSparkles} className="h-3.5 w-3.5" aria-hidden />
    </Button>
  );
}
