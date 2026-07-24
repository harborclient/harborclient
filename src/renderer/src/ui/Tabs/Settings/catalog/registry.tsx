import type { ComponentType, JSX } from 'react';
import type { SettingsSection } from '#/shared/types';

import { AiInfoExtra } from '../extras/AiInfoExtra';
import { GeneralInfoExtra } from '../extras/GeneralInfoExtra';
import { ProxyInfoExtra } from '../extras/ProxyInfoExtra';
import { SyntaxSectionLeading } from '../extras/SyntaxSectionLeading';
import { AiSettingsExtras } from '../extras/AiSettingsExtras';
import { BackupRestoreSection } from '../BackupRestoreSection';
import { GitIdentitiesSection } from '../GitIdentitiesSection';
import { GlobalsSection } from '../GlobalsSection';
import { ShortcutsSection } from '../ShortcutsSection';
import { StorageLocationsSection } from '../StorageLocationsSection';
import { AiClaudeApiKeyField } from '../fields/AiClaudeApiKeyField';
import { AiGeminiApiKeyField } from '../fields/AiGeminiApiKeyField';
import { AiOpenAiApiKeyField } from '../fields/AiOpenAiApiKeyField';
import { GeneralFollowRedirectsField } from '../fields/GeneralFollowRedirectsField';
import { GeneralLogFilePathField } from '../fields/GeneralLogFilePathField';
import { GeneralScrollbarAutoHideField } from '../fields/GeneralScrollbarAutoHideField';
import { GeneralSpellCheckEnabledField } from '../fields/GeneralSpellCheckEnabledField';
import { GeneralWrapTabsField } from '../fields/GeneralWrapTabsField';
import { GeneralCloseToTrayField } from '../fields/GeneralCloseToTrayField';
import { GeneralMaxResponseSizeField } from '../fields/GeneralMaxResponseSizeField';
import { GeneralRequestTimeoutField } from '../fields/GeneralRequestTimeoutField';
import { GeneralScriptTimeoutField } from '../fields/GeneralScriptTimeoutField';
import { GeneralAllowScriptNetworkRequestsField } from '../fields/GeneralAllowScriptNetworkRequestsField';
import { GeneralAllowScriptFileReadField } from '../fields/GeneralAllowScriptFileReadField';
import { GeneralAllowScriptFileWriteField } from '../fields/GeneralAllowScriptFileWriteField';
import { GeneralScriptFileRootField } from '../fields/GeneralScriptFileRootField';
import { GeneralVerifySslField } from '../fields/GeneralVerifySslField';
import { ProxyAuthEnabledField } from '../fields/ProxyAuthEnabledField';
import { ProxyEnabledField } from '../fields/ProxyEnabledField';
import { ProxyHostField } from '../fields/ProxyHostField';
import { ProxyPasswordField } from '../fields/ProxyPasswordField';
import { ProxyPortField } from '../fields/ProxyPortField';
import { ProxyProtocolField } from '../fields/ProxyProtocolField';
import { ProxyUsernameField } from '../fields/ProxyUsernameField';
import { SyntaxCodeEditorFontSizeField } from '../fields/SyntaxCodeEditorFontSizeField';
import { SyntaxCodeEditorThemeField } from '../fields/SyntaxCodeEditorThemeField';
import { SyntaxFoldGutterField } from '../fields/SyntaxFoldGutterField';
import { SyntaxHighlightActiveLineField } from '../fields/SyntaxHighlightActiveLineField';
import { SyntaxHighlightActiveLineGutterField } from '../fields/SyntaxHighlightActiveLineGutterField';
import { SyntaxLineNumbersField } from '../fields/SyntaxLineNumbersField';
import type { FieldSettingId, FormSettingsSection } from './catalog';

export type SettingsSectionComponentProps = {
  /**
   * When set, focuses the matching variable row in sections that support it.
   */
  focusVariableKey?: string;

  /**
   * When set, scrolls to the matching catalog group anchor in sections that support it.
   */
  focusSettingId?: string;

  /**
   * Called after a requested group anchor has been scrolled into view.
   */
  onFocusSettingHandled?: () => void;

  /**
   * Hosting tab id so File → Save / Ctrl+S can persist form sections.
   */
  tabId?: string;
};

/**
 * Maps catalog field ids to standalone field components.
 */
export const SETTINGS_FIELD_REGISTRY: Partial<Record<FieldSettingId, ComponentType>> = {
  'general.requestTimeoutMs': GeneralRequestTimeoutField,
  'general.scriptTimeoutMs': GeneralScriptTimeoutField,
  'general.allowScriptNetworkRequests': GeneralAllowScriptNetworkRequestsField,
  'general.allowScriptFileRead': GeneralAllowScriptFileReadField,
  'general.allowScriptFileWrite': GeneralAllowScriptFileWriteField,
  'general.scriptFileRoot': GeneralScriptFileRootField,
  'general.maxResponseSizeMb': GeneralMaxResponseSizeField,
  'general.verifySsl': GeneralVerifySslField,
  'general.followRedirects': GeneralFollowRedirectsField,
  'general.scrollbarAutoHide': GeneralScrollbarAutoHideField,
  'general.wrapTabs': GeneralWrapTabsField,
  'general.closeToTray': GeneralCloseToTrayField,
  'general.spellCheckEnabled': GeneralSpellCheckEnabledField,
  'general.logFilePath': GeneralLogFilePathField,
  'proxy.enabled': ProxyEnabledField,
  'proxy.protocol': ProxyProtocolField,
  'proxy.host': ProxyHostField,
  'proxy.port': ProxyPortField,
  'proxy.authEnabled': ProxyAuthEnabledField,
  'proxy.username': ProxyUsernameField,
  'proxy.password': ProxyPasswordField,
  'syntax.codeEditorTheme': SyntaxCodeEditorThemeField,
  'syntax.codeEditorFontSize': SyntaxCodeEditorFontSizeField,
  'syntax.lineNumbers': SyntaxLineNumbersField,
  'syntax.foldGutter': SyntaxFoldGutterField,
  'syntax.highlightActiveLine': SyntaxHighlightActiveLineField,
  'syntax.highlightActiveLineGutter': SyntaxHighlightActiveLineGutterField,
  'ai.openaiApiKey': AiOpenAiApiKeyField,
  'ai.claudeApiKey': AiClaudeApiKeyField,
  'ai.geminiApiKey': AiGeminiApiKeyField
};

/**
 * Maps management section ids to their existing panel components.
 */
export const SETTINGS_SECTION_REGISTRY: Record<
  'globals' | 'storage' | 'git' | 'shortcuts' | 'backup-restore',
  ComponentType<SettingsSectionComponentProps>
> = {
  'globals': GlobalsSection,
  'storage': StorageLocationsSection,
  'git': GitIdentitiesSection,
  'shortcuts': ShortcutsSection,
  'backup-restore': BackupRestoreSection
};

/**
 * Optional leading content rendered before field components in a form section.
 */
export const FORM_SECTION_LEADING_EXTRAS: Partial<Record<FormSettingsSection, ComponentType>> = {
  general: GeneralInfoExtra,
  ai: AiInfoExtra,
  proxy: ProxyInfoExtra,
  syntax: SyntaxSectionLeading
};

/**
 * Optional trailing content rendered after field components in a form section.
 */
export const FORM_SECTION_EXTRAS: Partial<Record<FormSettingsSection, ComponentType>> = {
  ai: AiSettingsExtras
};

/**
 * Returns the field component registered for a catalog field id.
 *
 * @param id - Catalog field id.
 */
export function getFieldComponent(id: FieldSettingId): ComponentType | undefined {
  return SETTINGS_FIELD_REGISTRY[id];
}

/**
 * Renders catalog field components for the supplied ids in catalog order.
 *
 * @param ids - Field ids to render.
 */
export function renderSettingFields(ids: FieldSettingId[]): JSX.Element {
  return (
    <>
      {ids.map((id) => {
        const FieldComponent = getFieldComponent(id);
        if (FieldComponent == null) {
          return null;
        }
        return <FieldComponent key={id} />;
      })}
    </>
  );
}

/**
 * Returns true when the section is rendered by a management panel component.
 */
export function isManagementSettingsSection(
  section: SettingsSection
): section is 'globals' | 'storage' | 'git' | 'shortcuts' | 'backup-restore' {
  return (
    section === 'globals' ||
    section === 'storage' ||
    section === 'git' ||
    section === 'shortcuts' ||
    section === 'backup-restore'
  );
}
