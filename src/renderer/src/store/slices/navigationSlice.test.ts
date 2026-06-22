import { describe, expect, it } from 'vitest';
import navigationReducer, {
  closeOverlay,
  openCertificates,
  openCollectionSettings,
  openEnvironmentSettings,
  openServiceHubs,
  openSettings,
  setCollectionSettingsDirty,
  setEnvironmentSettingsDirty,
  toggleAiSidebar,
  toggleConsole,
  toggleSidebar,
  toggleVariables
} from '#/renderer/src/store/slices/navigationSlice';

describe('navigationSlice', () => {
  it('starts on the request view with sidebar visible and panels closed', () => {
    const state = navigationReducer(undefined, { type: 'unknown' });
    expect(state.mainView).toEqual({ type: 'request' });
    expect(state.showSidebar).toBe(true);
    expect(state.showAiSidebar).toBe(false);
    expect(state.showConsole).toBe(false);
    expect(state.showVariables).toBe(false);
    expect(state.settingsSection).toBe('general');
    expect(state.collectionSettingsDirty).toBe(false);
    expect(state.environmentSettingsDirty).toBe(false);
  });

  it('opens settings and resets dirty flags', () => {
    let state = navigationReducer(undefined, setCollectionSettingsDirty(true));
    state = navigationReducer(state, openSettings());
    expect(state.mainView).toEqual({ type: 'settings' });
    expect(state.settingsSection).toBe('general');
    expect(state.collectionSettingsDirty).toBe(false);
    expect(state.environmentSettingsDirty).toBe(false);
  });

  it('opens settings on a specific section', () => {
    const state = navigationReducer(undefined, openSettings('ai'));
    expect(state.mainView).toEqual({ type: 'settings' });
    expect(state.settingsSection).toBe('ai');
  });

  it('opens service hubs and resets dirty flags', () => {
    let state = navigationReducer(undefined, setEnvironmentSettingsDirty(true));
    state = navigationReducer(state, openServiceHubs());
    expect(state.mainView).toEqual({ type: 'service-hubs' });
    expect(state.collectionSettingsDirty).toBe(false);
    expect(state.environmentSettingsDirty).toBe(false);
  });

  it('opens collection and environment settings exclusively', () => {
    let state = navigationReducer(undefined, openCollectionSettings(3));
    expect(state.mainView).toEqual({ type: 'collection', id: 3 });

    state = navigationReducer(state, openEnvironmentSettings(7));
    expect(state.mainView).toEqual({ type: 'environment', id: 7 });
  });

  it('closes overlays back to the request view', () => {
    let state = navigationReducer(undefined, openCertificates());
    state = navigationReducer(state, closeOverlay());
    expect(state.mainView).toEqual({ type: 'request' });
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
});
