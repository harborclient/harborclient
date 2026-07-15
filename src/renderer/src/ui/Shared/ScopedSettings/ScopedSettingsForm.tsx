import {
  Button,
  cleanVariables,
  ModalFooter,
  Page,
  SegmentedTabs,
  SegmentedTabPanel,
  SegmentedTabsGroup
} from '@harborclient/sdk/components';
import { useCallback, useEffect, useMemo, useState, type JSX, type ReactNode } from 'react';
import type { AuthConfig, KeyValue, ScriptRef, Variable } from '#/shared/types';
import { ensureDefaultScriptRef, hasScriptContent } from '#/shared/scriptRefs';
import { VariablesSection } from '#/renderer/src/ui/CollectionSettings/VariablesSection';
import { ScriptSection } from '#/renderer/src/ui/CollectionSettings/ScriptSection';
import {
  COLLECTION_PRE_REQUEST_SCRIPT_PLACEHOLDER,
  POST_REQUEST_SCRIPT_PLACEHOLDER
} from '#/renderer/src/ui/Shared/Script/scriptPlaceholders';
import {
  cleanHeaders,
  cleanScopedSettingsCoreFields,
  seedScopedSettingsHeaders,
  seedScopedSettingsVariables,
  serializeScopedSettingsForm,
  type ScopedSettingsCoreFields
} from '#/renderer/src/ui/Shared/ScopedSettings/scopedSettingsForm';

/**
 * Live scoped settings form state and setters passed to render-prop sections.
 */
export interface ScopedSettingsRenderState extends ScopedSettingsCoreFields {
  /**
   * Updates the draft display name.
   */
  setName: (name: string) => void;

  /**
   * Updates the draft variables table.
   */
  setVariables: (variables: Variable[]) => void;

  /**
   * Updates the draft headers table.
   */
  setHeaders: (headers: KeyValue[]) => void;

  /**
   * Updates the draft authorization settings.
   */
  setAuth: (auth: AuthConfig) => void;

  /**
   * Updates pre-request script references.
   */
  setPreRequestScripts: (scripts: ScriptRef[]) => void;

  /**
   * Updates post-request script references.
   */
  setPostRequestScripts: (scripts: ScriptRef[]) => void;

  /**
   * True while a save request is in flight.
   */
  saving: boolean;

  /**
   * Validates and persists the form; no-ops when save is disabled.
   */
  save: () => void;
}

/**
 * Optional tab injected before or after the shared built-in tabs.
 */
export interface ScopedSettingsExtraTab {
  /**
   * SegmentedTabs value for this panel.
   */
  value: string;

  /**
   * Tab strip label.
   */
  label: string;

  /**
   * When true, shows a dot indicator on the tab.
   */
  indicator?: boolean;

  /**
   * Where to insert the tab relative to the shared tab block.
   */
  position: 'afterGeneral' | 'afterScripts';

  /**
   * Optional className for the tab panel wrapper.
   */
  panelClassName?: string;

  /**
   * Renders the tab panel body.
   *
   * @param state - Current form state and setters.
   */
  panel: (state: ScopedSettingsRenderState) => ReactNode;
}

interface Props {
  /**
   * Page title shown in the settings header.
   */
  title: string;

  /**
   * Page description shown below the title.
   */
  description: string;

  /**
   * Accessible name for the tab list.
   */
  ariaLabel: string;

  /**
   * Optional extra classes on the embedded Page wrapper.
   */
  pageClassName?: string;

  /**
   * Persisted snapshot used to seed state and detect dirty edits.
   */
  initial: ScopedSettingsCoreFields;

  /**
   * When set, switches to the Variables tab and focuses the matching row.
   */
  focusVariableKey?: string;

  /**
   * Renders the General tab panel.
   */
  renderGeneral: (state: ScopedSettingsRenderState) => ReactNode;

  /**
   * Renders the Headers tab panel.
   */
  renderHeaders: (state: ScopedSettingsRenderState) => ReactNode;

  /**
   * Renders the Authorization tab panel.
   */
  renderAuth: (state: ScopedSettingsRenderState) => ReactNode;

  /**
   * Helper copy for the pre-request script section.
   */
  preScriptDescription: string;

  /**
   * Helper copy for the post-request script section.
   */
  postScriptDescription: string;

  /**
   * Additional tabs such as Git or plugin contributions.
   */
  extraTabs?: ScopedSettingsExtraTab[];

  /**
   * Subset of tab values shown in the strip (VisibilityMenu support).
   */
  visibleTabValues?: string[];

  /**
   * Called when the user toggles tab visibility.
   */
  onVisibleTabValuesChange?: (nextVisibleTabValues: string[]) => void;

  /**
   * Additional dirty signals outside core fields (e.g. git or connection).
   */
  extraDirty?: boolean;

  /**
   * When false, dirty state is suppressed until async bootstrap completes.
   */
  dirtyReady?: boolean;

  /**
   * When true, the Save button and save handler are blocked.
   */
  disableSave?: boolean;

  /**
   * Persists cleaned core fields after validation succeeds.
   *
   * @param fields - Trimmed name and cleaned variables/headers.
   */
  onSave: (fields: ScopedSettingsCoreFields) => Promise<void>;

  /**
   * Closes the settings view without saving.
   */
  onClose: () => void;

  /**
   * Called when unsaved form edits appear or are cleared.
   */
  onDirtyChange?: (dirty: boolean) => void;
}

/**
 * Shared tabbed settings shell for collection and folder scoped configuration.
 * Owns core field state, dirty tracking, script tab seeding, and save skeleton;
 * callers inject scope-specific General/Headers/Auth panels and optional extra tabs.
 */
export function ScopedSettingsForm({
  title,
  description,
  ariaLabel,
  pageClassName,
  initial,
  focusVariableKey,
  renderGeneral,
  renderHeaders,
  renderAuth,
  preScriptDescription,
  postScriptDescription,
  extraTabs = [],
  visibleTabValues,
  onVisibleTabValuesChange,
  extraDirty = false,
  dirtyReady = true,
  disableSave = false,
  onSave,
  onClose,
  onDirtyChange
}: Props): JSX.Element {
  const [tab, setTab] = useState<string>(focusVariableKey ? 'variables' : 'general');
  const [lastFocusVariableKey, setLastFocusVariableKey] = useState(focusVariableKey);

  if (focusVariableKey && focusVariableKey !== lastFocusVariableKey) {
    setLastFocusVariableKey(focusVariableKey);
    if (tab !== 'variables') {
      setTab('variables');
    }
  }

  const [name, setName] = useState(initial.name);
  const [variables, setVariables] = useState<Variable[]>(() =>
    seedScopedSettingsVariables(initial.variables)
  );
  const [headers, setHeaders] = useState<KeyValue[]>(() =>
    seedScopedSettingsHeaders(initial.headers)
  );
  const [auth, setAuth] = useState<AuthConfig>(initial.auth);
  const [preRequestScripts, setPreRequestScripts] = useState<ScriptRef[]>(
    initial.preRequestScripts
  );
  const [postRequestScripts, setPostRequestScripts] = useState<ScriptRef[]>(
    initial.postRequestScripts
  );
  const [saving, setSaving] = useState(false);

  const currentFields = useMemo(
    (): ScopedSettingsCoreFields => ({
      name,
      variables,
      headers,
      auth,
      preRequestScripts,
      postRequestScripts
    }),
    [name, variables, headers, auth, preRequestScripts, postRequestScripts]
  );

  /**
   * Whether core fields differ from the persisted snapshot or extraDirty is set.
   */
  const isDirty = useMemo(
    () =>
      dirtyReady &&
      (serializeScopedSettingsForm(currentFields) !== serializeScopedSettingsForm(initial) ||
        extraDirty),
    [currentFields, initial, extraDirty, dirtyReady]
  );

  /**
   * Notifies the parent when unsaved edits appear or are cleared.
   */
  useEffect(() => {
    onDirtyChange?.(Boolean(isDirty));
  }, [isDirty, onDirtyChange]);

  /**
   * Dot indicators for tabs whose sections have content configured.
   */
  const tabIndicators = useMemo(
    () => ({
      variables: cleanVariables(variables).length > 0,
      headers: cleanHeaders(headers).length > 0,
      auth: auth.type !== 'none',
      pre: hasScriptContent(preRequestScripts),
      post: hasScriptContent(postRequestScripts)
    }),
    [variables, headers, auth, preRequestScripts, postRequestScripts]
  );

  const tabsAfterGeneral = useMemo(
    () => extraTabs.filter((entry) => entry.position === 'afterGeneral'),
    [extraTabs]
  );

  const tabsAfterScripts = useMemo(
    () => extraTabs.filter((entry) => entry.position === 'afterScripts'),
    [extraTabs]
  );

  /**
   * Built-in and injected tabs merged for SegmentedTabs.
   */
  const tabs = useMemo(
    () => [
      { value: 'general', label: 'General' },
      ...tabsAfterGeneral.map((entry) => ({
        value: entry.value,
        label: entry.label,
        indicator: entry.indicator
      })),
      { value: 'variables', label: 'Variables', indicator: tabIndicators.variables },
      { value: 'headers', label: 'Headers', indicator: tabIndicators.headers },
      { value: 'auth', label: 'Authorization', indicator: tabIndicators.auth },
      { value: 'pre', label: 'PreRequest', indicator: tabIndicators.pre },
      { value: 'post', label: 'PostRequest', indicator: tabIndicators.post },
      ...tabsAfterScripts.map((entry) => ({
        value: entry.value,
        label: entry.label,
        indicator: entry.indicator
      }))
    ],
    [tabsAfterGeneral, tabsAfterScripts, tabIndicators]
  );

  /**
   * Validates name, persists cleaned fields, then closes on success.
   */
  const handleSave = useCallback(async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName || disableSave) {
      return;
    }

    setSaving(true);
    try {
      await onSave(cleanScopedSettingsCoreFields(currentFields));
      onClose();
    } finally {
      setSaving(false);
    }
  }, [name, disableSave, onSave, currentFields, onClose]);

  const renderState = useMemo(
    (): ScopedSettingsRenderState => ({
      name,
      variables,
      headers,
      auth,
      preRequestScripts,
      postRequestScripts,
      setName,
      setVariables,
      setHeaders,
      setAuth,
      setPreRequestScripts,
      setPostRequestScripts,
      saving,
      save: () => {
        void handleSave();
      }
    }),
    [name, variables, headers, auth, preRequestScripts, postRequestScripts, saving, handleSave]
  );

  /**
   * Seeds a blank inline script when entering a script tab with no entries yet.
   *
   * @param nextTab - Settings tab the user selected.
   */
  const handleTabChange = (nextTab: string): void => {
    if (nextTab === 'pre' && preRequestScripts.length === 0) {
      setPreRequestScripts(ensureDefaultScriptRef(preRequestScripts));
    }
    if (nextTab === 'post' && postRequestScripts.length === 0) {
      setPostRequestScripts(ensureDefaultScriptRef(postRequestScripts));
    }
    setTab(nextTab);
  };

  return (
    <Page
      embedded
      className={['flex min-h-0 flex-1 flex-col p-6 pt-0!', pageClassName ?? '']
        .filter(Boolean)
        .join(' ')}
      title={title}
      description={description}
    >
      <SegmentedTabsGroup value={tab} onChange={handleTabChange} ariaLabel={ariaLabel}>
        <div className="-mx-6 -mt-3 mb-6 shrink-0">
          <SegmentedTabs
            tabs={tabs}
            visibleTabValues={visibleTabValues}
            onVisibleTabValuesChange={onVisibleTabValuesChange}
          />
        </div>

        <div className="hc-scroll-stable -mx-6 flex min-h-0 flex-1 flex-col overflow-y-auto px-6">
          <SegmentedTabPanel value="general">{renderGeneral(renderState)}</SegmentedTabPanel>
          {tabsAfterGeneral.map((entry) => (
            <SegmentedTabPanel
              key={entry.value}
              value={entry.value}
              className={entry.panelClassName}
            >
              {entry.panel(renderState)}
            </SegmentedTabPanel>
          ))}
          <SegmentedTabPanel value="variables">
            <VariablesSection
              variables={variables}
              onChange={setVariables}
              focusVariableKey={focusVariableKey}
            />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="headers">{renderHeaders(renderState)}</SegmentedTabPanel>
          <SegmentedTabPanel value="auth">{renderAuth(renderState)}</SegmentedTabPanel>
          <SegmentedTabPanel value="pre" className="flex min-h-0 flex-1 flex-col">
            <ScriptSection
              phase="pre"
              description={preScriptDescription}
              placeholder={COLLECTION_PRE_REQUEST_SCRIPT_PLACEHOLDER}
              scripts={preRequestScripts}
              onChange={setPreRequestScripts}
              variables={variables}
            />
          </SegmentedTabPanel>
          <SegmentedTabPanel value="post" className="flex min-h-0 flex-1 flex-col">
            <ScriptSection
              phase="post"
              description={postScriptDescription}
              placeholder={POST_REQUEST_SCRIPT_PLACEHOLDER}
              scripts={postRequestScripts}
              onChange={setPostRequestScripts}
              variables={variables}
            />
          </SegmentedTabPanel>
          {tabsAfterScripts.map((entry) => (
            <SegmentedTabPanel
              key={entry.value}
              value={entry.value}
              className={entry.panelClassName}
            >
              {entry.panel(renderState)}
            </SegmentedTabPanel>
          ))}
          <ModalFooter spaced>
            <Button
              onClick={() => void handleSave()}
              disabled={!name.trim() || disableSave || saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </ModalFooter>
        </div>
      </SegmentedTabsGroup>
    </Page>
  );
}
