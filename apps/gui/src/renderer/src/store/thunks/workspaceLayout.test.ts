import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSidebarExpansion } from '@harborclient/core/sidebarExpansion';
import { DEFAULT_GIT_SIDEBAR_EXPANSION } from '@harborclient/core/gitSidebarExpansion';
import { DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT } from '@harborclient/core/types';
import type { WorkspaceLayout } from '@harborclient/core/types/workspace';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import { applyWorkspaceLayout, captureWorkspaceLayout } from './workspaceLayout';

const getSidebarExpansionMock = vi.fn();
const getThemeMock = vi.fn();
const setThemeMock = vi.fn();
const applyThemePreferenceMock = vi.fn();
const showAlertMock = vi.fn();

vi.mock('#/renderer/src/plugins/themeRuntime', () => ({
  applyThemePreference: (...args: unknown[]) => applyThemePreferenceMock(...args)
}));

vi.mock('#/renderer/src/ui/Modals/dialogHelpers', () => ({
  showAlert: (...args: unknown[]) => showAlertMock(...args),
  formatErrorMessage: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback
}));

/**
 * Builds a minimal RootState stub for workspace layout capture/apply tests.
 *
 * @param overrides - Partial environments/navigation fields to merge.
 */
function buildState(overrides?: {
  activeEnvironmentId?: number | null;
  environments?: Array<{ id: number; uuid: string; name: string }>;
}): RootState {
  return {
    navigation: {
      showSidebar: true,
      showAiSidebar: false,
      showGitSidebar: true,
      showRequestEditor: true,
      showResponseEditor: true,
      requestEditorSplitHeight: DEFAULT_REQUEST_EDITOR_SPLIT_HEIGHT,
      showConsole: false,
      showVariables: false,
      showMcp: false,
      showTerminal: true,
      activePluginFooterPanelId: null
    },
    environments: {
      activeEnvironmentId: overrides?.activeEnvironmentId ?? 2,
      environments: overrides?.environments ?? [
        {
          id: 2,
          uuid: 'env-uuid-2',
          name: 'Staging',
          variables: [],
          created_at: '2026-01-01T00:00:00.000Z'
        }
      ]
    }
  } as unknown as RootState;
}

/**
 * Builds a complete layout snapshot for apply tests.
 *
 * @param overrides - Partial layout fields to merge.
 */
function sampleLayout(overrides: Partial<WorkspaceLayout> = {}): WorkspaceLayout {
  return {
    panels: {
      showSidebar: false,
      showAiSidebar: true,
      showGitSidebar: false,
      showRequestEditor: true,
      showResponseEditor: false,
      requestEditorSplitHeight: 280,
      showConsole: true,
      showVariables: false,
      showMcp: false,
      showTerminal: false,
      activePluginFooterPanelId: null
    },
    panelSizes: { 'hc.sidebarWidth': 500 },
    sidebarExpansion: defaultSidebarExpansion(),
    gitSidebar: {
      sections: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sections, changes: false },
      sectionVisibility: { ...DEFAULT_GIT_SIDEBAR_EXPANSION.sectionVisibility }
    },
    activeEnvironmentUuid: 'env-uuid-2',
    theme: 'dark',
    ...overrides
  };
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    }
  });
  vi.stubGlobal('window', {
    api: {
      getSidebarExpansion: getSidebarExpansionMock,
      getTheme: getThemeMock,
      setTheme: setThemeMock
    },
    dispatchEvent: vi.fn()
  });

  getSidebarExpansionMock.mockReset();
  getSidebarExpansionMock.mockResolvedValue(defaultSidebarExpansion());
  getThemeMock.mockReset();
  getThemeMock.mockResolvedValue('system');
  setThemeMock.mockReset();
  setThemeMock.mockResolvedValue(undefined);
  applyThemePreferenceMock.mockReset();
  applyThemePreferenceMock.mockResolvedValue(undefined);
  showAlertMock.mockReset();
  localStorage.setItem('hc.sidebarWidth', '412');
  localStorage.setItem(
    'hc.gitSidebarExpansion',
    JSON.stringify({
      sections: { commitMessage: false, changes: true, commits: true },
      sectionVisibility: { commitMessage: true, changes: true, commits: false }
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('captureWorkspaceLayout', () => {
  it('captures panels, sizes, sidebars, environment uuid, and theme', async () => {
    const layout = await captureWorkspaceLayout(buildState());

    expect(layout.panels).toMatchObject({
      showSidebar: true,
      showGitSidebar: true,
      showTerminal: true,
      showConsole: false
    });
    expect(layout.panelSizes['hc.sidebarWidth']).toBe(412);
    expect(layout.sidebarExpansion).toEqual(defaultSidebarExpansion());
    expect(layout.gitSidebar.sections.commitMessage).toBe(false);
    expect(layout.gitSidebar.sectionVisibility.commits).toBe(false);
    expect(layout.activeEnvironmentUuid).toBe('env-uuid-2');
    expect(layout.theme).toBe('system');
  });
});

describe('applyWorkspaceLayout', () => {
  it('resolves a missing environment uuid to null', async () => {
    const dispatched: unknown[] = [];
    const dispatch = ((action: unknown) => {
      dispatched.push(action);
      return action;
    }) as AppDispatch;

    await applyWorkspaceLayout(
      sampleLayout({ activeEnvironmentUuid: 'missing-env', theme: null }),
      dispatch,
      () => buildState({ activeEnvironmentId: 2 })
    );

    const envAction = dispatched.find(
      (action) =>
        typeof action === 'object' &&
        action != null &&
        'type' in action &&
        (action as { type: string }).type === 'environments/setActiveEnvironmentId'
    ) as { payload: number | null } | undefined;

    expect(envAction?.payload).toBeNull();
    expect(applyThemePreferenceMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('hc.sidebarWidth')).toBe('500');
  });

  it('applies theme when it differs from the active preference', async () => {
    const dispatch = vi.fn() as unknown as AppDispatch;
    getThemeMock.mockResolvedValue('light');

    await applyWorkspaceLayout(sampleLayout({ theme: 'dark' }), dispatch, () => buildState());

    expect(applyThemePreferenceMock).toHaveBeenCalledWith('dark');
    expect(setThemeMock).toHaveBeenCalledWith('dark');
  });
});
