import { describe, expect, it } from 'vitest';
import {
  autoNameUnnamedScripts,
  createInlineScriptRef,
  createSnippetScriptRef,
  ensureDefaultScriptRef,
  linkScriptRefToSnippet,
  mergeScriptRefsUiState,
  mirrorLegacyScriptString,
  normalizeScriptRefs,
  normalizeScriptRefsForCompare,
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

describe('normalizeScriptRefsForCompare', () => {
  it('omits expanded flags used only for editor UI state', () => {
    const expanded = { ...createInlineScriptRef('code'), expanded: true };
    const collapsed = { ...createInlineScriptRef('other'), expanded: false };

    expect(normalizeScriptRefsForCompare([expanded, collapsed])).toEqual([
      expect.not.objectContaining({ expanded: expect.anything() }),
      expect.not.objectContaining({ expanded: expect.anything() })
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
      stage: 'main',
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

describe('mergeScriptRefsUiState', () => {
  it('preserves expanded flags from the pre-save draft when storage omits them', () => {
    const before = [
      { ...createInlineScriptRef('one'), expanded: true },
      { ...createInlineScriptRef('two'), expanded: false }
    ];
    const after = [createInlineScriptRef('one'), createInlineScriptRef('two')];

    const { merged, idMigrations } = mergeScriptRefsUiState(before, after);

    expect(merged).toEqual([
      expect.objectContaining({ id: after[0]?.id, expanded: true }),
      expect.objectContaining({ id: after[1]?.id, expanded: false })
    ]);
    expect(idMigrations).toEqual([
      { from: before[0]!.id, to: after[0]!.id },
      { from: before[1]!.id, to: after[1]!.id }
    ]);
  });

  it('matches by index and reports id migrations when storage regenerates row ids', () => {
    const before = [{ ...createInlineScriptRef('code'), expanded: true }];
    const after = [{ ...createInlineScriptRef('code'), id: 'regenerated-id' }];

    const { merged, idMigrations } = mergeScriptRefsUiState(before, after);

    expect(merged).toEqual([expect.objectContaining({ id: 'regenerated-id', expanded: true })]);
    expect(idMigrations).toEqual([{ from: before[0]!.id, to: 'regenerated-id' }]);
  });

  it('does not overwrite expanded when the saved payload already includes it', () => {
    const before = [{ ...createInlineScriptRef('code'), expanded: true }];
    const after = [{ ...createInlineScriptRef('code'), expanded: false }];

    const { merged } = mergeScriptRefsUiState(before, after);

    expect(merged[0]?.expanded).toBe(false);
  });

  it('leaves rows unchanged when the pre-save draft never set expanded', () => {
    const before = [createInlineScriptRef('code')];
    const after = [createInlineScriptRef('code')];

    const { merged } = mergeScriptRefsUiState(before, after);

    expect(merged[0]).not.toHaveProperty('expanded');
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
