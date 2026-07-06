import { describe, expect, it } from 'vitest';
import navigationReducer, {
  consumePendingPluginInstall,
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty,
  setPendingPluginInstall,
  toggleAiSidebar,
  toggleConsole,
  toggleMcp,
  toggleRequestEditor,
  toggleResponseEditor,
  setRequestEditorSplitHeight,
  toggleSidebar,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';

describe('navigationSlice', () => {
  it('starts with sidebar visible and panels closed', () => {
    const state = navigationReducer(undefined, { type: 'unknown' });
    expect(state.showSidebar).toBe(true);
    expect(state.showAiSidebar).toBe(false);
    expect(state.showRequestEditor).toBe(true);
    expect(state.showResponseEditor).toBe(true);
    expect(state.requestEditorSplitHeight).toBe(340);
    expect(state.showConsole).toBe(false);
    expect(state.showVariables).toBe(false);
    expect(state.showMcp).toBe(false);
    expect(state.collectionSettingsDirty).toBe(false);
    expect(state.environmentSettingsDirty).toBe(false);
  });

  it('toggles console and variables exclusively', () => {
    let state = navigationReducer(undefined, toggleConsole());
    expect(state.showConsole).toBe(true);
    expect(state.showVariables).toBe(false);
    expect(state.showMcp).toBe(false);

    state = navigationReducer(state, toggleVariables());
    expect(state.showConsole).toBe(false);
    expect(state.showVariables).toBe(true);
    expect(state.showMcp).toBe(false);
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

  it('toggles AI sidebar visibility', () => {
    let state = navigationReducer(undefined, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(true);
    state = navigationReducer(state, toggleAiSidebar());
    expect(state.showAiSidebar).toBe(false);
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
