import { Sidebar, Toolbar, type ToolbarAction } from '@harborclient/sdk/components';
import { useEffect, useMemo, useRef, type JSX } from 'react';
import { hasAvailableAiModels } from '#/shared/ai/models';

import { faClockRotateLeft, faCircleCheck } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { selectAiSidebarVisible } from '#/renderer/src/store/slices/navigationSlice';
import {
  selectGithubModelsConnected,
  selectEnterToSend,
  selectHistoryOpen,
  selectHubModelGroups,
  setEnterToSend,
  setHistoryOpen
} from '#/renderer/src/store/slices/aiChatSlice';
import { openExistingChat, refreshHubLlmModels } from '#/renderer/src/store/thunks/aiChat';
import { useAiAvailability } from '#/renderer/src/hooks/useAiAvailability';
import { ChatHistory } from './Chat/ChatHistory';
import { ConfigureApiKeysPrompt } from './ConfigureApiKeysPrompt';
import { AiChat } from './Chat';

/**
 * Right-side AI panel shell. Shows a configure-access prompt when no personal keys
 * or Team Hub LLM models are available.
 */
export function AiSidebar(): JSX.Element {
  const dispatch = useAppDispatch();
  const aiSidebarVisible = useAppSelector(selectAiSidebarVisible);
  const historyOpen = useAppSelector(selectHistoryOpen);
  const enterToSend = useAppSelector(selectEnterToSend);
  const hubModelGroups = useAppSelector(selectHubModelGroups);
  const githubConnected = useAppSelector(selectGithubModelsConnected);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const { aiSettings, loading } = useAiAvailability();

  /**
   * Toolbar actions for chat history and enter-to-send.
   */
  const toolbarActions = useMemo((): ToolbarAction[] => {
    return [
      {
        id: 'chat-history',
        icon: faClockRotateLeft,
        label: 'Chat history',
        title: 'Chat history',
        ariaHaspopup: 'menu',
        ariaExpanded: historyOpen,
        buttonRef: historyButtonRef,
        onClick: () => dispatch(setHistoryOpen(!historyOpen)),
        popover: historyOpen ? (
          <ChatHistory
            anchorRef={historyButtonRef}
            onClose={() => dispatch(setHistoryOpen(false))}
            onOpenChat={(chatId) => {
              dispatch(setHistoryOpen(false));
              void dispatch(openExistingChat(chatId));
            }}
          />
        ) : undefined
      },
      {
        id: 'enter-to-send',
        icon: faCircleCheck,
        label: 'Enter to send',
        title: enterToSend ? 'Enter sends message' : 'Use Ctrl+Enter to send',
        ariaPressed: enterToSend,
        onClick: () => dispatch(setEnterToSend(!enterToSend))
      }
    ];
  }, [dispatch, enterToSend, historyOpen]);

  /**
   * Refreshes hub LLM models whenever the sidebar opens so newly added Team Hubs
   * are reflected without restarting the app.
   */
  useEffect(() => {
    if (!aiSidebarVisible) {
      return;
    }

    void dispatch(refreshHubLlmModels());
  }, [aiSidebarVisible, dispatch]);

  const showConfigurePrompt =
    !loading && !hasAvailableAiModels(aiSettings, hubModelGroups, githubConnected);
  const showChat = !loading && !showConfigurePrompt;

  return (
    <Sidebar
      side="right"
      ariaLabel="AI"
      scroll={false}
      storageKey="hc.aiSidebarWidth"
      defaultSize={320}
      minSize={240}
      getMaxSize={() => 640}
      resizeAriaLabel="Resize AI sidebar"
      header={<Toolbar ariaLabel="AI sidebar" actions={toolbarActions} />}
    >
      {showConfigurePrompt && <ConfigureApiKeysPrompt />}
      {showChat && <AiChat aiSettings={aiSettings} />}
    </Sidebar>
  );
}
