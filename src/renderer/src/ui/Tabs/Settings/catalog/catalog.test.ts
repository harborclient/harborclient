import { describe, expect, it } from 'vitest';

import type { SettingsSection } from '#/shared/types';
import {
  allFieldEntries,
  entryById,
  fieldEntriesForSection,
  SETTINGS_CATALOG,
  sectionEntryBySection,
  type FieldSettingId,
  type SettingId
} from './catalog';

const MANAGEMENT_SECTIONS = ['globals', 'storage', 'git', 'shortcuts', 'backup-restore'] as const;

const FORM_SECTIONS = ['general', 'proxy', 'syntax', 'ai', 'plugins'] as const;

const EXPECTED_FIELD_IDS: FieldSettingId[] = [
  'general.requestTimeoutMs',
  'general.scriptTimeoutMs',
  'general.allowScriptNetworkRequests',
  'general.maxResponseSizeMb',
  'general.verifySsl',
  'general.followRedirects',
  'general.scrollbarAutoHide',
  'general.wrapTabs',
  'general.closeToTray',
  'general.spellCheckEnabled',
  'general.logFilePath',
  'proxy.enabled',
  'proxy.protocol',
  'proxy.host',
  'proxy.port',
  'proxy.authEnabled',
  'proxy.username',
  'proxy.password',
  'syntax.codeEditorTheme',
  'syntax.codeEditorFontSize',
  'syntax.lineNumbers',
  'syntax.foldGutter',
  'syntax.highlightActiveLine',
  'syntax.highlightActiveLineGutter',
  'ai.openaiApiKey',
  'ai.claudeApiKey',
  'ai.geminiApiKey',
  'ai.githubModels',
  'plugins.addCatalogEndpointUrl',
  'plugins.addTrustedEndpointUrl'
];

describe('SETTINGS_CATALOG', () => {
  it('uses unique setting ids', () => {
    const ids = SETTINGS_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('requires non-empty descriptions for every field entry', () => {
    for (const entry of allFieldEntries()) {
      expect(entry.description.trim().length).toBeGreaterThan(0);
    }
  });

  it('registers every expected field id in the catalog', () => {
    const catalogFieldIds = allFieldEntries()
      .map((entry) => entry.id)
      .sort();
    expect(catalogFieldIds).toEqual([...EXPECTED_FIELD_IDS].sort());
  });

  it('registers exactly one section entry per management section', () => {
    for (const section of MANAGEMENT_SECTIONS) {
      const matches = SETTINGS_CATALOG.filter(
        (entry) => entry.kind === 'section' && entry.section === section
      );
      expect(matches).toHaveLength(1);
    }
  });

  it('returns field entries grouped by form section in manifest order', () => {
    for (const section of FORM_SECTIONS) {
      const entries = fieldEntriesForSection(section);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.every((entry) => entry.section === section)).toBe(true);
    }
  });

  it('throws for unknown setting ids', () => {
    expect(() => entryById('missing.setting' as SettingId)).toThrow(/Unknown setting id/);
  });

  it('throws when requesting a section entry for a form section', () => {
    expect(() => sectionEntryBySection('general' as SettingsSection)).toThrow(
      /No section catalog entry/
    );
  });

  it('registers the backup-restore confirmations group', () => {
    const entry = entryById('backup-restore.confirmations');
    expect(entry.kind).toBe('group');
    expect(entry.section).toBe('backup-restore');
    expect(entry.label).toBe('Show confirmations');
  });
});
