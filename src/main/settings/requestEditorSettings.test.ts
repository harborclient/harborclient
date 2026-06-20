import { describe, expect, it } from 'vitest';
import {
  normalizeEditorTab,
  requestEditorTabKey,
  resolveEditorTab
} from '#/shared/requestEditorTab';

describe('requestEditorTabKey', () => {
  it('uses saved request id when present', () => {
    expect(requestEditorTabKey({ id: 42 }, 'tab-1')).toBe('42');
  });

  it('uses tab id prefix for unsaved drafts', () => {
    expect(requestEditorTabKey({}, 'tab-abc')).toBe('tab:tab-abc');
  });
});

describe('normalizeEditorTab', () => {
  it('parseEditorTab accepts params, headers, body, and scripts tabs', () => {
    expect(normalizeEditorTab('headers')).toBe('headers');
    expect(normalizeEditorTab('post')).toBe('post');
  });

  it('rejects unknown values', () => {
    expect(normalizeEditorTab('tests')).toBeNull();
    expect(normalizeEditorTab(null)).toBeNull();
    expect(normalizeEditorTab(1)).toBeNull();
  });
});

describe('resolveEditorTab', () => {
  it('defaults to params when unset', () => {
    expect(resolveEditorTab(null, true)).toBe('params');
  });

  it('falls back to params when body is hidden', () => {
    expect(resolveEditorTab('body', false)).toBe('params');
  });

  it('keeps body when available', () => {
    expect(resolveEditorTab('body', true)).toBe('body');
  });
});
