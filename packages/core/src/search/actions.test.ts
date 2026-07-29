import { describe, expect, it } from 'vitest';
import {
  actionCommandDisplayLabel,
  BUILTIN_ACTIONS,
  isActionQuery,
  matchActionSuggestions,
  matchInlineActionSuggestions,
  pluginActionId,
  type ActionCommandDefinition
} from './actions';

const SAMPLE_ACTIONS: ActionCommandDefinition[] = [
  { id: 'builtin:settings', group: 'File', label: 'Settings' },
  { id: 'builtin:team-hubs', group: 'Team', label: 'Team Hub' },
  { id: 'plugin:curl:action:cURL:View', group: 'cURL', label: 'View' }
];

describe('isActionQuery', () => {
  it('returns false for non-hash queries', () => {
    expect(isActionQuery('collections')).toBe(false);
    expect(isActionQuery('/ask')).toBe(false);
    expect(isActionQuery('')).toBe(false);
  });

  it('returns true when the query starts with a hash', () => {
    expect(isActionQuery('#')).toBe(true);
    expect(isActionQuery('#settings')).toBe(true);
  });
});

describe('actionCommandDisplayLabel', () => {
  it('formats group and label with a colon separator', () => {
    expect(actionCommandDisplayLabel(BUILTIN_ACTIONS[0]!)).toBe('File: New Request');
  });
});

describe('matchActionSuggestions', () => {
  it('returns no suggestions for non-hash queries', () => {
    expect(matchActionSuggestions('settings', SAMPLE_ACTIONS)).toEqual([]);
  });

  it('returns all actions when only the hash is typed', () => {
    expect(matchActionSuggestions('#', SAMPLE_ACTIONS)).toEqual(SAMPLE_ACTIONS);
  });

  it('filters actions by group prefix', () => {
    expect(matchActionSuggestions('#file', SAMPLE_ACTIONS)).toEqual([
      { id: 'builtin:settings', group: 'File', label: 'Settings' }
    ]);
  });

  it('filters actions by label substring', () => {
    expect(matchActionSuggestions('#team hub', SAMPLE_ACTIONS)).toEqual([
      { id: 'builtin:team-hubs', group: 'Team', label: 'Team Hub' }
    ]);
  });

  it('filters plugin actions by namespace', () => {
    expect(matchActionSuggestions('#curl', SAMPLE_ACTIONS)).toEqual([
      { id: 'plugin:curl:action:cURL:View', group: 'cURL', label: 'View' }
    ]);
  });

  it('filters built-in terminal action by label', () => {
    expect(matchActionSuggestions('#terminal', BUILTIN_ACTIONS)).toEqual([
      {
        id: 'builtin:toggle-terminal',
        group: 'View',
        label: 'Terminal',
        description: 'Open the terminal panel'
      }
    ]);
  });

  it('filters Image: Logo action by label', () => {
    expect(matchActionSuggestions('#logo', BUILTIN_ACTIONS)).toEqual([
      { id: 'builtin:image-logo', group: 'Image', label: 'Logo' }
    ]);
  });

  it('filters Image: Logo action without a hash prefix', () => {
    expect(matchInlineActionSuggestions('Image:', BUILTIN_ACTIONS)).toEqual([
      { id: 'builtin:image-logo', group: 'Image', label: 'Logo' }
    ]);
  });

  it('returns View menu appearance, zoom, and theme actions for View:', () => {
    const matches = matchInlineActionSuggestions('View:', BUILTIN_ACTIONS);
    const ids = matches.map((action) => action.id);

    expect(ids).toContain('builtin:toggle-sidebar');
    expect(ids).toContain('builtin:hide-sidebars');
    expect(ids).toContain('builtin:show-sidebars');
    expect(ids).toContain('builtin:toggle-filters');
    expect(ids).toContain('builtin:zoom-in');
    expect(ids).toContain('builtin:toggle-fullscreen');
    expect(ids).toContain('builtin:theme-dark');
    expect(ids).not.toContain('builtin:toggle-collections-section');
    expect(matches.every((action) => action.group === 'View')).toBe(true);
  });

  it('returns View menu actions for #view', () => {
    const matches = matchActionSuggestions('#view', BUILTIN_ACTIONS);
    expect(matches.some((action) => action.id === 'builtin:zoom-out')).toBe(true);
    expect(matches.some((action) => action.id === 'builtin:theme-light')).toBe(true);
    expect(matches.every((action) => action.group === 'View')).toBe(true);
  });

  it('returns sidebar section toggles for Sidebar:', () => {
    expect(matchInlineActionSuggestions('Sidebar:', BUILTIN_ACTIONS)).toEqual([
      {
        id: 'builtin:toggle-collections-section',
        group: 'Sidebar',
        label: 'Show Collections'
      },
      {
        id: 'builtin:toggle-environments-section',
        group: 'Sidebar',
        label: 'Show Environments'
      },
      {
        id: 'builtin:toggle-run-results-section',
        group: 'Sidebar',
        label: 'Show Collections (Runs)'
      }
    ]);
  });
});

describe('pluginActionId', () => {
  it('encodes plugin id and command id', () => {
    expect(pluginActionId('curl', 'action:cURL:View')).toBe('plugin:curl:action:cURL:View');
  });
});
