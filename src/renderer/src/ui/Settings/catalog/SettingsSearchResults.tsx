import { Button, Page } from '@harborclient/sdk/components';
import type { JSX } from 'react';

import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectSettingsDraftLoadError } from '#/renderer/src/store/slices/settingsDraftSlice';
import type { SettingsSection } from '#/shared/types';

import { SettingsSaveFooter } from '../components/SettingsSaveFooter';
import { entryById, type FieldSettingId, type SettingId } from './catalog';
import { renderSettingFields } from './registry';

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
}

/**
 * Inline load/save error message for search results that include form fields.
 */
function SettingsDraftError(): JSX.Element | null {
  const error = useAppSelector(selectSettingsDraftLoadError);
  if (!error) {
    return null;
  }

  return (
    <p className="mb-4 text-[14px] text-danger" role="alert">
      {error}
    </p>
  );
}

/**
 * Renders settings search results as inline field controls and section navigation cards.
 */
export function SettingsSearchResults({ matchedIds, query, onNavigate }: Props): JSX.Element {
  const fieldIds = matchedIds.filter((id): id is FieldSettingId => entryById(id).kind === 'field');
  const sectionIds = matchedIds.filter((id) => entryById(id).kind === 'section');
  const groupIds = matchedIds.filter((id) => entryById(id).kind === 'group');

  return (
    <Page embedded className="mb-6 flex flex-col" title="Search results">
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
              <SettingsSaveFooter />
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
