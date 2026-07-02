import { describe, expect, it } from 'vitest';
import {
  autoNameUnnamedScripts,
  createInlineScriptRef,
  createSnippetScriptRef,
  ensureDefaultScriptRef,
  linkScriptRefToSnippet,
  mirrorLegacyScriptString,
  normalizeScriptRefs,
  readScriptRefsFromJson,
  resolveScriptRefs,
  scriptAutoNameFromCode,
  UNNAMED_SCRIPT_NAME
} from '#/shared/scriptRefs';

describe('resolveScriptRefs', () => {
  it('falls back to a legacy inline script when arrays are empty', () => {
    const refs = resolveScriptRefs([], 'legacy code');
    expect(refs).toHaveLength(1);
    expect(refs[0]?.kind).toBe('inline');
    expect(refs[0]?.code).toBe('legacy code');
  });

  it('prefers canonical arrays over legacy strings', () => {
    const inline = createInlineScriptRef('array code');
    expect(resolveScriptRefs([inline], 'legacy code')).toEqual([inline]);
  });
});

describe('normalizeScriptRefs', () => {
  it('preserves expanded when set on script references', () => {
    const expanded = { ...createInlineScriptRef('code'), expanded: true };
    const collapsed = { ...createInlineScriptRef('other'), expanded: false };

    expect(normalizeScriptRefs([expanded, collapsed])).toEqual([
      expect.objectContaining({ expanded: true }),
      expect.objectContaining({ expanded: false })
    ]);
  });
});

describe('linkScriptRefToSnippet', () => {
  it('preserves row identity while linking to a snippet uuid', () => {
    const inline = { ...createInlineScriptRef('console.log("test");', 'Auth'), expanded: true };

    expect(linkScriptRefToSnippet(inline, 'snippet-uuid', 'Auth helper')).toEqual({
      id: inline.id,
      enabled: true,
      kind: 'snippet',
      snippetUuid: 'snippet-uuid',
      name: 'Auth helper',
      expanded: true
    });
  });
});

describe('scriptAutoNameFromCode', () => {
  it('returns null when source is blank', () => {
    expect(scriptAutoNameFromCode('   \nsecond')).toBeNull();
  });

  it('returns the trimmed first line capped at 25 characters', () => {
    expect(scriptAutoNameFromCode('console.log("hello world");')).toBe('console.log("hello world"');
  });
});

describe('autoNameUnnamedScripts', () => {
  it('renames unnamed inline scripts with code and leaves empty scripts unchanged', () => {
    const named = createInlineScriptRef('console.log("keep");', 'Keep me');
    const unnamedWithCode = createInlineScriptRef('console.log("rename");', UNNAMED_SCRIPT_NAME);
    const unnamedEmpty = createInlineScriptRef('', UNNAMED_SCRIPT_NAME);

    const result = autoNameUnnamedScripts([named, unnamedWithCode, unnamedEmpty], []);

    expect(result[0]?.name).toBe('Keep me');
    expect(result[1]?.name).toBe('console.log("rename");');
    expect(result[2]?.name).toBe(UNNAMED_SCRIPT_NAME);
  });
});

describe('mirrorLegacyScriptString', () => {
  it('concatenates enabled inline scripts and ignores snippets', () => {
    const legacy = mirrorLegacyScriptString([
      createInlineScriptRef('first'),
      createSnippetScriptRef('snippet-1'),
      { ...createInlineScriptRef('second'), enabled: false },
      createInlineScriptRef('third')
    ]);

    expect(legacy).toBe('first\n\nthird');
  });
});

describe('readScriptRefsFromJson', () => {
  it('parses stored JSON arrays', () => {
    const inline = createInlineScriptRef('stored');
    expect(readScriptRefsFromJson(JSON.stringify([inline]), '')).toEqual([inline]);
  });
});

describe('ensureDefaultScriptRef', () => {
  it('returns existing scripts when the list is non-empty', () => {
    const inline = createInlineScriptRef('existing');
    expect(ensureDefaultScriptRef([inline])).toEqual([inline]);
  });

  it('creates a blank inline script when the list is empty', () => {
    const refs = ensureDefaultScriptRef([]);
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      enabled: true,
      kind: 'inline',
      code: '',
      expanded: true
    });
  });
});
