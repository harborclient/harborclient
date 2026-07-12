import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDispatch, RootState } from '#/renderer/src/store/redux';
import settingsReducer from '#/renderer/src/store/slices/settingsSlice';
import { confirmAgentTerminalCommand } from '#/renderer/src/store/thunks/aiChat';
import { defaultGeneralSettings } from '#/renderer/src/store/slices/settingsSlice';

const showConfirmMock = vi.hoisted(() =>
  vi.fn<
    (
      dispatch: AppDispatch,
      options: {
        title: string;
        message: string;
        confirmLabel?: string;
        checkboxLabel?: string;
      }
    ) => Promise<{ confirmed: boolean; checkboxChecked: boolean }>
  >()
);

const setGeneralSettingsMock = vi.hoisted(() => vi.fn<(settings: unknown) => Promise<void>>());

vi.mock('#/renderer/src/ui/modals/dialogHelpers', () => ({
  showConfirm: showConfirmMock
}));

vi.stubGlobal('window', {
  api: {
    setGeneralSettings: setGeneralSettingsMock
  }
});

/**
 * Builds a minimal store for confirmAgentTerminalCommand tests.
 *
 * @param warnWhenAgentUsesTerminal - Whether the terminal confirmation prompt is enabled.
 */
function createTestStore(
  warnWhenAgentUsesTerminal: boolean
): ReturnType<typeof configureStore<{ settings: ReturnType<typeof settingsReducer> }>> {
  return configureStore({
    reducer: {
      settings: settingsReducer
    },
    preloadedState: {
      settings: {
        general: {
          ...defaultGeneralSettings,
          warnWhenAgentUsesTerminal
        }
      }
    }
  });
}

describe('confirmAgentTerminalCommand', () => {
  beforeEach(() => {
    showConfirmMock.mockReset();
    setGeneralSettingsMock.mockReset();
    setGeneralSettingsMock.mockResolvedValue(undefined);
  });

  it('returns true without prompting when confirmations are suppressed', async () => {
    const store = createTestStore(false);
    const dispatch = store.dispatch as AppDispatch;

    const allowed = await confirmAgentTerminalCommand(
      JSON.stringify({ input: 'ls\n' }),
      store.getState as unknown as () => RootState,
      dispatch
    );

    expect(allowed).toBe(true);
    expect(showConfirmMock).not.toHaveBeenCalled();
  });

  it('returns true when the user allows the command', async () => {
    const store = createTestStore(true);
    const dispatch = store.dispatch as AppDispatch;
    showConfirmMock.mockResolvedValue({ confirmed: true, checkboxChecked: false });

    const allowed = await confirmAgentTerminalCommand(
      JSON.stringify({ input: 'ls\n' }),
      store.getState as unknown as () => RootState,
      dispatch
    );

    expect(allowed).toBe(true);
    expect(showConfirmMock).toHaveBeenCalledWith(
      dispatch,
      expect.objectContaining({
        title: 'Allow terminal command?',
        message: 'Agent is attempting to send commands to the terminal.\n\nls\n',
        confirmLabel: 'Allow',
        checkboxLabel: 'Do not show again'
      })
    );
    expect(setGeneralSettingsMock).not.toHaveBeenCalled();
  });

  it('persists suppression when the user checks do not show again', async () => {
    const store = createTestStore(true);
    const dispatch = store.dispatch as AppDispatch;
    showConfirmMock.mockResolvedValue({ confirmed: true, checkboxChecked: true });

    const allowed = await confirmAgentTerminalCommand(
      JSON.stringify({ input: 'pwd\n' }),
      store.getState as unknown as () => RootState,
      dispatch
    );

    expect(allowed).toBe(true);
    expect(setGeneralSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ warnWhenAgentUsesTerminal: false })
    );
    expect(store.getState().settings.general.warnWhenAgentUsesTerminal).toBe(false);
  });

  it('returns false when the user declines the command', async () => {
    const store = createTestStore(true);
    const dispatch = store.dispatch as AppDispatch;
    showConfirmMock.mockResolvedValue({ confirmed: false, checkboxChecked: false });

    const allowed = await confirmAgentTerminalCommand(
      JSON.stringify({ input: 'rm -rf /\n' }),
      store.getState as unknown as () => RootState,
      dispatch
    );

    expect(allowed).toBe(false);
    expect(setGeneralSettingsMock).not.toHaveBeenCalled();
  });
});
