import { FaIcon, Spinner } from '@harborclient/sdk/components';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { JSX } from 'react';
import { isMarkdownTab, isPageTab, type Tab } from '#/renderer/src/store/tabs';
import { faFileLines } from '#/renderer/src/fontawesome';
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
   * Whether this tab has unsaved changes (request, markdown, or Themes page).
   */
  dirty?: boolean;
}

/**
 * Label and icon content for a single request editor tab row.
 */
export function RequestTabContent({ tab, pageTitle, pageIcon, dirty = false }: Props): JSX.Element {
  const isPage = isPageTab(tab);
  const isMarkdown = isMarkdownTab(tab);

  return (
    <>
      {isPage ? (
        pageIcon && <FaIcon icon={pageIcon} className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : isMarkdown ? (
        <FaIcon icon={faFileLines} className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
          isPage && pageIcon ? 'ms-1.5' : ''
        }`}
      >
        {isPage ? (pageTitle ?? 'Page') : isMarkdown ? tab.name : tab.draft.name}
      </span>
    </>
  );
}
