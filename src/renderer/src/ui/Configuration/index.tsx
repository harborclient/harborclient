import type { JSX } from 'react';
import type {
  AuthConfig,
  Collection,
  Environment,
  KeyValue,
  SettingsSection,
  Variable
} from '#/shared/types';
import { SharingKeys } from '#/renderer/src/ui/SharingKeys';
import { TeamHubs } from '#/renderer/src/ui/TeamHubs';
import { CollectionSettings } from '../CollectionSettings';
import { EnvironmentSettings } from '../EnvironmentSettings';
import { Settings } from '../Settings';
import { PluginMainView } from '../PluginMainView';

interface Props {
  /**
   * Whether app settings are shown.
   */
  showSettings: boolean;

  /**
   * Closes application settings.
   */
  onCloseAppSettings: () => void;

  /**
   * Settings section to show when app settings open.
   */
  settingsSection: SettingsSection;

  /**
   * Whether the sharing keys view is shown.
   */
  showSharingKeys: boolean;

  /**
   * Closes the sharing keys view.
   */
  onCloseSharingKeys: () => void;

  /**
   * Whether the team hubs view is shown.
   */
  showTeamHubs: boolean;

  /**
   * Closes the team hubs view.
   */
  onCloseTeamHubs: () => void;

  /**
   * Whether a plugin main view overlay is shown.
   */
  showPluginView: boolean;

  /**
   * Plugin manifest id for the active plugin view overlay.
   */
  pluginViewPluginId?: string;

  /**
   * Plugin view contribution id for the active overlay.
   */
  pluginViewId?: string;

  /**
   * Closes the plugin main view overlay.
   */
  onClosePluginView: () => void;

  /**
   * Collection being configured, if any.
   */
  collection: Collection | undefined;

  /**
   * Called when collection settings form edits appear or are cleared.
   */
  onCollectionDirtyChange: (dirty: boolean) => void;

  /**
   * Persists collection name, variables, headers, scripts, and database.
   */
  onCollectionSave: (
    id: number,
    name: string,
    variables: Variable[],
    headers: KeyValue[],
    preRequestScript: string,
    postRequestScript: string,
    auth: AuthConfig,
    connectionId: string
  ) => Promise<Collection | void>;

  /**
   * Closes collection settings without saving.
   */
  onCloseCollectionSettings: () => void;

  /**
   * Environment being configured, if any.
   */
  environment: Environment | undefined;

  /**
   * Called when environment settings form edits appear or are cleared.
   */
  onEnvironmentDirtyChange: (dirty: boolean) => void;

  /**
   * Persists environment name and variables.
   */
  onEnvironmentSave: (id: number, name: string, variables: Variable[]) => Promise<void>;

  /**
   * Closes environment settings without saving.
   */
  onCloseEnvironmentSettings: () => void;
}

/**
 * Main-area configuration views: app, collection, and environment settings.
 */
export function Configuration({
  showSettings,
  onCloseAppSettings,
  settingsSection,
  showSharingKeys,
  onCloseSharingKeys,
  showTeamHubs,
  onCloseTeamHubs,
  showPluginView,
  pluginViewPluginId,
  pluginViewId,
  onClosePluginView,
  collection,
  onCollectionDirtyChange,
  onCollectionSave,
  onCloseCollectionSettings,
  environment,
  onEnvironmentDirtyChange,
  onEnvironmentSave,
  onCloseEnvironmentSettings
}: Props): JSX.Element | null {
  if (showSettings) {
    return (
      <Settings
        key={settingsSection}
        onClose={onCloseAppSettings}
        initialSection={settingsSection}
      />
    );
  }

  if (showSharingKeys) {
    return <SharingKeys onClose={onCloseSharingKeys} />;
  }

  if (showTeamHubs) {
    return <TeamHubs onClose={onCloseTeamHubs} />;
  }

  if (showPluginView && pluginViewPluginId && pluginViewId) {
    return (
      <PluginMainView
        pluginId={pluginViewPluginId}
        viewId={pluginViewId}
        onClose={onClosePluginView}
      />
    );
  }

  if (collection) {
    return (
      <CollectionSettings
        collection={collection}
        onDirtyChange={onCollectionDirtyChange}
        onSave={onCollectionSave}
        onClose={onCloseCollectionSettings}
      />
    );
  }

  if (environment) {
    return (
      <EnvironmentSettings
        environment={environment}
        onDirtyChange={onEnvironmentDirtyChange}
        onSave={onEnvironmentSave}
        onClose={onCloseEnvironmentSettings}
      />
    );
  }

  return null;
}
