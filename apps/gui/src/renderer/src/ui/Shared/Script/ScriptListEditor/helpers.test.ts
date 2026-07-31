import { describe, expect, it, vi } from 'vitest';
import {
  SCRIPT_GROUP_MENU_LABELS,
  SCRIPT_GROUP_NEW_STAGE_OPTIONS,
  buildScriptGroupActionMenuGroups
} from './helpers';

describe('SCRIPT_GROUP_NEW_STAGE_OPTIONS', () => {
  it('lists before-all before before-each', () => {
    expect(SCRIPT_GROUP_NEW_STAGE_OPTIONS.before.map((entry) => entry.stage)).toEqual([
      'before-all',
      'before-each'
    ]);
  });

  it('lists a single New script entry for main', () => {
    expect(SCRIPT_GROUP_NEW_STAGE_OPTIONS.main).toEqual([{ stage: 'main', label: 'New script' }]);
  });

  it('lists after-all before after-each', () => {
    expect(SCRIPT_GROUP_NEW_STAGE_OPTIONS.after.map((entry) => entry.stage)).toEqual([
      'after-all',
      'after-each'
    ]);
  });
});

describe('buildScriptGroupActionMenuGroups', () => {
  const snippetMenuGroups = [
    [{ label: 'Create a snippet', onSelect: () => undefined }],
    [{ label: 'Example snippet', onSelect: () => undefined }]
  ];

  it('builds before menu with both new stages and a Snippets submenu', () => {
    const onAddStage = vi.fn();
    const groups = buildScriptGroupActionMenuGroups(
      'before',
      ['before-all', 'before-each', 'main'],
      {
        onAddStage,
        snippetMenuGroups
      }
    );

    expect(groups).toHaveLength(2);
    expect(groups[0]?.map((item) => item.label)).toEqual(['New before-all', 'New before-each']);
    expect(groups[1]).toEqual([{ label: 'Snippets', submenu: snippetMenuGroups }]);

    const first = groups[0]?.[0];
    expect(first && 'onSelect' in first && first.onSelect).toBeTypeOf('function');
    if (first && 'onSelect' in first && first.onSelect) {
      first.onSelect();
    }
    expect(onAddStage).toHaveBeenCalledWith('before-all');
  });

  it('builds main menu with New script and Snippets', () => {
    const groups = buildScriptGroupActionMenuGroups('main', ['main'], {
      onAddStage: () => undefined,
      snippetMenuGroups
    });

    expect(groups[0]?.map((item) => item.label)).toEqual(['New script']);
    expect(groups[1]?.[0]?.label).toBe('Snippets');
  });

  it('builds after menu with after-all then after-each', () => {
    const groups = buildScriptGroupActionMenuGroups('after', ['after-all', 'after-each', 'main'], {
      onAddStage: () => undefined,
      snippetMenuGroups
    });

    expect(groups[0]?.map((item) => item.label)).toEqual(['New after-all', 'New after-each']);
  });

  it('filters stage items to allowedStages', () => {
    const groups = buildScriptGroupActionMenuGroups('before', ['before-each'], {
      onAddStage: () => undefined,
      snippetMenuGroups
    });

    expect(groups[0]?.map((item) => item.label)).toEqual(['New before-each']);
    expect(groups[1]?.[0]?.label).toBe('Snippets');
  });

  it('keeps only the Snippets group when no stages are allowed for the section', () => {
    const groups = buildScriptGroupActionMenuGroups('before', ['main'], {
      onAddStage: () => undefined,
      snippetMenuGroups
    });

    expect(groups).toEqual([[{ label: 'Snippets', submenu: snippetMenuGroups }]]);
  });
});

describe('SCRIPT_GROUP_MENU_LABELS', () => {
  it('provides accessible names for each section menu', () => {
    expect(SCRIPT_GROUP_MENU_LABELS).toEqual({
      before: 'Before script actions',
      main: 'Main script actions',
      after: 'After script actions'
    });
  });
});
