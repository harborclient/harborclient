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
import workflowRunHistoryReducer from '#/renderer/src/store/slices/workflowRunHistorySlice';
import workspacesReducer from '#/renderer/src/store/slices/workspaceSlice';
import workflowsReducer from '#/renderer/src/store/slices/workflowsSlice';
import websitesReducer from '#/renderer/src/store/slices/websitesSlice';
import trashReducer from '#/renderer/src/store/slices/trashSlice';
import snippetsReducer from '#/renderer/src/store/slices/snippetsSlice';
import scriptClipboardReducer from '#/renderer/src/store/slices/scriptClipboardSlice';
import aiChatReducer from '#/renderer/src/store/slices/aiChatSlice';
import terminalsReducer from '#/renderer/src/store/slices/terminalsSlice';
import markdownSelectionsReducer from '#/renderer/src/store/slices/markdownSelectionsSlice';
import requestBodySelectionsReducer from '#/renderer/src/store/slices/requestBodySelectionsSlice';
import responseSelectionsReducer from '#/renderer/src/store/slices/responseSelectionsSlice';
import scriptSelectionsReducer from '#/renderer/src/store/slices/scriptSelectionsSlice';
import pluginSelectionsReducer from '#/renderer/src/store/slices/pluginSelectionsSlice';
import themeDesignerReducer from '#/renderer/src/store/slices/themeDesignerSlice';
import openApiImportReducer from '#/renderer/src/store/slices/openApiImportSlice';
import { workflowRecordMiddleware } from '#/renderer/src/workflows/workflowRecordMiddleware';
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
    workflowRunHistory: workflowRunHistoryReducer,
    workspaces: workspacesReducer,
    workflows: workflowsReducer,
    websites: websitesReducer,
    trash: trashReducer,
    aiChat: aiChatReducer,
    terminals: terminalsReducer,
    markdownSelections: markdownSelectionsReducer,
    requestBodySelections: requestBodySelectionsReducer,
    responseSelections: responseSelectionsReducer,
    scriptSelections: scriptSelectionsReducer,
    pluginSelections: pluginSelectionsReducer,
    themeDesigner: themeDesignerReducer,
    openApiImport: openApiImportReducer
  },
  /**
   * Registers default RTK middleware plus busy tracking and workflow recording.
   *
   * @param getDefaultMiddleware - RTK default middleware factory.
   * @returns Configured middleware chain.
   */
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(busyMiddleware, workflowRecordMiddleware)
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
