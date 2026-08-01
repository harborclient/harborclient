import { useCallback, useMemo, useState, type JSX } from 'react';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { setBrowserScripts, updateBrowserTab } from '#/renderer/src/store/slices/tabsSlice';
import { saveLivePageSettings } from '#/renderer/src/store/thunks/websites';
import { areBrowserScriptsDirty, type BrowserInjectionScript } from '#/browser/browserScripts';
import {
  ScopedSettingsForm,
  type ScopedSettingsExtraTab,
  type ScopedSettingsRenderState
} from '#/renderer/src/ui/Shared/ScopedSettings/ScopedSettingsForm';
import type { ScopedSettingsCoreFields } from '#/renderer/src/ui/Shared/ScopedSettings/scopedSettingsCore';
import { ScopedHeadersSection } from '#/renderer/src/ui/Shared/ScopedSettings/ScopedHeadersSection';
import { ScopedAuthSection } from '#/renderer/src/ui/Shared/ScopedSettings/ScopedAuthSection';
import { LivePageGeneralSection } from '#/renderer/src/ui/Tabs/LivePageSettings/LivePageGeneralSection';
import { InjectionSection } from '#/renderer/src/ui/Tabs/LivePageSettings/InjectionSection';
import { formatErrorMessage, showAlert } from '#/renderer/src/ui/Modals/dialogHelpers';

const BROWSER_SCRIPT_STAGES = ['main'] as const;

interface Props {
  /**
   * Browser tab whose settings are being edited.
   */
  browserTab: BrowserTab;

  /**
   * Closes the settings panel without navigating away from the live page tab.
   */
  onClose: () => void;
}

/**
 * Collection-style settings form for one open browser / live page tab.
 *
 * Remount via `key={browserTab.tabId}` so injection drafts reseed when the linked
 * browser tab changes. Hosted in the slide-down panel under browser chrome.
 *
 * Drafts sync into the browser tab so unsaved edits survive panel close and tab
 * switches; dirty state ambers the tab and prompts on close like request tabs.
 *
 * @param props - Linked browser tab and close handler.
 * @returns Tabbed live page settings form.
 */
export function LivePageSettingsForm({ browserTab, onClose }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const website = useAppSelector((state) =>
    state.websites.items.find((item) => item.id === browserTab.websiteId)
  );
  const [connectionId, setConnectionId] = useState(website?.connectionId ?? '');

  /**
   * Saved baselines for ScopedSettingsForm dirty comparison.
   */
  const initial = useMemo((): ScopedSettingsCoreFields => {
    return {
      name: browserTab.savedTitle,
      variables: browserTab.savedVariables,
      headers: browserTab.savedHeaders,
      userAgent: browserTab.savedUserAgent,
      auth: browserTab.savedAuth,
      preRequestScripts: browserTab.savedPreRequestScripts,
      postRequestScripts: browserTab.savedPostRequestScripts
    };
  }, [browserTab]);

  /**
   * Current drafts so remounts restore unsaved edits.
   */
  const seed = useMemo((): ScopedSettingsCoreFields => {
    return {
      name: browserTab.settingsName,
      variables: browserTab.variables,
      headers: browserTab.headers,
      userAgent: browserTab.userAgent,
      auth: browserTab.auth,
      preRequestScripts: browserTab.pre_request_scripts,
      postRequestScripts: browserTab.post_request_scripts
    };
  }, [browserTab]);

  const injectionDirty = areBrowserScriptsDirty(browserTab.scripts, browserTab.savedScripts);

  /**
   * Persists injection script drafts on the browser tab as the user edits.
   *
   * @param scripts - Updated injection script list.
   */
  const handleInjectionChange = useCallback(
    (scripts: BrowserInjectionScript[]): void => {
      dispatch(setBrowserScripts({ tabId: browserTab.tabId, scripts }));
    },
    [browserTab.tabId, dispatch]
  );

  /**
   * Extra Injection tab after Pre/Post scripts.
   */
  const extraTabs = useMemo((): ScopedSettingsExtraTab[] => {
    return [
      {
        value: 'injection',
        label: 'Injection',
        indicator: browserTab.scripts.some(
          (script) => script.enabled && script.source.trim().length > 0
        ),
        position: 'afterScripts',
        panel: () => (
          <InjectionSection scripts={browserTab.scripts} onChange={handleInjectionChange} />
        )
      }
    ];
  }, [browserTab.scripts, handleInjectionChange]);

  /**
   * Writes core field drafts to the browser tab so they survive remounts.
   *
   * @param fields - Current form draft fields.
   */
  const handleDraftChange = useCallback(
    (fields: ScopedSettingsCoreFields): void => {
      dispatch(
        updateBrowserTab({
          tabId: browserTab.tabId,
          updates: {
            settingsName: fields.name,
            variables: fields.variables,
            headers: fields.headers,
            userAgent: fields.userAgent,
            auth: fields.auth,
            pre_request_scripts: fields.preRequestScripts,
            post_request_scripts: fields.postRequestScripts
          }
        })
      );
    },
    [browserTab.tabId, dispatch]
  );

  /**
   * Persists cleaned core fields plus injection scripts to tab/guest/registry.
   *
   * @param fields - Cleaned scoped settings core fields.
   */
  async function handleSave(fields: ScopedSettingsCoreFields): Promise<void> {
    try {
      await dispatch(
        saveLivePageSettings({
          tabId: browserTab.tabId,
          name: fields.name,
          variables: fields.variables,
          headers: fields.headers,
          userAgent: fields.userAgent,
          auth: fields.auth,
          preRequestScripts: fields.preRequestScripts,
          postRequestScripts: fields.postRequestScripts,
          scripts: browserTab.scripts,
          connectionId
        })
      ).unwrap();
    } catch (error) {
      showAlert(dispatch, formatErrorMessage(error, 'Failed to save live page settings'));
      throw error;
    }
  }

  return (
    <ScopedSettingsForm
      title="Live Page Settings"
      description="Manage live page settings and configuration."
      ariaLabel="Live page settings sections"
      initial={initial}
      seed={seed}
      tabId={browserTab.tabId}
      extraDirty={injectionDirty}
      extraTabs={extraTabs}
      scriptAllowedStages={[...BROWSER_SCRIPT_STAGES]}
      preScriptDescription="Runs in the HarborClient script sandbox before each chrome-driven navigation. Use hc.request to inspect or change the target URL."
      postScriptDescription="Runs after the page finishes loading. hc.response exposes the page URL, status, and HTML snapshot."
      renderGeneral={(state: ScopedSettingsRenderState) => (
        <LivePageGeneralSection
          name={state.name}
          connectionId={connectionId}
          onNameChange={state.setName}
          onConnectionIdChange={setConnectionId}
          onSave={state.save}
          onClose={onClose}
        />
      )}
      renderHeaders={(state: ScopedSettingsRenderState) => (
        <ScopedHeadersSection
          scope="website"
          headers={state.headers}
          userAgent={state.userAgent}
          variables={state.variables}
          onChange={state.setHeaders}
          onUserAgentChange={state.setUserAgent}
          disabled={state.saving}
        />
      )}
      renderAuth={(state: ScopedSettingsRenderState) => (
        <ScopedAuthSection
          scope="website"
          id={browserTab.websiteId ?? browserTab.tabId}
          auth={state.auth}
          variables={state.variables}
          onChange={state.setAuth}
        />
      )}
      onSave={handleSave}
      onClose={onClose}
      onDraftChange={handleDraftChange}
    />
  );
}
