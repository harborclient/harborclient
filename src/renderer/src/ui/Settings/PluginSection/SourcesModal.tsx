import type { JSX } from 'react';
import type { PluginSource, PluginSourcesSettings } from '#/shared/plugin/catalog';
import type { TeamHubPluginSourcesView } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { Modal } from '#/renderer/src/components/Modal';
import { SourceListSection } from './SourceListSection';
import type { SourceKind } from './types';

interface Props {
  /**
   * Draft plugin source settings edited in the modal.
   */
  settings: PluginSourcesSettings;

  /**
   * Whether settings are being loaded or saved.
   */
  busy: boolean;

  /**
   * Load or save error message shown inside the modal.
   */
  error: string | null;

  /**
   * Closes the modal without saving.
   */
  onClose: () => void;

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
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index within the list.
   * @param source - Updated source row.
   */
  onUpdateSource: (kind: SourceKind, index: number, source: PluginSource) => void;

  /**
   * Removes one draft source row.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param index - Row index to remove.
   */
  onRemoveSource: (kind: SourceKind, index: number) => void;

  /**
   * Adds a new draft source row.
   *
   * @param kind - Catalog or trusted endpoint list being edited.
   * @param url - Endpoint URL to append.
   */
  onAddSource: (kind: SourceKind, url: string) => string | null;

  /**
   * Read-only plugin source rows provided by connected Team Hubs.
   */
  hubSources: TeamHubPluginSourcesView;
}

/**
 * Modal for configuring plugin marketplace catalog and trusted publisher endpoints.
 */
export function SourcesModal({
  settings,
  hubSources,
  busy,
  error,
  onClose,
  onSave,
  onResetDefaults,
  onUpdateSource,
  onRemoveSource,
  onAddSource
}: Props): JSX.Element {
  return (
    <Modal
      onClose={onClose}
      className="w-[min(42rem,calc(100vw-2rem))]"
      labelledBy="plugin-sources-title"
    >
      <h2 id="plugin-sources-title" className="m-0 mb-2 text-[15px] font-semibold text-text">
        Plugin sources
      </h2>
      <p className="mb-4 text-[14px] text-muted">
        Configure where HarborClient loads marketplace catalogs and trusted publisher keys. Enabled
        endpoints are fetched in list order; the first source wins when entries overlap. Team Hub
        endpoints are managed by your hub administrator and cannot be removed here.
      </p>

      {error ? (
        <p className="mb-4 text-[14px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="max-h-[min(32rem,60vh)] space-y-6 overflow-y-auto pr-1">
        <SourceListSection
          sectionId="plugin-catalog-sources"
          title="Catalog endpoints"
          description="JSON catalogs listing installable plugins for the Marketplace view."
          sources={settings.catalogs}
          hubSources={hubSources.catalogs}
          busy={busy}
          onAdd={(url) => onAddSource('catalogs', url)}
          onUpdate={(index, source) => onUpdateSource('catalogs', index, source)}
          onRemove={(index) => onRemoveSource('catalogs', index)}
        />
        <SourceListSection
          sectionId="plugin-trusted-sources"
          title="Trusted publisher endpoints"
          description="JSON registries mapping publisher names to trusted signing key URLs."
          sources={settings.trusted}
          hubSources={hubSources.trusted}
          busy={busy}
          onAdd={(url) => onAddSource('trusted', url)}
          onUpdate={(index, source) => onUpdateSource('trusted', index, source)}
          onRemove={(index) => onRemoveSource('trusted', index)}
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-separator pt-4">
        <Button type="button" variant="secondary" disabled={busy} onClick={onResetDefaults}>
          Reset defaults
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={onSave}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
