import {
  Toolbar,
  type ToolbarAction,
  ResizeHandle,
  useResizable
} from '@harborclient/sdk/components';
import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { AiSettings, HubLlmModelGroup } from '#/shared/types';
import { hasAvailableAiModels } from '#/shared/aiModels';

import { faClockRotateLeft, faPaperPlane, faPlus, faXmark } from '#/renderer/src/fontawesome';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setShowAiSidebar } from '#/renderer/src/store/slices/navigationSlice';
import {
  selectEnterToSend,
  selectHistoryOpen,
  setEnterToSend,
  setHistoryOpen
} from '#/renderer/src/store/slices/aiChatSlice';
import { createNewChat, openExistingChat } from '#/renderer/src/store/thunks/aiChat';
import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Settings/constants';
import { ChatHistory } from './Chat/ChatHistory';
import { ConfigureApiKeysPrompt } from './ConfigureApiKeysPrompt';
import { AiChat } from './Chat';

/**
 * Right-side AI panel shell. Shows a configure-keys prompt when no API keys exist.
 */
export function AiSidebar(): JSX.Element {
  const dispatch = useAppDispatch();
  const historyOpen = useAppSelector(selectHistoryOpen);
  const enterToSend = useAppSelector(selectEnterToSend);
  const historyButtonRef = useRef<HTMLButtonElement>(null);
  const [aiSettings, setAiSettings] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [hubModelGroups, setHubModelGroups] = useState<HubLlmModelGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const {
    size: width,
    minSize: sidebarMinSize,
    maxSize: sidebarMaxSize,
    onResizeStart,
    onKeyboardResize
  } = useResizable({
    axis: 'x',
    direction: -1,
    defaultSize: 320,
    minSize: 240,
    getMaxSize: () => 640,
    storageKey: 'hc.aiSidebarWidth'
  });

  /**
   * Loads AI settings on mount so the empty-state prompt reflects stored keys.
   */
  useEffect(() => {
    let cancelled = false;

    const loadSettings = async (): Promise<void> => {
      try {
        const [value, hubs] = await Promise.all([
          window.api.getAiSettings(),
          window.api.listHubLlmModels()
        ]);
        if (!cancelled) {
          setAiSettings(value);
          setHubModelGroups(hubs);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Toolbar actions for closing the AI sidebar, chat history, and new chat.
   */
  const toolbarActions = useMemo((): ToolbarAction[] => {
    return [
      {
        id: 'close-ai-sidebar',
        icon: faXmark,
        label: 'Close AI sidebar',
        title: 'Close AI sidebar',
        onClick: () => dispatch(setShowAiSidebar(false))
      },
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
        id: 'new-chat',
        icon: faPlus,
        label: 'New chat',
        title: 'New chat',
        onClick: () => void dispatch(createNewChat(aiSettings))
      },
      {
        id: 'enter-to-send',
        icon: faPaperPlane,
        label: 'Enter to send',
        title: enterToSend ? 'Enter sends message' : 'Use Ctrl+Enter to send',
        ariaPressed: enterToSend,
        onClick: () => dispatch(setEnterToSend(!enterToSend))
      }
    ];
  }, [aiSettings, dispatch, enterToSend, historyOpen]);

  const showConfigurePrompt = !loading && !hasAvailableAiModels(aiSettings, hubModelGroups);
  const showChat = !loading && !showConfigurePrompt;

  return (
    <>
      <ResizeHandle
        orientation="vertical"
        value={width}
        min={sidebarMinSize}
        max={sidebarMaxSize}
        onResizeStart={onResizeStart}
        onKeyboardResize={onKeyboardResize}
        ariaLabel="Resize AI sidebar"
        className="border-r-0 border-l border-separator"
      />
      <aside
        className="flex min-h-0 shrink-0 flex-col bg-surface"
        style={{ width }}
        aria-label="AI"
      >
        <Toolbar ariaLabel="AI sidebar" actions={toolbarActions} />
        {showConfigurePrompt && <ConfigureApiKeysPrompt />}
        {showChat && <AiChat aiSettings={aiSettings} />}
      </aside>
    </>
  );
}
