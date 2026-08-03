import { describe, expect, it } from 'vitest';
import { defaultSidebarExpansion } from '../sidebarExpansion';
import { DEFAULT_GIT_SIDEBAR_EXPANSION } from '../gitSidebarExpansion';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from './settings';
import {
  normalizeWorkspaceLayout,
  validateWorkspaceExport,
  type WorkspaceLayout
} from './workspace';

/**
 * Builds a complete workspace layout for schema and round-trip tests.
 *
 * @param overrides - Partial fields to merge onto defaults.
 */
function sampleLayout(overrides: Partial<WorkspaceLayout> = {}): WorkspaceLayout {
  return {
    panels: {
      showSidebar: true,
      showRail: true,
      showAiSidebar: false,
      showGitSidebar: true,
      showShortcutsSidebar: false,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
      responseEditorSplit: null,
      showConsole: true,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      showLiveServerLogs: false,
      liveServerLogsPlacement: 'footer',
      liveServerLogsPlacements: {},
      activePluginFooterPanelId: null
    },
    panelSizes: {
      'hc.sidebarWidth': 420,
      'hc.gitSidebarWidth': 360
    },
    sidebarExpansion: defaultSidebarExpansion(),
    gitSidebar: {
      sections: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sections },
      sectionVisibility: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility }
    },
    activeEnvironmentUuid: 'env-uuid-1',
    theme: 'dark',
    ...overrides
  };
}

describe('normalizeWorkspaceLayout', () => {
  it('returns null for absent values', () => {
    expect(normalizeWorkspaceLayout(null)).toBeNull();
    expect(normalizeWorkspaceLayout(undefined)).toBeNull();
  });

  it('returns null for non-object garbage', () => {
    expect(normalizeWorkspaceLayout(42)).toBeNull();
    expect(normalizeWorkspaceLayout(true)).toBeNull();
  });

  it('returns null for unparseable JSON strings', () => {
    expect(normalizeWorkspaceLayout('{not-json')).toBeNull();
  });

  it('fills defaults for a partial object', () => {
    const normalized = normalizeWorkspaceLayout({
      panels: { showGitSidebar: true, showConsole: true },
      panelSizes: { 'hc.sidebarWidth': 500, 'hc.unknown': 1, 'bad': 'x' },
      activeEnvironmentUuid: '  env-1  ',
      theme: 'plugin:com.example:midnight'
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.panels.showGitSidebar).toBe(true);
    expect(normalized?.panels.showConsole).toBe(true);
    expect(normalized?.panels.showSidebar).toBe(true);
    expect(normalized?.panels.showVariables).toBe(false);
    expect(normalized?.panelSizes).toEqual({ 'hc.sidebarWidth': 500 });
    expect(normalized?.sidebarExpansion).toEqual(defaultSidebarExpansion());
    expect(normalized?.gitSidebar.sections.commitMessage).toBe(true);
    expect(normalized?.activeEnvironmentUuid).toBe('env-1');
    expect(normalized?.theme).toBe('plugin:com.example:midnight');
  });

  it('parses a JSON string layout blob', () => {
    const layout = sampleLayout({ theme: 'system', activeEnvironmentUuid: null });
    const normalized = normalizeWorkspaceLayout(JSON.stringify(layout));

    expect(normalized?.theme).toBe('system');
    expect(normalized?.activeEnvironmentUuid).toBeNull();
    expect(normalized?.panelSizes['hc.sidebarWidth']).toBe(420);
  });

  it('drops invalid theme values', () => {
    const normalized = normalizeWorkspaceLayout({ theme: 'not-a-theme' });
    expect(normalized?.theme).toBeNull();
  });
});

describe('validateWorkspaceExport', () => {
  it('accepts version 1 exports without layout', () => {
    const exportData = validateWorkspaceExport({
      harborclientVersion: 1,
      harborclientExport: 'workspace',
      name: 'Morning',
      requestUuids: ['req-1']
    });

    expect(exportData.harborclientVersion).toBe(1);
    expect(exportData.layout).toBeUndefined();
  });

  it('accepts version 2 exports with layout', () => {
    const layout = sampleLayout();
    const exportData = validateWorkspaceExport({
      harborclientVersion: 2,
      harborclientExport: 'workspace',
      name: 'Morning',
      requestUuids: ['req-1'],
      layout
    });

    expect(exportData.harborclientVersion).toBe(2);
    expect(exportData.layout?.theme).toBe('dark');
    expect(exportData.layout?.panelSizes['hc.sidebarWidth']).toBe(420);
  });

  it('rejects unknown export versions', () => {
    expect(() =>
      validateWorkspaceExport({
        harborclientVersion: 3,
        harborclientExport: 'workspace',
        name: 'Morning',
        requestUuids: []
      })
    ).toThrow(/Invalid workspace export/);
  });
});
