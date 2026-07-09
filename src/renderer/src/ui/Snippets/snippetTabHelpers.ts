import type { AppDispatch } from '#/renderer/src/store/redux';
import type { SnippetEditTabMode } from '#/renderer/src/store/drafts';
import { openPageTab } from '#/renderer/src/store/slices/tabsSlice';

/**
 * Minimal identity for opening a snippet bundle detail tab.
 */
export type SnippetCatalogDetailTarget = {
  id: string;
  name: string;
};

/**
 * Opens or focuses a tab showing one marketplace snippet bundle listing.
 *
 * @param dispatch - Redux dispatch function.
 * @param entry - Marketplace listing or installed package identity to inspect.
 */
export function openSnippetCatalogDetailTab(
  dispatch: AppDispatch,
  entry: SnippetCatalogDetailTarget
): void {
  dispatch(
    openPageTab({
      type: 'snippet-detail',
      catalogId: entry.id,
      label: entry.name
    })
  );
}

/**
 * Opens or focuses a tab for creating, editing, cloning, or importing a snippet.
 *
 * @param dispatch - Redux dispatch function.
 * @param options - Snippet edit tab identity and seed data.
 */
export function openSnippetEditTab(
  dispatch: AppDispatch,
  options: {
    mode: SnippetEditTabMode;
    snippetId?: number;
    readOnly?: boolean;
    seedCode?: string;
    label: string;
  }
): void {
  dispatch(
    openPageTab({
      type: 'snippet-edit',
      mode: options.mode,
      snippetId: options.snippetId,
      readOnly: options.readOnly,
      seedCode: options.seedCode,
      label: options.label
    })
  );
}
