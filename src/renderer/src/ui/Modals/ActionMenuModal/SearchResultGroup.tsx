import type { JSX } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FaIcon } from '@harborclient/sdk/components';
import {
  SEARCH_DOMAIN_LABELS,
  sidebarRequestBreadcrumb,
  type SearchDomain,
  type SidebarSearchInput,
  type UnifiedSearchHit
} from '#/shared/search';
import {
  faFolder,
  faGear,
  faGlobe,
  faPalette,
  faPaperPlane,
  faPuzzlePiece,
  faCode
} from '#/renderer/src/fontawesome';
import { METHOD_CLASSES } from '#/renderer/src/ui/Shared/classes';
import { InlineBreadcrumbPrefix } from './InlineBreadcrumbPrefix';
import { searchResultRowClass } from './searchResultRowClass';

/**
 * Domain icons shown beside grouped result section headings.
 */
const DOMAIN_ICONS: Record<SearchDomain, IconDefinition> = {
  collection: faFolder,
  folder: faFolder,
  request: faPaperPlane,
  environment: faGlobe,
  setting: faGear,
  page: faCode,
  plugin: faPuzzlePiece,
  theme: faPalette,
  snippet: faCode
};

/**
 * Builds an accessible label for a plugin or theme search result row.
 *
 * @param hit - Unified search hit for an installed or marketplace plugin/theme.
 */
function pluginSearchResultLabel(hit: UnifiedSearchHit): string | undefined {
  if (hit.domain !== 'plugin' && hit.domain !== 'theme') {
    return undefined;
  }

  const sourceLabel = hit.pluginListingSource === 'installed' ? 'Installed' : 'Marketplace';
  return `${sourceLabel}, ${hit.title}`;
}

/**
 * Builds an accessible label for a request search result row.
 *
 * @param hit - Unified search hit for a saved request.
 * @param breadcrumb - Resolved collection and folder names for the request.
 */
function requestSearchResultLabel(
  hit: UnifiedSearchHit,
  breadcrumb: ReturnType<typeof sidebarRequestBreadcrumb>
): string | undefined {
  if (hit.domain !== 'request') {
    return undefined;
  }

  const parts = [breadcrumb.collectionName, breadcrumb.folderName, hit.method, hit.title].filter(
    (part): part is string => part != null && part.length > 0
  );
  return parts.length > 0 ? parts.join(', ') : undefined;
}

interface Props {
  /**
   * Domain category for this result group.
   */
  domain: SearchDomain;

  /**
   * Hits belonging to this domain.
   */
  hits: UnifiedSearchHit[];

  /**
   * Index of the globally highlighted hit, if any.
   */
  activeIndex: number;

  /**
   * Flat ordered list index offset for the first hit in this group.
   */
  indexOffset: number;

  /**
   * Sidebar data used to resolve request breadcrumb names.
   */
  sidebarInput: SidebarSearchInput;

  /**
   * Activates a hit on click or Enter.
   */
  onActivate: (hit: UnifiedSearchHit) => void;

  /**
   * Updates keyboard highlight when the pointer hovers a row.
   */
  onHighlight: (flatIndex: number) => void;
}

/**
 * Renders one domain group with a sidebar-style section heading and result rows.
 */
export function SearchResultGroup({
  domain,
  hits,
  activeIndex,
  indexOffset,
  sidebarInput,
  onActivate,
  onHighlight
}: Props): JSX.Element {
  return (
    <div className="mb-2 min-w-0">
      <div className="mb-1 flex items-center gap-2 bg-sidebar-section px-2 py-1">
        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
          <FaIcon icon={DOMAIN_ICONS[domain]} className="h-3 w-3 text-muted" aria-hidden />
        </span>
        <h2 className="m-0 text-[14px] font-medium uppercase tracking-wide text-muted">
          {SEARCH_DOMAIN_LABELS[domain]}
        </h2>
      </div>
      <ul
        className="m-0 min-w-0 list-none p-0"
        role="listbox"
        aria-label={SEARCH_DOMAIN_LABELS[domain]}
      >
        {hits.map((hit, localIndex) => {
          const flatIndex = indexOffset + localIndex;
          const isActive = flatIndex === activeIndex;
          const requestBreadcrumb =
            hit.domain === 'request'
              ? sidebarRequestBreadcrumb(sidebarInput, hit.collectionId, hit.folderId)
              : null;
          const requestLabel =
            requestBreadcrumb != null
              ? requestSearchResultLabel(hit, requestBreadcrumb)
              : undefined;
          const pluginLabel = pluginSearchResultLabel(hit);
          const rowLabel = requestLabel ?? pluginLabel;

          return (
            <li
              key={`${hit.domain}:${hit.id}:${hit.pluginListingSource ?? 'default'}`}
              role="presentation"
              className="min-w-0"
              onMouseEnter={() => onHighlight(flatIndex)}
            >
              <button
                type="button"
                role="option"
                id={`action-menu-result-${flatIndex}`}
                aria-current={isActive ? 'true' : undefined}
                aria-label={rowLabel}
                className={searchResultRowClass(isActive)}
                onClick={() => onActivate(hit)}
              >
                {hit.domain === 'request' ? (
                  <span className="flex min-w-0 w-full items-center gap-1">
                    <InlineBreadcrumbPrefix
                      collectionName={requestBreadcrumb?.collectionName}
                      folderName={requestBreadcrumb?.folderName}
                    />
                    {hit.method != null ? (
                      <span
                        className={`shrink-0 px-1 py-px ${METHOD_CLASSES[hit.method.toLowerCase()] ?? 'text-info'}`}
                      >
                        {hit.method}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                  </span>
                ) : hit.domain === 'plugin' || hit.domain === 'theme' ? (
                  <span className="flex min-w-0 w-full items-center gap-1">
                    <InlineBreadcrumbPrefix
                      collectionName={
                        hit.pluginListingSource === 'installed' ? 'Installed' : 'Marketplace'
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">{hit.title}</span>
                  </span>
                ) : (
                  <span className="min-w-0 w-full truncate">{hit.title}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
