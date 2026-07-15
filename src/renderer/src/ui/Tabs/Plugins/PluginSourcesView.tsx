import { Button, Page } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import type { PluginSource, PluginSourcesSettings } from '#/shared/plugin/catalog';
import type { TeamHubPluginSourcesView } from '#/shared/types';
import { faGear } from '#/renderer/src/fontawesome';
import { SettingsView } from './SettingsView';
import type { SourceKind } from './types';

interface Props {
  /**
   * Draft plugin source settings edited on this page.
   */
  settings: PluginSourcesSettings;

  /**
   * Read-only plugin source rows provided by connected Team Hubs.
   */
  hubSources: TeamHubPluginSourcesView;

  /**
   * Whether settings are being loaded or saved.
   */
  busy: boolean;

  /**
   * Load or save error message shown on this page.
   */
  error: string | null;

  /**
   * Persists the draft settings.
   */
  onSave: () => void;

  /**
   * Replaces the draft with HarborClient default endpoints.
   */
  onResetDefaults: () => void;

  /**
   * Updates one draft source row.
   */
  onUpdateSource: (kind: SourceKind, index: number, source: PluginSource) => void;

  /**
   * Removes one draft source row.
   */
  onRemoveSource: (kind: SourceKind, index: number) => void;

  /**
   * Adds a new draft source row.
   */
  onAddSource: (kind: SourceKind, url: string) => string | null;
}

/**
 * Plugin marketplace catalog and trusted publisher endpoint configuration.
 */
export function PluginSourcesView({
  settings,
  hubSources,
  busy,
  error,
  onSave,
  onResetDefaults,
  onUpdateSource,
  onRemoveSource,
  onAddSource
}: Props): JSX.Element {
  return (
    <Page
      embedded
      title="Settings"
      icon={faGear}
      description="Configure where HarborClient loads marketplace catalogs and trusted publisher keys. Enabled endpoints are fetched in list order; the first source wins when entries overlap. Team Hub endpoints are managed by your hub administrator and cannot be removed here."
    >
      {error ? (
        <p className="mb-4 text-[14px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="max-w-2xl space-y-6">
        <SettingsView
          sectionId="plugin-catalog-sources"
          title="Catalog endpoints"
          description="JSON catalogs listing installable plugins for the Marketplace view."
          sources={settings.catalogs}
          hubSources={hubSources.catalogs}
          busy={busy}
          addFieldSettingId="plugins.addCatalogEndpointUrl"
          onAdd={(url) => onAddSource('catalogs', url)}
          onUpdate={(index, source) => onUpdateSource('catalogs', index, source)}
          onRemove={(index) => onRemoveSource('catalogs', index)}
        />
        <SettingsView
          sectionId="plugin-trusted-sources"
          title="Trusted publisher endpoints"
          description="JSON registries mapping publisher names to trusted signing key URLs."
          sources={settings.trusted}
          hubSources={hubSources.trusted}
          busy={busy}
          addFieldSettingId="plugins.addTrustedEndpointUrl"
          onAdd={(url) => onAddSource('trusted', url)}
          onUpdate={(index, source) => onUpdateSource('trusted', index, source)}
          onRemove={(index) => onRemoveSource('trusted', index)}
        />
      </div>

      <div className="mt-6 flex max-w-2xl flex-wrap justify-between gap-2 border-t border-separator pt-4">
        <Button type="button" variant="secondary" disabled={busy} onClick={onResetDefaults}>
          Reset defaults
        </Button>
        <Button type="button" disabled={busy} onClick={onSave}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Page>
  );
}
