import { useMemo, useState, type JSX } from 'react';
import type { BrowserTab } from '#/renderer/src/store/tabs';
import { useAppDispatch } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
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
   * Hosting page-tab id for close and File → Save registration.
   */
  tabId: string;
}

/**
 * Collection-style settings form for one open browser / live page tab.
 *
 * Remount via `key={browserTab.tabId}` so injection drafts reseed when the linked
 * browser tab changes.
 *
 * @param props - Linked browser tab and hosting settings tab id.
 * @returns Tabbed live page settings form.
 */
export function LivePageSettingsForm({ browserTab, tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const [injectionScripts, setInjectionScripts] = useState<BrowserInjectionScript[]>(() =>
    browserTab.scripts.map((script) => ({ ...script }))
  );

  /**
   * Seeds ScopedSettingsForm from the linked browser tab's draft fields.
   */
  const initial = useMemo((): ScopedSettingsCoreFields => {
    return {
      name: browserTab.title,
      variables: browserTab.variables,
      headers: browserTab.headers,
      userAgent: browserTab.userAgent,
      auth: browserTab.auth,
      preRequestScripts: browserTab.pre_request_scripts,
      postRequestScripts: browserTab.post_request_scripts
    };
  }, [browserTab]);

  const injectionDirty = areBrowserScriptsDirty(injectionScripts, browserTab.savedScripts);

  /**
   * Extra Injection tab after Pre/Post scripts.
   */
  const extraTabs = useMemo((): ScopedSettingsExtraTab[] => {
    return [
      {
        value: 'injection',
        label: 'Injection',
        indicator: injectionScripts.some(
          (script) => script.enabled && script.source.trim().length > 0
        ),
        position: 'afterScripts',
        panel: () => <InjectionSection scripts={injectionScripts} onChange={setInjectionScripts} />
      }
    ];
  }, [injectionScripts]);

  /**
   * Closes this settings tab.
   */
  function handleClose(): void {
    dispatch(closeTab(tabId));
  }

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
          scripts: injectionScripts
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
      tabId={tabId}
      extraDirty={injectionDirty}
      extraTabs={extraTabs}
      scriptAllowedStages={[...BROWSER_SCRIPT_STAGES]}
      preScriptDescription="Runs in the HarborClient script sandbox before each chrome-driven navigation. Use hc.request to inspect or change the target URL."
      postScriptDescription="Runs after the page finishes loading. hc.response exposes the page URL, status, and HTML snapshot."
      renderGeneral={(state: ScopedSettingsRenderState) => (
        <LivePageGeneralSection
          name={state.name}
          onNameChange={state.setName}
          onSave={state.save}
          onClose={handleClose}
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
      onClose={handleClose}
    />
  );
}
