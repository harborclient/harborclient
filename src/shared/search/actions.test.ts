import { describe, expect, it } from 'vitest';
import {
  actionCommandDisplayLabel,
  BUILTIN_ACTIONS,
  isActionQuery,
  matchActionSuggestions,
  pluginActionId,
  type ActionCommandDefinition
} from '#/shared/search/actions';

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
});

describe('pluginActionId', () => {
  it('encodes plugin id and command id', () => {
    expect(pluginActionId('curl', 'action:cURL:View')).toBe('plugin:curl:action:cURL:View');
  });
});
