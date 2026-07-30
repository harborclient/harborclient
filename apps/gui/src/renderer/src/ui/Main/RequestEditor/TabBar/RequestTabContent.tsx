import { FaIcon, Spinner } from '@harborclient/sdk/components';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { useState, type JSX } from 'react';
import { isBrowserTab, isMarkdownTab, isPageTab, type Tab } from '#/renderer/src/store/tabs';
import { faFileLines, faGlobe } from '#/renderer/src/fontawesome';
import { METHOD_CLASSES } from '#/renderer/src/ui/Shared/classes';

interface Props {
  /**
   * Tab data to render.
   */
  tab: Tab;

  /**
   * Display title for page tabs (resolved from entity names when applicable).
   */
  pageTitle?: string;

  /**
   * Icon for page tabs.
   */
  pageIcon?: IconDefinition;

  /**
   * Whether this tab has unsaved changes (request, markdown, browser, or Themes page).
   */
  dirty?: boolean;
}

/**
 * Label and icon content for a single request editor tab row.
 */
export function RequestTabContent({ tab, pageTitle, pageIcon, dirty = false }: Props): JSX.Element {
  const isPage = isPageTab(tab);
  const isMarkdown = isMarkdownTab(tab);
  const isBrowser = isBrowserTab(tab);
  const [brokenFaviconUrl, setBrokenFaviconUrl] = useState<string | null>(null);
  const faviconDataUrl = isBrowser ? tab.faviconDataUrl : null;
  const showFavicon = Boolean(faviconDataUrl) && brokenFaviconUrl !== faviconDataUrl;

  /**
   * Marks the current favicon as unloadable so the globe fallback is shown.
   */
  const handleFaviconError = (): void => {
    if (faviconDataUrl) {
      setBrokenFaviconUrl(faviconDataUrl);
    }
  };

  return (
    <>
      {isPage ? (
        pageIcon && <FaIcon icon={pageIcon} className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : isMarkdown ? (
        <FaIcon icon={faFileLines} className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : isBrowser ? (
        showFavicon && faviconDataUrl ? (
          <img
            src={faviconDataUrl}
            alt=""
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 object-contain"
            onError={handleFaviconError}
          />
        ) : (
          <FaIcon icon={faGlobe} className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )
      ) : (
        <>
          <span
            className={`shrink-0 px-1 py-px text-[14px] ${METHOD_CLASSES[tab.draft.method.toLowerCase()] ?? 'text-info'}`}
          >
            {tab.draft.method}
          </span>
          {tab.sending && <Spinner size="sm" label="Sending…" className="h-3.5 w-3.5 shrink-0" />}
        </>
      )}
      <span
        className={`truncate text-[14px] ${dirty ? 'text-tab-unsaved' : ''} ${
          (isPage && pageIcon) || isBrowser || isMarkdown ? 'ms-1.5' : ''
        }`}
      >
        {isPage
          ? (pageTitle ?? 'Page')
          : isMarkdown
            ? tab.name
            : isBrowser
              ? tab.title || 'Browser'
              : tab.draft.name}
      </span>
    </>
  );
}
