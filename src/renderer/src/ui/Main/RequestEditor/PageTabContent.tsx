import { useEffect, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { AuthConfig, KeyValue, ScriptRef, Variable } from '#/shared/types';
import { mirrorLegacyScriptString } from '#/shared/scriptRefs';
import { pluginContributionId } from '#/shared/plugin/types';
import { usePluginMainViews } from '#/renderer/src/plugins/pluginHooks';
import type { PageRef } from '#/renderer/src/store/drafts';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import {
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty
} from '#/renderer/src/store/slices/navigationSlice';
import { closeTab, openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import { selectCollections, selectEnvironments } from '#/renderer/src/store/selectors';
import { updateCollection, updateEnvironment } from '#/renderer/src/store/thunks';
import { CollectionSettings } from '#/renderer/src/ui/CollectionSettings';
import { EnvironmentSettings } from '#/renderer/src/ui/EnvironmentSettings';
import { PluginMainView } from '#/renderer/src/ui/PluginMainView';
import { Plugins } from '#/renderer/src/ui/Plugins';
import { Settings } from '#/renderer/src/ui/Settings';
import { SharingKeys } from '#/renderer/src/ui/SharingKeys';
import { TeamHub } from '#/renderer/src/ui/TeamHub';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/modals/dialogHelpers';

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
 * Renders the configuration page content for an active page tab.
 */
export function PageTabContent({ page, tabId }: Props): JSX.Element | null {
  const dispatch = useAppDispatch();
  const collections = useAppSelector(selectCollections);
  const environments = useAppSelector(selectEnvironments);
  const pluginViews = usePluginMainViews();

  /**
   * Closes this page tab when the user finishes or dismisses the page.
   */
  const handleClose = (): void => {
    dispatch(closeTab(tabId));
  };

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

    if (page.type === 'environment') {
      const exists = environments.some((environment) => environment.id === page.id);
      if (!exists) {
        dispatch(closeTab(tabId));
      }
      return;
    }

    if (page.type === 'plugin-view') {
      const namespacedId = pluginContributionId(page.pluginId, page.viewId);
      const exists = pluginViews.some(
        (view) => view.pluginId === page.pluginId && view.id === namespacedId
      );
      if (!exists) {
        dispatch(closeTab(tabId));
      }
    }
  }, [page, tabId, collections, environments, pluginViews, dispatch]);

  if (page.type === 'settings') {
    return <Settings key="settings" initialSection={page.section} />;
  }

  if (page.type === 'sharing-keys') {
    return <SharingKeys />;
  }

  if (page.type === 'team-hubs') {
    return <TeamHub onClose={handleClose} />;
  }

  if (page.type === 'plugins') {
    return <Plugins kind="plugins" />;
  }

  if (page.type === 'themes') {
    return <Plugins kind="themes" />;
  }

  if (page.type === 'plugin-view') {
    return <PluginMainView pluginId={page.pluginId} viewId={page.viewId} onClose={handleClose} />;
  }

  if (page.type === 'collection') {
    const collection = collections.find((entry) => entry.id === page.id);
    if (!collection) {
      return null;
    }

    return (
      <CollectionSettings
        collection={collection}
        onDirtyChange={(dirty) => dispatch(setCollectionSettingsDirty(dirty))}
        onSave={async (
          id: number,
          name: string,
          variables: Variable[],
          headers: KeyValue[],
          preRequestScripts: ScriptRef[],
          postRequestScripts: ScriptRef[],
          auth: AuthConfig,
          connectionId: string
        ) => {
          try {
            const result = await dispatch(
              updateCollection({
                id,
                name,
                variables,
                headers,
                preRequestScript: mirrorLegacyScriptString(preRequestScripts),
                postRequestScript: mirrorLegacyScriptString(postRequestScripts),
                preRequestScripts,
                postRequestScripts,
                auth,
                connectionId
              })
            ).unwrap();
            if (result.id !== id) {
              dispatch(closeTab(tabId));
              dispatch(openPageTab({ type: 'collection', id: result.id }));
            }
            toast.success('Collection updated');
          } catch (err) {
            showAlert(dispatch, formatErrorMessage(err, 'Failed to update collection'));
          }
        }}
        onClose={handleClose}
      />
    );
  }

  if (page.type === 'environment') {
    const environment = environments.find((entry) => entry.id === page.id);
    if (!environment) {
      return null;
    }

    return (
      <EnvironmentSettings
        environment={environment}
        onDirtyChange={(dirty) => dispatch(setEnvironmentSettingsDirty(dirty))}
        onSave={async (id: number, name: string, variables: Variable[]) => {
          try {
            await dispatch(updateEnvironment({ id, name, variables })).unwrap();
            toast.success('Environment updated');
          } catch (err) {
            showAlert(dispatch, formatErrorMessage(err, 'Failed to update environment'));
          }
        }}
        onClose={handleClose}
      />
    );
  }

  return null;
}
