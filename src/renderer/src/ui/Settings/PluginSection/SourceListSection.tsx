import { useState, type JSX } from 'react';
import type { PluginSource } from '#/shared/plugin/catalog';
import { isHarborClientEndpoint } from '#/shared/plugin/catalog';
import type { TeamHubPluginSource } from '#/shared/types';
import { Button } from '#/renderer/src/components/Button';
import { Input } from '#/renderer/src/components/forms';
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
}

/**
 * Renders one editable list of plugin catalog or trusted-key endpoints.
 */
export function SourceListSection({
  sectionId,
  title,
  description,
  sources,
  hubSources,
  busy,
  onAdd,
  onUpdate,
  onRemove
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
        <h3 id={`${sectionId}-title`} className="m-0 text-[14px] font-medium text-text">
          {title}
        </h3>
        <p className="m-0 mt-1 text-[14px] text-muted">{description}</p>
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
                className="flex flex-wrap items-start gap-2 rounded-md border border-separator bg-control p-3"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="mt-1"
                    checked={source.enabled}
                    disabled={busy}
                    aria-label={`Enable ${source.url}`}
                    onChange={(event) => {
                      onUpdate(index, { ...source, enabled: event.target.checked });
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={checkboxId} className="block break-all text-[14px] text-text">
                      {source.url}
                    </label>
                    {untrusted ? (
                      <span className="mt-1 inline-block rounded bg-danger/20 px-1.5 py-0.5 text-[14px] text-danger">
                        Untrusted source
                      </span>
                    ) : null}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
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
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="mt-1"
                    checked
                    disabled
                    aria-label={`${source.url} from ${source.hubName}`}
                    readOnly
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={checkboxId} className="block break-all text-[14px] text-text">
                      {source.url}
                    </label>
                    <span className="mt-1 inline-block rounded bg-accent/15 px-1.5 py-0.5 text-[14px] text-text">
                      From {source.hubName}
                    </span>
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

      <div>
        <label htmlFor={addInputId} className="mb-1 block text-[14px] text-muted">
          Add endpoint URL
        </label>
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
        {addError ? (
          <p id={addErrorId} className="mt-2 text-[14px] text-danger" role="alert">
            {addError}
          </p>
        ) : null}
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
