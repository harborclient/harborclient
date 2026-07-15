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
  setEnvironmentSettingsDirty,
  setFolderSettingsDirty
} from '#/renderer/src/store/slices/navigationSlice';
import { closeTab, openPageTab } from '#/renderer/src/store/slices/tabsSlice';
import {
  selectCollections,
  selectEnvironments,
  selectFoldersByCollection
} from '#/renderer/src/store/selectors';
import { updateCollection, updateEnvironment, updateFolder } from '#/renderer/src/store/thunks';
import { CollectionSettings } from '#/renderer/src/ui/Tabs/CollectionSettings';
import { FolderSettings } from '#/renderer/src/ui/Tabs/FolderSettings';
import { CollectionRunner } from '#/renderer/src/ui/Tabs/CollectionRunner';
import { Cookies } from '#/renderer/src/ui/Tabs/Cookies';
import { EnvironmentSettings } from '#/renderer/src/ui/Tabs/EnvironmentSettings';
import { HostedMainView } from '#/renderer/src/ui/HostedMainView';
import { Plugins } from '#/renderer/src/ui/Tabs/Plugins';
import { PluginDetailPage } from '#/renderer/src/ui/Tabs/Plugins/PluginDetailPage';
import { ScriptEditorTab } from '#/renderer/src/ui/Main/RequestEditor/ScriptEditorTab';
import { MergeEditorTab } from '#/renderer/src/ui/Main/RequestEditor/MergeEditorTab';
import { Settings } from '#/renderer/src/ui/Tabs/Settings';
import { SharingKeys } from '#/renderer/src/ui/Tabs/SharingKeys';
import { Snippets } from '#/renderer/src/ui/Tabs/Snippets';
import { SnippetDetailPage } from '#/renderer/src/ui/Tabs/Snippets/SnippetDetailPage';
import { SnippetEditPage } from '#/renderer/src/ui/Tabs/Snippets/SnippetEditPage';
import { TeamHub } from '#/renderer/src/ui/Tabs/TeamHub';
import { TeamHubAdmin } from '#/renderer/src/ui/Tabs/TeamHub/TeamHubAdmin';
import { GettingStartedPage } from '#/renderer/src/ui/GettingStarted/GettingStartedPage';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

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
  const foldersByCollection = useAppSelector(selectFoldersByCollection);
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

  if (page.type === 'getting-started') {
    return <GettingStartedPage />;
  }

  if (page.type === 'settings') {
    return (
      <Settings
        key="settings"
        initialSection={page.section}
        focusVariableKey={page.focusVariableKey}
        focusSettingId={page.focusSettingId}
      />
    );
  }

  if (page.type === 'sharing-keys') {
    return <SharingKeys />;
  }

  if (page.type === 'team-hubs') {
    return <TeamHub />;
  }

  if (page.type === 'team-hub-admin') {
    return <TeamHubAdmin hubId={page.hubId} onClose={handleClose} />;
  }

  if (page.type === 'plugins') {
    return <Plugins kind="plugins" />;
  }

  if (page.type === 'themes') {
    return <Plugins kind="themes" />;
  }

  if (page.type === 'cookies') {
    return <Cookies />;
  }

  if (page.type === 'snippets') {
    return <Snippets />;
  }

  if (page.type === 'plugin-detail') {
    return <PluginDetailPage page={page} tabId={tabId} />;
  }

  if (page.type === 'snippet-detail') {
    return <SnippetDetailPage page={page} tabId={tabId} />;
  }

  if (page.type === 'snippet-edit') {
    return <SnippetEditPage page={page} tabId={tabId} />;
  }

  if (page.type === 'script-editor') {
    return <ScriptEditorTab page={page} tabId={tabId} />;
  }

  if (page.type === 'merge-editor') {
    return <MergeEditorTab page={page} tabId={tabId} />;
  }

  if (page.type === 'hosted-main-view') {
    return <HostedMainView pluginId={page.pluginId} viewId={page.viewId} onClose={handleClose} />;
  }

  if (page.type === 'collection') {
    const collection = collections.find((entry) => entry.id === page.id);
    if (!collection) {
      return null;
    }

    return (
      <CollectionSettings
        collection={collection}
        focusVariableKey={page.focusVariableKey}
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

  if (page.type === 'folder') {
    const folder = (foldersByCollection[page.collectionId] ?? []).find(
      (entry) => entry.id === page.id
    );
    if (!folder) {
      return null;
    }

    return (
      <FolderSettings
        folder={folder}
        focusVariableKey={page.focusVariableKey}
        onDirtyChange={(dirty) => dispatch(setFolderSettingsDirty(dirty))}
        onSave={async (
          id: number,
          collectionId: number,
          name: string,
          variables: Variable[],
          headers: KeyValue[],
          preRequestScripts: ScriptRef[],
          postRequestScripts: ScriptRef[],
          auth: AuthConfig
        ) => {
          try {
            await dispatch(
              updateFolder({
                id,
                collectionId,
                name,
                variables,
                headers,
                preRequestScript: mirrorLegacyScriptString(preRequestScripts),
                postRequestScript: mirrorLegacyScriptString(postRequestScripts),
                preRequestScripts,
                postRequestScripts,
                auth
              })
            ).unwrap();
            toast.success('Folder updated');
          } catch (err) {
            showAlert(dispatch, formatErrorMessage(err, 'Failed to update folder'));
            throw err;
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
        focusVariableKey={page.focusVariableKey}
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

  if (page.type === 'collection-runner') {
    return <CollectionRunner page={page} />;
  }

  return null;
}
