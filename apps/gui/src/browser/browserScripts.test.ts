import { describe, expect, it } from 'vitest';
import {
  areBrowserScriptsDirty,
  normalizeBrowserInjectionScripts,
  selectScriptsForRunAt,
  type BrowserInjectionScript
} from './browserScripts';

/**
 * Builds a script fixture for ordering and dirty tests.
 *
 * @param overrides - Partial fields to merge onto defaults.
 * @returns Complete injection script.
 */
function script(overrides: Partial<BrowserInjectionScript> = {}): BrowserInjectionScript {
  return {
    id: overrides.id ?? 'a',
    name: overrides.name ?? 'Script',
    enabled: overrides.enabled ?? true,
    runAt: overrides.runAt ?? 'did-finish-load',
    source: overrides.source ?? 'console.log(1)'
  };
}

describe('selectScriptsForRunAt', () => {
  it('returns enabled scripts for the matching hook in order', () => {
    const scripts = [
      script({ id: '1', runAt: 'dom-ready', source: 'a()' }),
      script({ id: '2', runAt: 'did-finish-load', source: 'b()' }),
      script({ id: '3', runAt: 'dom-ready', enabled: false, source: 'c()' }),
      script({ id: '4', runAt: 'dom-ready', source: 'd()' })
    ];
    expect(selectScriptsForRunAt(scripts, 'dom-ready').map((entry) => entry.id)).toEqual([
      '1',
      '4'
    ]);
  });

  it('skips blank sources', () => {
    const scripts = [script({ id: '1', source: '   ' })];
    expect(selectScriptsForRunAt(scripts, 'did-finish-load')).toEqual([]);
  });
});

describe('areBrowserScriptsDirty', () => {
  it('detects edits to name or source', () => {
    const saved = [script({ name: 'A', source: '1' })];
    expect(areBrowserScriptsDirty([script({ name: 'A', source: '1' })], saved)).toBe(false);
    expect(areBrowserScriptsDirty([script({ name: 'B', source: '1' })], saved)).toBe(true);
  });
});

describe('normalizeBrowserInjectionScripts', () => {
  it('drops invalid entries', () => {
    expect(
      normalizeBrowserInjectionScripts([
        { id: 'ok', name: 'Ok', enabled: true, runAt: 'dom-ready', source: 'x' },
        { id: 'bad', name: 'Bad', runAt: 'nope', source: 'y' },
        null
      ])
    ).toEqual([{ id: 'ok', name: 'Ok', enabled: true, runAt: 'dom-ready', source: 'x' }]);
  });
});
