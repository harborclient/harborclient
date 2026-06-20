import type { JSX } from 'react';
import type { Collection, Environment, KeyValue, Variable } from '#/shared/types';
import { Certificates } from '#/renderer/src/ui/Certificates';
import { CollectionSettings } from '../CollectionSettings';
import { EnvironmentSettings } from '../EnvironmentSettings';
import { Settings } from '../Settings';

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
   * Whether the certificates view is shown.
   */
  showCertificates: boolean;

  /**
   * Closes the certificates view.
   */
  onCloseCertificates: () => void;

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
  showCertificates,
  onCloseCertificates,
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
    return <Settings onClose={onCloseAppSettings} />;
  }

  if (showCertificates) {
    return <Certificates onClose={onCloseCertificates} />;
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
