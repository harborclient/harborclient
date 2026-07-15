import { describe, expect, it } from 'vitest';
import {
  isSlashCommandQuery,
  matchSlashCommandSuggestions,
  resolveSlashCommand
} from './slashCommands';

describe('isSlashCommandQuery', () => {
  it('returns false for non-slash queries', () => {
    expect(isSlashCommandQuery('collections')).toBe(false);
    expect(isSlashCommandQuery('')).toBe(false);
  });

  it('returns true when the query starts with a slash', () => {
    expect(isSlashCommandQuery('/')).toBe(true);
    expect(isSlashCommandQuery('/ask')).toBe(true);
  });
});

describe('matchSlashCommandSuggestions', () => {
  it('returns no suggestions for non-slash queries', () => {
    expect(matchSlashCommandSuggestions('ask')).toEqual([]);
  });

  it('returns all commands when only the slash is typed', () => {
    expect(matchSlashCommandSuggestions('/')).toHaveLength(1);
    expect(matchSlashCommandSuggestions('/')[0]?.keyword).toBe('ask');
  });

  it('filters commands by keyword prefix', () => {
    expect(matchSlashCommandSuggestions('/a')).toHaveLength(1);
    expect(matchSlashCommandSuggestions('/as')).toHaveLength(1);
    expect(matchSlashCommandSuggestions('/foo')).toEqual([]);
  });

  it('uses only the keyword portion before whitespace', () => {
    expect(matchSlashCommandSuggestions('/ask What is Team Hub')).toHaveLength(1);
  });
});

describe('resolveSlashCommand', () => {
  it('returns null for non-slash queries', () => {
    expect(resolveSlashCommand('ask')).toBeNull();
  });

  it('returns null for unknown keywords', () => {
    expect(resolveSlashCommand('/unknown')).toBeNull();
  });

  it('resolves an exact keyword without an argument', () => {
    expect(resolveSlashCommand('/ask')).toEqual({
      command: expect.objectContaining({ id: 'ask', keyword: 'ask' }),
      argument: ''
    });
  });

  it('resolves an exact keyword with an argument', () => {
    expect(resolveSlashCommand('/ask What is Team Hub')).toEqual({
      command: expect.objectContaining({ id: 'ask', keyword: 'ask' }),
      argument: 'What is Team Hub'
    });
  });

  it('trims whitespace from the argument', () => {
    expect(resolveSlashCommand('/ask   What is Team Hub   ')).toEqual({
      command: expect.objectContaining({ id: 'ask', keyword: 'ask' }),
      argument: 'What is Team Hub'
    });
  });

  it('returns an empty argument for whitespace-only input after the keyword', () => {
    expect(resolveSlashCommand('/ask   ')).toEqual({
      command: expect.objectContaining({ id: 'ask', keyword: 'ask' }),
      argument: ''
    });
  });
});
