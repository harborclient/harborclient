import { Button, Page } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import type { SettingsSection } from '#/shared/types';

import { SettingsSaveAction } from '../../components/SettingsSaveAction';
import { entryById, type FieldSettingId, type SettingId } from '../catalog';
import { renderSettingFields } from '../registry';
import { SettingsDraftError } from '../SettingsDraftError';

interface Props {
  /**
   * Setting ids matching the current search query in catalog order.
   */
  matchedIds: SettingId[];

  /**
   * Raw search text shown in the empty-state message.
   */
  query: string;

  /**
   * Opens a management section from search results and clears the active query.
   */
  onNavigate: (section: SettingsSection, focusSettingId?: string) => void;

  /**
   * Hosting tab id so File → Save / Ctrl+S can persist draft fields in search results.
   */
  tabId?: string;
}

/**
 * Renders settings search results as inline field controls and section navigation cards.
 */
export function SettingsSearchResults({
  matchedIds,
  query,
  onNavigate,
  tabId
}: Props): JSX.Element {
  const fieldIds = matchedIds.filter((id): id is FieldSettingId => entryById(id).kind === 'field');
  const sectionIds = matchedIds.filter((id) => entryById(id).kind === 'section');
  const groupIds = matchedIds.filter((id) => entryById(id).kind === 'group');

  return (
    <Page
      embedded
      className="mb-6 flex flex-col"
      title="Search results"
      actions={fieldIds.length > 0 ? <SettingsSaveAction tabId={tabId} /> : undefined}
    >
      {matchedIds.length === 0 ? (
        <p className="text-[14px] text-muted" role="status">
          No settings match &ldquo;{query.trim()}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {fieldIds.length > 0 ? (
            <div className="flex flex-col gap-6">
              <SettingsDraftError />
              {renderSettingFields(fieldIds)}
            </div>
          ) : null}

          {sectionIds.length > 0 ? (
            <div className="flex flex-col gap-3">
              {sectionIds.map((id) => {
                const entry = entryById(id);
                if (entry.kind !== 'section') {
                  return null;
                }

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-md border border-separator bg-sidebar px-4 py-3"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-[14px] font-medium text-text">{entry.label}</span>
                      <p className="m-0 text-[14px] text-muted">{entry.description}</p>
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onNavigate(entry.section)}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {groupIds.length > 0 ? (
            <div className="flex flex-col gap-3">
              {groupIds.map((id) => {
                const entry = entryById(id);
                if (entry.kind !== 'group') {
                  return null;
                }

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-md border border-separator bg-sidebar px-4 py-3"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-[14px] font-medium text-text">{entry.label}</span>
                      <p className="m-0 text-[14px] text-muted">{entry.description}</p>
                    </div>
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onNavigate(entry.section, entry.id)}
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </Page>
  );
}
