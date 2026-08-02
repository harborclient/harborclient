import { describe, expect, it } from 'vitest';
import type { ScriptStage } from '@harborclient/sdk';
import {
  defaultScriptStageForGroup,
  mergeScriptRefGroups,
  orderScriptRefsByStage,
  orderWithInjectedScripts,
  SCRIPT_STAGE_OPTIONS,
  scriptEditorGroupsForAllowedStages,
  scriptRowStageSuffix,
  scriptStageBorderColor,
  scriptStageGroup,
  splitScriptRefsByGroup
} from './scriptStage';
import { createInlineScriptRef } from './scriptRefs';

const ALL_STAGES: ScriptStage[] = ['before-all', 'before-each', 'main', 'after-each', 'after-all'];

describe('SCRIPT_STAGE_OPTIONS', () => {
  it('includes a non-empty description for every script stage', () => {
    expect(SCRIPT_STAGE_OPTIONS.map((option) => option.value)).toEqual(ALL_STAGES);
    for (const option of SCRIPT_STAGE_OPTIONS) {
      expect(option.description.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('scriptRowStageSuffix', () => {
  it('returns title-case suffixes for before and after stages only', () => {
    expect(scriptRowStageSuffix('before-all')).toBe(' (Before All)');
    expect(scriptRowStageSuffix('before-each')).toBe(' (Before Each)');
    expect(scriptRowStageSuffix('after-all')).toBe(' (After All)');
    expect(scriptRowStageSuffix('after-each')).toBe(' (After Each)');
    expect(scriptRowStageSuffix('main')).toBe('');
  });
});

describe('scriptStageBorderColor', () => {
  it('maps each stage to its --mac-script-stage-* CSS variable', () => {
    expect(scriptStageBorderColor('before-all')).toBe('var(--mac-script-stage-before-all)');
    expect(scriptStageBorderColor('before-each')).toBe('var(--mac-script-stage-before-each)');
    expect(scriptStageBorderColor('main')).toBe('var(--mac-script-stage-main)');
    expect(scriptStageBorderColor('after-each')).toBe('var(--mac-script-stage-after-each)');
    expect(scriptStageBorderColor('after-all')).toBe('var(--mac-script-stage-after-all)');
  });
});

describe('orderScriptRefsByStage', () => {
  it('runs before-all once, wraps each main script, then after-all once', () => {
    const refs = [
      createInlineScriptRef('after-all-1', 'After all', 'after-all'),
      createInlineScriptRef('main-1', 'Main 1', 'main'),
      createInlineScriptRef('before-all-1', 'Before all', 'before-all'),
      createInlineScriptRef('before-each-1', 'Before each', 'before-each'),
      createInlineScriptRef('main-2', 'Main 2', 'main'),
      createInlineScriptRef('after-each-1', 'After each', 'after-each')
    ];

    expect(orderScriptRefsByStage(refs).map((ref) => ref.code)).toEqual([
      'before-all-1',
      'before-each-1',
      'main-1',
      'after-each-1',
      'before-each-1',
      'main-2',
      'after-each-1',
      'after-all-1'
    ]);
  });

  it('runs before-all and after-all when no main scripts exist', () => {
    const refs = [
      createInlineScriptRef('after-all', undefined, 'after-all'),
      createInlineScriptRef('before-all', undefined, 'before-all')
    ];

    expect(orderScriptRefsByStage(refs).map((ref) => ref.stage)).toEqual([
      'before-all',
      'after-all'
    ]);
  });
});

describe('orderWithInjectedScripts', () => {
  it('places stage-ordered injected scripts ahead of host scripts', () => {
    const injected = [
      createInlineScriptRef('plugin-main', 'Plugin main', 'main'),
      createInlineScriptRef('plugin-before', 'Plugin before', 'before-all')
    ];
    const host = [
      createInlineScriptRef('host-before', 'Host before', 'before-all'),
      createInlineScriptRef('host-main', 'Host main', 'main')
    ];

    expect(orderWithInjectedScripts(injected, host).map((ref) => ref.code)).toEqual([
      'plugin-before',
      'plugin-main',
      'host-before',
      'host-main'
    ]);
  });
});

describe('splitScriptRefsByGroup', () => {
  it('preserves order within each editor group', () => {
    const refs = [
      createInlineScriptRef('main-1', undefined, 'main'),
      createInlineScriptRef('before-1', undefined, 'before-all'),
      createInlineScriptRef('after-1', undefined, 'after-all')
    ];
    expect(mergeScriptRefGroups(splitScriptRefsByGroup(refs))).toEqual([refs[1], refs[0], refs[2]]);
  });
});

describe('scriptStageGroup', () => {
  it('maps stages to editor groups', () => {
    expect(scriptStageGroup('before-all')).toBe('before');
    expect(scriptStageGroup('before-each')).toBe('before');
    expect(scriptStageGroup('main')).toBe('main');
    expect(scriptStageGroup('after-each')).toBe('after');
    expect(scriptStageGroup('after-all')).toBe('after');
  });
});

describe('scriptEditorGroupsForAllowedStages', () => {
  it('returns before, main, and after when all stages are allowed', () => {
    expect(scriptEditorGroupsForAllowedStages(ALL_STAGES)).toEqual(['before', 'main', 'after']);
  });

  it('returns only main when stages are restricted to main', () => {
    expect(scriptEditorGroupsForAllowedStages(['main'])).toEqual(['main']);
  });

  it('omits groups with no allowed stages', () => {
    expect(scriptEditorGroupsForAllowedStages(['before-each', 'after-all'])).toEqual([
      'before',
      'after'
    ]);
  });
});

describe('defaultScriptStageForGroup', () => {
  it('picks the first SCRIPT_STAGE_OPTIONS stage in each group', () => {
    expect(defaultScriptStageForGroup('before', ALL_STAGES)).toBe('before-all');
    expect(defaultScriptStageForGroup('main', ALL_STAGES)).toBe('main');
    expect(defaultScriptStageForGroup('after', ALL_STAGES)).toBe('after-each');
  });

  it('respects a restricted allowed-stages list within the group', () => {
    expect(defaultScriptStageForGroup('before', ['before-each', 'main'])).toBe('before-each');
    expect(defaultScriptStageForGroup('after', ['after-all'])).toBe('after-all');
  });
});
