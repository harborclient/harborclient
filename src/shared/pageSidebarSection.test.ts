import { describe, expect, it } from 'vitest';
import {
  isAllowedPageSidebarSection,
  normalizePageSidebarKey,
  normalizePageSidebarSection
} from '#/shared/pageSidebarSection';

describe('normalizePageSidebarKey', () => {
  it('accepts supported page keys', () => {
    expect(normalizePageSidebarKey('settings')).toBe('settings');
    expect(normalizePageSidebarKey('plugins')).toBe('plugins');
    expect(normalizePageSidebarKey('themes')).toBe('themes');
    expect(normalizePageSidebarKey('sharing-keys')).toBe('sharing-keys');
    expect(normalizePageSidebarKey('snippets')).toBe('snippets');
  });

  it('rejects unknown keys', () => {
    expect(normalizePageSidebarKey('team-hubs')).toBeNull();
    expect(normalizePageSidebarKey(null)).toBeNull();
  });
});

describe('normalizePageSidebarSection', () => {
  it('accepts built-in settings sections and plugin ids', () => {
    expect(normalizePageSidebarSection('settings', 'proxy')).toBe('proxy');
    expect(normalizePageSidebarSection('settings', 'plugin:demo:settings')).toBe(
      'plugin:demo:settings'
    );
  });

  it('accepts plugin management sections per kind', () => {
    expect(normalizePageSidebarSection('plugins', 'marketplace')).toBe('marketplace');
    expect(normalizePageSidebarSection('plugins', 'settings')).toBe('settings');
    expect(normalizePageSidebarSection('themes', 'install')).toBe('install');
  });

  it('accepts snippet management sections', () => {
    expect(normalizePageSidebarSection('snippets', 'installed')).toBe('installed');
    expect(normalizePageSidebarSection('snippets', 'marketplace')).toBe('marketplace');
    expect(normalizePageSidebarSection('snippets', 'install')).toBe('install');
    expect(normalizePageSidebarSection('snippets', 'settings')).toBeNull();
  });

  it('rejects settings on themes and unknown sections', () => {
    expect(normalizePageSidebarSection('themes', 'settings')).toBeNull();
    expect(normalizePageSidebarSection('plugins', 'unknown')).toBeNull();
    expect(normalizePageSidebarSection('sharing-keys', 'marketplace')).toBeNull();
  });

  it('accepts sharing key sections', () => {
    expect(normalizePageSidebarSection('sharing-keys', 'trusted')).toBe('trusted');
  });
});

describe('isAllowedPageSidebarSection', () => {
  it('mirrors normalizePageSidebarSection allowlists', () => {
    expect(isAllowedPageSidebarSection('settings', 'ai')).toBe(true);
    expect(isAllowedPageSidebarSection('themes', 'settings')).toBe(false);
  });
});
