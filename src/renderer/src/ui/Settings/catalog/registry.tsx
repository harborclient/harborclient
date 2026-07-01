import type { ComponentType, JSX } from 'react';
import type { SettingsSection } from '#/shared/types';

import { AiInfoExtra } from '../extras/AiInfoExtra';
import { SyntaxPreviewExtra } from '../extras/SyntaxPreviewExtra';
import { BackupRestoreSection } from '../BackupRestoreSection';
import { GlobalsSection } from '../GlobalsSection';
import { ShortcutsSection } from '../ShortcutsSection';
import { StorageLocationsSection } from '../StorageLocationsSection';
import { AiClaudeApiKeyField } from '../fields/AiClaudeApiKeyField';
import { AiGeminiApiKeyField } from '../fields/AiGeminiApiKeyField';
import { AiOpenAiApiKeyField } from '../fields/AiOpenAiApiKeyField';
import { GeneralFollowRedirectsField } from '../fields/GeneralFollowRedirectsField';
import { GeneralMaxResponseSizeField } from '../fields/GeneralMaxResponseSizeField';
import { GeneralRequestTimeoutField } from '../fields/GeneralRequestTimeoutField';
import { GeneralThemeField } from '../fields/GeneralThemeField';
import { GeneralVerifySslField } from '../fields/GeneralVerifySslField';
import { ProxyAuthEnabledField } from '../fields/ProxyAuthEnabledField';
import { ProxyEnabledField } from '../fields/ProxyEnabledField';
import { ProxyHostField } from '../fields/ProxyHostField';
import { ProxyPasswordField } from '../fields/ProxyPasswordField';
import { ProxyPortField } from '../fields/ProxyPortField';
import { ProxyProtocolField } from '../fields/ProxyProtocolField';
import { ProxyUsernameField } from '../fields/ProxyUsernameField';
import { SyntaxCodeEditorThemeField } from '../fields/SyntaxCodeEditorThemeField';
import { SyntaxFoldGutterField } from '../fields/SyntaxFoldGutterField';
import { SyntaxHighlightActiveLineField } from '../fields/SyntaxHighlightActiveLineField';
import { SyntaxHighlightActiveLineGutterField } from '../fields/SyntaxHighlightActiveLineGutterField';
import { SyntaxLineNumbersField } from '../fields/SyntaxLineNumbersField';
import type { FieldSettingId, FormSettingsSection } from './catalog';

type SettingsSectionComponentProps = Record<string, never>;

/**
 * Maps catalog field ids to standalone field components.
 */
export const SETTINGS_FIELD_REGISTRY: Record<FieldSettingId, ComponentType> = {
  'general.theme': GeneralThemeField,
  'general.requestTimeoutMs': GeneralRequestTimeoutField,
  'general.maxResponseSizeMb': GeneralMaxResponseSizeField,
  'general.verifySsl': GeneralVerifySslField,
  'general.followRedirects': GeneralFollowRedirectsField,
  'proxy.enabled': ProxyEnabledField,
  'proxy.protocol': ProxyProtocolField,
  'proxy.host': ProxyHostField,
  'proxy.port': ProxyPortField,
  'proxy.authEnabled': ProxyAuthEnabledField,
  'proxy.username': ProxyUsernameField,
  'proxy.password': ProxyPasswordField,
  'syntax.codeEditorTheme': SyntaxCodeEditorThemeField,
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
  'globals' | 'storage' | 'shortcuts' | 'backup-restore',
  ComponentType<SettingsSectionComponentProps>
> = {
  globals: GlobalsSection,
  storage: StorageLocationsSection,
  shortcuts: ShortcutsSection,
  'backup-restore': BackupRestoreSection
};

/**
 * Optional trailing content rendered after field components in a form section.
 */
export const FORM_SECTION_EXTRAS: Partial<Record<FormSettingsSection, ComponentType>> = {
  syntax: SyntaxPreviewExtra,
  ai: AiInfoExtra
};

/**
 * Returns the field component registered for a catalog field id.
 *
 * @param id - Catalog field id.
 */
export function getFieldComponent(id: FieldSettingId): ComponentType {
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
): section is 'globals' | 'storage' | 'shortcuts' | 'backup-restore' {
  return (
    section === 'globals' ||
    section === 'storage' ||
    section === 'shortcuts' ||
    section === 'backup-restore'
  );
}
