import { Suspense, useEffect, type JSX } from 'react';
import { Spinner } from '@harborclient/sdk/components';
import { pluginContributionId } from '#/shared/plugin/types';
import { usePluginMainViews } from '#/renderer/src/plugins/pluginHooks';
import { getPageRoute } from '#/renderer/src/store/routing';
import type { PageRef } from '#/renderer/src/store/tabs';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  selectCollections,
  selectEnvironments,
  selectFoldersByCollection
} from '#/renderer/src/store/selectors';

interface Props {
  /**
   * Active page tab identity.
   */
  page: PageRef;

  /**
   * Tab id hosting this page (used to close stale or saved tabs).
   */
  tabId: string;
}

/**
 * Renders the configuration page content for an active page tab via the route registry.
 */
export function PageTabContent({ page, tabId }: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
  const pluginViews = usePluginMainViews();
  const route = getPageRoute(page.type);
  const PageComponent = route.Component;

  /**
   * Drops page tabs whose backing entity or plugin view no longer exists.
   */
  useEffect(() => {
    if (page.type === 'collection') {
      const exists = collections.some((collection) => collection.id === page.id);
      if (!exists) {
        dispatch(closeTab(tabId));
      }
      return;
    }

    if (page.type === 'collection-runner') {
      if (page.requestIds != null && page.requestIds.length > 0) {
        return;
      }
      const exists = collections.some((collection) => collection.id === page.collectionId);
      if (!exists) {
        dispatch(closeTab(tabId));
      }
      return;
    }

    if (page.type === 'environment') {
      const exists = environments.some((environment) => environment.id === page.id);
      if (!exists) {
        dispatch(closeTab(tabId));
      }
      return;
    }

    if (page.type === 'folder') {
      const exists = (foldersByCollection[page.collectionId] ?? []).some(
        (folder) => folder.id === page.id
      );
      if (!exists) {
        dispatch(closeTab(tabId));
      }
      return;
    }

    if (page.type === 'hosted-main-view') {
      const namespacedId = pluginContributionId(page.pluginId, page.viewId);
      const exists = pluginViews.some(
        (view) => view.pluginId === page.pluginId && view.id === namespacedId
      );
      if (!exists) {
        dispatch(closeTab(tabId));
      }
    }
  }, [page, tabId, collections, environments, foldersByCollection, pluginViews, dispatch]);

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
          <Spinner />
        </div>
      }
    >
      <PageComponent page={page as never} tabId={tabId} />
    </Suspense>
  );
}
