import { describe, expect, it } from 'vitest';
import navigationReducer, {
  consumePendingPluginInstall,
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty,
  setPendingPluginInstall,
  toggleAiSidebar,
  toggleConsole,
  toggleSidebar,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';

describe('navigationSlice', () => {
  it('starts with sidebar visible and panels closed', () => {
    const state = navigationReducer(undefined, { type: 'unknown' });
    expect(state.showSidebar).toBe(true);
    expect(state.showAiSidebar).toBe(false);
    expect(state.showConsole).toBe(false);
    expect(state.showVariables).toBe(false);
    expect(state.collectionSettingsDirty).toBe(false);
    expect(state.environmentSettingsDirty).toBe(false);
  });

  it('toggles console and variables exclusively', () => {
    let state = navigationReducer(undefined, toggleConsole());
    expect(state.showConsole).toBe(true);
    expect(state.showVariables).toBe(false);

    state = navigationReducer(state, toggleVariables());
    expect(state.showConsole).toBe(false);
    expect(state.showVariables).toBe(true);
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

  it('queues and clears pending plugin install ids from deep links', () => {
    let state = navigationReducer(undefined, setPendingPluginInstall('com.example.plugin'));
    expect(state.pendingPluginInstallId).toBe('com.example.plugin');
    state = navigationReducer(state, consumePendingPluginInstall());
    expect(state.pendingPluginInstallId).toBeNull();
  });
});
