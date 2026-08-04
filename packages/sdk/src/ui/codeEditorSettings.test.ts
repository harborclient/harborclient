import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CODE_EDITOR_FONT_SIZE,
  MIN_CODE_EDITOR_FONT_SIZE_PX,
  normalizeCodeEditorFontSize,
  normalizeCodeEditorTheme
} from './codeEditorSettings.js';

describe('normalizeCodeEditorTheme', () => {
  it('returns Nord when value is missing or invalid', () => {
    expect(normalizeCodeEditorTheme(undefined)).toBe('nord');
    expect(normalizeCodeEditorTheme(null)).toBe('nord');
    expect(normalizeCodeEditorTheme('')).toBe('nord');
    expect(normalizeCodeEditorTheme('not-a-theme')).toBe('nord');
  });

  it('preserves known theme identifiers', () => {
    expect(normalizeCodeEditorTheme('default')).toBe('default');
    expect(normalizeCodeEditorTheme('nord')).toBe('nord');
    expect(normalizeCodeEditorTheme('monokai')).toBe('monokai');
    expect(normalizeCodeEditorTheme('dracula')).toBe('dracula');
  });
});

describe('normalizeCodeEditorFontSize', () => {
  it('returns the default when value is missing or invalid', () => {
    expect(normalizeCodeEditorFontSize(undefined)).toBe(DEFAULT_CODE_EDITOR_FONT_SIZE);
    expect(normalizeCodeEditorFontSize(null)).toBe(DEFAULT_CODE_EDITOR_FONT_SIZE);
    expect(normalizeCodeEditorFontSize('')).toBe(DEFAULT_CODE_EDITOR_FONT_SIZE);
    expect(normalizeCodeEditorFontSize('12rem')).toBe(DEFAULT_CODE_EDITOR_FONT_SIZE);
    expect(normalizeCodeEditorFontSize(NaN)).toBe(DEFAULT_CODE_EDITOR_FONT_SIZE);
  });

  it('normalizes px strings and bare integers', () => {
    expect(normalizeCodeEditorFontSize('16px')).toBe('16px');
    expect(normalizeCodeEditorFontSize(' 18PX ')).toBe('18px');
    expect(normalizeCodeEditorFontSize('20')).toBe('20px');
    expect(normalizeCodeEditorFontSize(22)).toBe('22px');
  });

  it('clamps values below the minimum', () => {
    expect(normalizeCodeEditorFontSize('10px')).toBe(`${MIN_CODE_EDITOR_FONT_SIZE_PX}px`);
    expect(normalizeCodeEditorFontSize('12')).toBe(`${MIN_CODE_EDITOR_FONT_SIZE_PX}px`);
    expect(normalizeCodeEditorFontSize(8)).toBe(`${MIN_CODE_EDITOR_FONT_SIZE_PX}px`);
  });
});
