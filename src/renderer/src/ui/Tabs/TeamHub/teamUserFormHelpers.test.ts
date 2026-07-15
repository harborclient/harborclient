import { describe, expect, it } from 'vitest';
import {
  applyAccessSuggestion,
  filterAccessListSuggestions,
  formValuesToCreateInput,
  getCurrentAccessToken,
  parseAccessListText
} from './teamUserFormHelpers';

describe('getCurrentAccessToken', () => {
  it('returns the trimmed text after the last comma', () => {
    expect(getCurrentAccessToken('uuid-1, uuid-2')).toBe('uuid-2');
    expect(getCurrentAccessToken('uuid-1, par')).toBe('par');
    expect(getCurrentAccessToken('*')).toBe('*');
  });

  it('returns an empty string when the trailing token is blank', () => {
    expect(getCurrentAccessToken('uuid-1, ')).toBe('');
  });
});

describe('applyAccessSuggestion', () => {
  it('appends a selected id and deduplicates existing entries', () => {
    expect(applyAccessSuggestion('uuid-1, par', 'uuid-2')).toBe('uuid-1, uuid-2');
    expect(applyAccessSuggestion('uuid-1, uuid-2', 'uuid-1')).toBe('uuid-1');
  });

  it('replaces an empty trailing token with the selected id', () => {
    expect(applyAccessSuggestion('', '*')).toBe('*');
    expect(applyAccessSuggestion('uuid-1, ', 'uuid-2')).toBe('uuid-1, uuid-2');
  });

  it('ignores blank suggestion ids', () => {
    expect(applyAccessSuggestion('uuid-1', '   ')).toBe('uuid-1');
  });
});

describe('filterAccessListSuggestions', () => {
  it('includes the wildcard suggestion first when the token is empty', () => {
    expect(filterAccessListSuggestions([{ id: 'uuid-1', label: 'Shared API' }], '')).toEqual([
      { id: '*', label: 'All' },
      { id: 'uuid-1', label: 'Shared API' }
    ]);
  });

  it('filters suggestions by id or label', () => {
    expect(
      filterAccessListSuggestions(
        [
          { id: 'uuid-1', label: 'Shared API' },
          { id: 'uuid-2', label: 'Production' }
        ],
        'prod'
      )
    ).toEqual([{ id: 'uuid-2', label: 'Production' }]);
  });
});

describe('parseAccessListText', () => {
  it('splits and trims comma-separated access ids', () => {
    expect(parseAccessListText(' uuid-1 , uuid-2 , ')).toEqual(['uuid-1', 'uuid-2']);
  });
});

describe('formValuesToCreateInput', () => {
  it('builds a create payload from form values', () => {
    expect(
      formValuesToCreateInput({
        name: ' Alice ',
        role: 'user',
        collectionAccessText: 'uuid-1, *',
        environmentAccessText: '',
        llmAccess: true,
        llmModelsText: 'gpt-4o',
        llmMonthlyTokenLimitText: '1000'
      })
    ).toEqual({
      name: 'Alice',
      role: 'user',
      collectionAccess: ['uuid-1', '*'],
      environmentAccess: [],
      llmAccess: true,
      llmModels: ['gpt-4o'],
      llmMonthlyTokenLimit: 1000
    });
  });
});
