import { describe, expect, it } from 'vitest';
import navigationReducer, {
  applyLiveServerLogsPlacementForSavedId,
  consumePendingPluginInstall,
  openLiveServerLogs,
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty,
  setLiveServerLogsPlacement,
  setPendingPluginInstall,
  toggleAiSidebar,
  toggleGitSidebar,
  toggleShortcutsSidebar,
  openGitSidebar,
  toggleConsole,
  toggleLiveServerLogs,
  toggleLiveServerLogsPlacement,
  toggleMcp,
  toggleTerminal,
  toggleRequestEditor,
  toggleResponseEditor,
  setRequestEditorSplitHeight,
  toggleRail,
  toggleSidebar,
  toggleVariables
} from './navigationSlice';

describe('navigationSlice', () => {
  it('starts with sidebar visible and panels closed', () => {
    const state = navigationReducer(undefined, { type: 'unknown' });
    expect(state.showSidebar).toBe(true);
    expect(state.showRail).toBe(true);
    expect(state.showAiSidebar).toBe(false);
    expect(state.showGitSidebar).toBe(false);
    expect(state.showShortcutsSidebar).toBe(false);
    expect(state.showRequestEditor).toBe(true);
    expect(state.showResponseEditor).toBe(true);
    expect(state.requestEditorSplitHeight).toBe(340);
    expect(state.showConsole).toBe(false);
    expect(state.showVariables).toBe(false);
    expect(state.showMcp).toBe(false);
    expect(state.showTerminal).toBe(false);
    expect(state.showLiveServerLogs).toBe(false);
    expect(state.liveServerLogsPlacement).toBe('footer');
    expect(state.collectionSettingsDirty).toBe(false);
    expect(state.environmentSettingsDirty).toBe(false);
  });

  it('toggles console and variables exclusively', () => {
    let state = navigationReducer(undefined, toggleConsole());
    expect(state.showConsole).toBe(true);
    expect(state.showVariables).toBe(false);
    expect(state.showMcp).toBe(false);
    expect(state.showTerminal).toBe(false);
    expect(state.showLiveServerLogs).toBe(false);

    state = navigationReducer(state, toggleVariables());
    expect(state.showConsole).toBe(false);
    expect(state.showVariables).toBe(true);
    expect(state.showMcp).toBe(false);
    expect(state.showTerminal).toBe(false);
    expect(state.showLiveServerLogs).toBe(false);
  });

  it('toggles terminal panel exclusively with other footer panels', () => {
    let state = navigationReducer(undefined, toggleConsole());
    expect(state.showConsole).toBe(true);

    state = navigationReducer(state, toggleTerminal());
    expect(state.showConsole).toBe(false);
    expect(state.showTerminal).toBe(true);
    expect(state.showLiveServerLogs).toBe(false);

    state = navigationReducer(state, toggleTerminal());
    expect(state.showTerminal).toBe(false);
  });

  it('toggles live-server logs panel exclusively with other footer panels', () => {
    let state = navigationReducer(undefined, toggleTerminal());
    expect(state.showTerminal).toBe(true);

    state = navigationReducer(state, toggleLiveServerLogs());
    expect(state.showTerminal).toBe(false);
    expect(state.showLiveServerLogs).toBe(true);

    state = navigationReducer(state, toggleLiveServerLogs());
    expect(state.showLiveServerLogs).toBe(false);
  });

  it('toggles live-server logs placement while keeping the viewer open', () => {
    let state = navigationReducer(undefined, openLiveServerLogs());
    expect(state.showLiveServerLogs).toBe(true);
    expect(state.liveServerLogsPlacement).toBe('footer');

    state = navigationReducer(state, toggleLiveServerLogsPlacement(5));
    expect(state.showLiveServerLogs).toBe(true);
    expect(state.liveServerLogsPlacement).toBe('sidebar');
    expect(state.liveServerLogsPlacements).toEqual({ '5': 'sidebar' });
    expect(state.showAiSidebar).toBe(false);

    state = navigationReducer(state, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(true);
    expect(state.showLiveServerLogs).toBe(false);

    state = navigationReducer(state, setLiveServerLogsPlacement('sidebar'));
    state = navigationReducer(state, openLiveServerLogs());
    expect(state.showLiveServerLogs).toBe(true);
    expect(state.showAiSidebar).toBe(false);

    state = navigationReducer(state, toggleConsole());
    expect(state.showConsole).toBe(true);
    expect(state.showLiveServerLogs).toBe(true);

    state = navigationReducer(state, toggleLiveServerLogsPlacement(5));
    expect(state.liveServerLogsPlacement).toBe('footer');
    expect(state.liveServerLogsPlacements).toEqual({ '5': 'footer' });
    expect(state.showLiveServerLogs).toBe(true);
    expect(state.showConsole).toBe(false);
  });

  it('remembers dock placement per saved live server', () => {
    let state = navigationReducer(undefined, toggleLiveServerLogsPlacement(1));
    expect(state.liveServerLogsPlacement).toBe('sidebar');
    expect(state.liveServerLogsPlacements).toEqual({ '1': 'sidebar' });

    state = navigationReducer(state, applyLiveServerLogsPlacementForSavedId(2));
    expect(state.liveServerLogsPlacement).toBe('footer');

    state = navigationReducer(state, toggleLiveServerLogsPlacement(2));
    expect(state.liveServerLogsPlacement).toBe('sidebar');
    expect(state.liveServerLogsPlacements).toEqual({ '1': 'sidebar', '2': 'sidebar' });

    state = navigationReducer(state, toggleLiveServerLogsPlacement(2));
    expect(state.liveServerLogsPlacement).toBe('footer');
    expect(state.liveServerLogsPlacements).toEqual({ '1': 'sidebar', '2': 'footer' });

    state = navigationReducer(state, applyLiveServerLogsPlacementForSavedId(1));
    expect(state.liveServerLogsPlacement).toBe('sidebar');

    state = navigationReducer(state, applyLiveServerLogsPlacementForSavedId(null));
    expect(state.liveServerLogsPlacement).toBe('footer');
  });

  it('toggles MCP panel exclusively with console', () => {
    let state = navigationReducer(undefined, toggleConsole());
    expect(state.showConsole).toBe(true);

    state = navigationReducer(state, toggleMcp());
    expect(state.showConsole).toBe(false);
    expect(state.showMcp).toBe(true);

    state = navigationReducer(state, toggleMcp());
    expect(state.showMcp).toBe(false);
  });

  it('tracks settings dirty flags independently', () => {
    let state = navigationReducer(undefined, setCollectionSettingsDirty(true));
    state = navigationReducer(state, setEnvironmentSettingsDirty(true));
    expect(state.collectionSettingsDirty).toBe(true);
    expect(state.environmentSettingsDirty).toBe(true);
  });

  it('toggles sidebar visibility', () => {
    let state = navigationReducer(undefined, toggleSidebar());
    expect(state.showSidebar).toBe(false);
    state = navigationReducer(state, toggleSidebar());
    expect(state.showSidebar).toBe(true);
  });

  it('toggles activity-rail visibility', () => {
    let state = navigationReducer(undefined, toggleRail());
    expect(state.showRail).toBe(false);
    state = navigationReducer(state, toggleRail());
    expect(state.showRail).toBe(true);
  });

  it('toggles AI sidebar visibility', () => {
    let state = navigationReducer(undefined, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(true);
    state = navigationReducer(state, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(false);
  });

  it('closes Git sidebar when opening AI sidebar', () => {
    let state = navigationReducer(undefined, toggleGitSidebar());
    expect(state.showGitSidebar).toBe(true);

    state = navigationReducer(state, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(true);
    expect(state.showGitSidebar).toBe(false);
    expect(state.showShortcutsSidebar).toBe(false);
  });

  it('closes AI sidebar when opening Git sidebar', () => {
    let state = navigationReducer(undefined, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(true);

    state = navigationReducer(state, toggleGitSidebar());
    expect(state.showGitSidebar).toBe(true);
    expect(state.showAiSidebar).toBe(false);
    expect(state.showShortcutsSidebar).toBe(false);
  });

  it('closes AI and Git sidebars when opening Shortcuts sidebar', () => {
    let state = navigationReducer(undefined, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(true);

    state = navigationReducer(state, toggleShortcutsSidebar());
    expect(state.showShortcutsSidebar).toBe(true);
    expect(state.showAiSidebar).toBe(false);
    expect(state.showGitSidebar).toBe(false);
  });

  it('closes Shortcuts sidebar when opening AI sidebar', () => {
    let state = navigationReducer(undefined, toggleShortcutsSidebar());
    expect(state.showShortcutsSidebar).toBe(true);

    state = navigationReducer(state, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(true);
    expect(state.showShortcutsSidebar).toBe(false);
  });

  it('openGitSidebar enables Git and closes other right sidebars', () => {
    let state = navigationReducer(undefined, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(true);

    state = navigationReducer(state, openGitSidebar());
    expect(state.showGitSidebar).toBe(true);
    expect(state.showAiSidebar).toBe(false);
    expect(state.showShortcutsSidebar).toBe(false);
  });

  it('toggles request editor visibility when response is visible', () => {
    let state = navigationReducer(undefined, toggleRequestEditor());
    expect(state.showRequestEditor).toBe(false);
    expect(state.showResponseEditor).toBe(true);

    state = navigationReducer(state, toggleRequestEditor());
    expect(state.showRequestEditor).toBe(true);
    expect(state.showResponseEditor).toBe(true);
  });

  it('toggles response editor visibility when request is visible', () => {
    let state = navigationReducer(undefined, toggleResponseEditor());
    expect(state.showRequestEditor).toBe(true);
    expect(state.showResponseEditor).toBe(false);

    state = navigationReducer(state, toggleResponseEditor());
    expect(state.showRequestEditor).toBe(true);
    expect(state.showResponseEditor).toBe(true);
  });

  it('prevents hiding the last visible request/response editor', () => {
    let state = navigationReducer(undefined, toggleRequestEditor());
    expect(state.showRequestEditor).toBe(false);

    state = navigationReducer(state, toggleResponseEditor());
    expect(state.showRequestEditor).toBe(false);
    expect(state.showResponseEditor).toBe(true);
  });

  it('sets request editor split height', () => {
    const state = navigationReducer(undefined, setRequestEditorSplitHeight(480));
    expect(state.requestEditorSplitHeight).toBe(480);
  });

  it('queues and clears pending plugin install ids from deep links', () => {
    let state = navigationReducer(undefined, setPendingPluginInstall('com.example.plugin'));
    expect(state.pendingPluginInstallId).toBe('com.example.plugin');
    state = navigationReducer(state, consumePendingPluginInstall());
    expect(state.pendingPluginInstallId).toBeNull();
  });
});
