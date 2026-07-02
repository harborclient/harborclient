import { ResizeHandle, useResizable } from '@harborclient/sdk/components';
import { useEffect, useState, type JSX } from 'react';
import type { AiSettings, HubLlmModelGroup } from '#/shared/types';
import { hasAvailableAiModels } from '#/shared/aiModels';

import { DEFAULT_AI_SETTINGS } from '#/renderer/src/ui/Settings/constants';
import { ConfigureApiKeysPrompt } from './ConfigureApiKeysPrompt';
import { AiChat } from './Chat';

/**
 * Right-side AI panel shell. Shows a configure-keys prompt when no API keys exist.
 */
export function AiSidebar(): JSX.Element {
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
        {showConfigurePrompt && <ConfigureApiKeysPrompt />}
        {showChat && <AiChat aiSettings={aiSettings} />}
      </aside>
    </>
  );
}
