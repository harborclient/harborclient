import { configureStore } from '@reduxjs/toolkit';
import { busyMiddleware } from './busyMiddleware';
import collectionsReducer from '#/renderer/src/store/slices/collectionsSlice';
import environmentsReducer from '#/renderer/src/store/slices/environmentsSlice';
import tabsReducer from '#/renderer/src/store/slices/tabsSlice';
import consoleReducer from '#/renderer/src/store/slices/consoleSlice';
import uiReducer from '#/renderer/src/store/slices/uiSlice';
import navigationReducer from '#/renderer/src/store/slices/navigationSlice';
import modalsReducer from '#/renderer/src/store/slices/modalsSlice';
import settingsReducer from '#/renderer/src/store/slices/settingsSlice';
import settingsDraftReducer from '#/renderer/src/store/slices/settingsDraftSlice';
import runResultsReducer from '#/renderer/src/store/slices/runResultsSlice';
import requestHistoryReducer from '#/renderer/src/store/slices/requestHistorySlice';
import tabGroupsReducer from '#/renderer/src/store/slices/tabGroupSlice';
import trashReducer from '#/renderer/src/store/slices/trashSlice';
import snippetsReducer from '#/renderer/src/store/slices/snippetsSlice';
import scriptClipboardReducer from '#/renderer/src/store/slices/scriptClipboardSlice';
import aiChatReducer from '#/renderer/src/store/slices/aiChatSlice';
import terminalsReducer from '#/renderer/src/store/slices/terminalsSlice';
import markdownSelectionsReducer from '#/renderer/src/store/slices/markdownSelectionsSlice';
import themeDesignerReducer from '#/renderer/src/store/slices/themeDesignerSlice';
import { persistActiveEnvironmentId, persistTabs, persistTerminalLayout } from './persistence';
export const store = configureStore({
  reducer: {
    collections: collectionsReducer,
    environments: environmentsReducer,
    tabs: tabsReducer,
    console: consoleReducer,
    ui: uiReducer,
    navigation: navigationReducer,
    modals: modalsReducer,
    settings: settingsReducer,
    settingsDraft: settingsDraftReducer,
    snippets: snippetsReducer,
    scriptClipboard: scriptClipboardReducer,
    runResults: runResultsReducer,
    requestHistory: requestHistoryReducer,
    tabGroups: tabGroupsReducer,
    trash: trashReducer,
    aiChat: aiChatReducer,
    terminals: terminalsReducer,
    markdownSelections: markdownSelectionsReducer,
    themeDesigner: themeDesignerReducer
  },
  /**
   * Registers default RTK middleware plus busy tracking.
   *
   * @param getDefaultMiddleware - RTK default middleware factory.
   * @returns Configured middleware chain.
   */
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(busyMiddleware)
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/**
 * Typed thunk API for createAsyncThunk generics.
 */
export type ThunkApiConfig = {
  state: RootState;
};

/**
 * Persists tabs and active environment whenever store state changes.
 */
store.subscribe(() => {
  const state = store.getState();
  persistTabs(state.tabs.tabs, state.tabs.activeTabId);
  persistActiveEnvironmentId(state.environments.activeEnvironmentId);
  if (state.terminals.terminalsHydrated) {
    persistTerminalLayout(state.terminals.terminals, state.terminals.activeTerminalId);
  }
});
