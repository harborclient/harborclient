import { Badge, Button, Checkbox, FormGroup, Input } from '@harborclient/sdk/components';
import { useState, type JSX } from 'react';
import type { PluginSource } from '#/shared/plugin/catalog';
import { isHarborClientEndpoint } from '#/shared/plugin/catalog';
import type { TeamHubPluginSource } from '#/shared/types';
import type { FieldSettingId } from '#/renderer/src/ui/Tabs/Settings/catalog/catalog';
import { SettingField } from '#/renderer/src/ui/Tabs/Settings/components/SettingField';

import { parseDraftPluginSourceUrl } from './helpers';

interface Props {
  /**
   * Stable id prefix used for form control ids in this section.
   */
  sectionId: string;

  /**
   * Section heading shown above the endpoint list.
   */
  title: string;

  /**
   * Helper text describing what the endpoint list controls.
   */
  description: string;

  /**
   * Catalog or trusted endpoint rows in the draft settings.
   */
  sources: PluginSource[];

  /**
   * Whether the parent modal is loading or saving.
   */
  busy: boolean;

  /**
   * Adds a new endpoint row to this section.
   *
   * @param url - Endpoint URL to append.
   */
  onAdd: (url: string) => string | null;

  /**
   * Updates one endpoint row.
   *
   * @param index - Row index within the list.
   * @param source - Updated source row.
   */
  onUpdate: (index: number, source: PluginSource) => void;

  /**
   * Removes one endpoint row.
   *
   * @param index - Row index to remove.
   */
  onRemove: (index: number) => void;

  /**
   * Read-only plugin source rows provided by connected Team Hubs.
   */
  hubSources: TeamHubPluginSource[];

  /**
   * Catalog setting id for the add-endpoint field in this section.
   */
  addFieldSettingId: FieldSettingId;
}

/**
 * Renders one editable list of plugin catalog or trusted-key endpoints.
 */
export function SettingsView({
  sectionId,
  title,
  description,
  sources,
  hubSources,
  busy,
  onAdd,
  onUpdate,
  onRemove,
  addFieldSettingId
}: Props): JSX.Element {
  const [draftUrl, setDraftUrl] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingUntrustedUrl, setPendingUntrustedUrl] = useState<string | null>(null);

  /**
   * Attempts to add the current draft URL to the section list.
   */
  const handleAdd = (): void => {
    try {
      const trimmed = parseDraftPluginSourceUrl(draftUrl);
      if (
        sources.some((source) => source.url === trimmed) ||
        hubSources.some((source) => source.url === trimmed)
      ) {
        setAddError('That endpoint is already in the list.');
        return;
      }

      const error = onAdd(trimmed);
      if (error) {
        setAddError(error);
        return;
      }

      if (!isHarborClientEndpoint(trimmed)) {
        setPendingUntrustedUrl(trimmed);
      }

      setDraftUrl('');
      setAddError(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : String(err));
    }
  };

  const addInputId = `${sectionId}-add-url`;
  const addErrorId = `${sectionId}-add-error`;
  const untrustedWarningId = `${sectionId}-untrusted-warning`;

  return (
    <section className="space-y-3" aria-labelledby={`${sectionId}-title`}>
      <div>
        <h3 id={`${sectionId}-title`} className="m-0 font-medium text-text">
          {title}
        </h3>
        <p className="m-0 mt-1 text-muted">{description}</p>
      </div>

      {sources.length === 0 && hubSources.length === 0 ? (
        <p className="m-0 text-[14px] text-muted" role="status">
          No endpoints configured.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0 mb-3">
          {sources.map((source, index) => {
            const checkboxId = `${sectionId}-enabled-${index}`;
            const untrusted = !isHarborClientEndpoint(source.url);

            return (
              <li
                key={source.url}
                className="flex flex-wrap items-center gap-2 rounded-md border border-separator bg-control p-3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Checkbox
                    id={checkboxId}
                    checked={source.enabled}
                    disabled={busy}
                    aria-label={`Enable ${source.url}`}
                    onChange={(event) => {
                      onUpdate(index, { ...source, enabled: event.target.checked });
                    }}
                  />
                  <div className="min-w-0 flex-1 mt-1">
                    <FormGroup
                      label={source.url}
                      htmlFor={checkboxId}
                      layout="associated"
                      labelClassName="block break-all text-[14px] text-text"
                      className="p-0! m-0!"
                    />
                    {untrusted ? (
                      <Badge variant="danger" className="mt-1">
                        Untrusted source
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="primaryDanger"
                  disabled={busy}
                  aria-label={`Remove ${source.url}`}
                  onClick={() => onRemove(index)}
                >
                  Remove
                </Button>
              </li>
            );
          })}
          {hubSources.map((source) => {
            const checkboxId = `${sectionId}-hub-${source.hubId}-${source.url}`;

            return (
              <li
                key={`${source.hubId}:${source.url}`}
                className="flex flex-wrap items-start gap-2 rounded-md border border-separator bg-control p-3"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <Checkbox
                    id={checkboxId}
                    className="mt-1"
                    checked
                    disabled
                    aria-label={`${source.url} from ${source.hubName}`}
                    readOnly
                  />
                  <div className="min-w-0 flex-1">
                    <FormGroup
                      label={source.url}
                      htmlFor={checkboxId}
                      layout="associated"
                      labelClassName="block break-all text-[14px] text-text"
                    />
                    <Badge variant="category" className="mt-1">
                      From {source.hubName}
                    </Badge>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sources.some((source) => !isHarborClientEndpoint(source.url)) ? (
        <p id={untrustedWarningId} className="m-0 text-[14px] text-danger" role="alert">
          Third-party endpoints can list or vouch for unverified plugins. Only add catalogs and
          trusted-key registries from sources you trust.
        </p>
      ) : null}

      <div className="mt-4">
        <SettingField
          settingId={addFieldSettingId}
          htmlFor={addInputId}
          error={addError}
          errorId={addErrorId}
        >
          <div className="flex flex-wrap gap-2">
            <Input
              id={addInputId}
              type="url"
              className="min-w-[min(100%,20rem)] flex-1"
              placeholder="https://example.com/plugin_catalog.json"
              value={draftUrl}
              disabled={busy}
              aria-invalid={addError ? true : undefined}
              aria-describedby={
                [addError ? addErrorId : null, pendingUntrustedUrl ? untrustedWarningId : null]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              onChange={(event) => {
                setDraftUrl(event.target.value);
                setAddError(null);
                setPendingUntrustedUrl(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAdd();
                }
              }}
            />
            <Button type="button" variant="secondary" disabled={busy} onClick={handleAdd}>
              Add
            </Button>
          </div>
        </SettingField>
        {pendingUntrustedUrl ? (
          <p id={untrustedWarningId} className="mt-2 text-[14px] text-danger" role="alert">
            {pendingUntrustedUrl} is not hosted on harborclient.com. Third-party endpoints can list
            or vouch for unverified plugins. Only add this source if you trust it.
          </p>
        ) : null}
      </div>
    </section>
  );
}
