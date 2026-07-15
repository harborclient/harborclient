import type { PluginVariableInput } from '@harborclient/sdk';
import type { Variable } from '#/shared/types';
import { store } from '#/renderer/src/store/redux';
import { saveGlobalVariables } from '#/renderer/src/store/thunks/settings';
import { registerCommand } from './createPluginContext';
import { pluginVariablesToVariables } from './hostEnvironmentCommands';

const HOST_PLUGIN_ID = 'harborclient';

/**
 * Returns the current app-wide global variables from the renderer store.
 *
 * @returns Normalized global variable rows.
 */
export function getGlobalVariables(): Variable[] {
  return store.getState().settings.general.globalVariables;
}

/**
 * Replaces all app-wide global variables with plugin-provided rows.
 *
 * @param variables - Variable rows that fully replace the current list.
 */
export async function updateGlobalVariables(variables: PluginVariableInput[]): Promise<void> {
  const normalizedVariables = pluginVariablesToVariables(variables);
  await store.dispatch(saveGlobalVariables(normalizedVariables)).unwrap();
}

/**
 * Upserts one app-wide global variable without replacing the full list.
 *
 * @param name - Variable key to set or update.
 * @param value - Variable value stored for substitution.
 */
export async function setGlobalVariable(name: string, value: string): Promise<void> {
  const key = String(name).trim();
  if (!key) {
    throw new Error('Global variable name is required.');
  }

  const current = getGlobalVariables();
  const nextValue = String(value);
  const existingIndex = current.findIndex((row) => row.key === key);
  const next: Variable[] =
    existingIndex >= 0
      ? current.map((row, index) =>
          index === existingIndex ? { ...row, value: nextValue, enabled: true } : row
        )
      : [...current, { key, value: nextValue, defaultValue: '', share: false, enabled: true }];

  await store.dispatch(saveGlobalVariables(next)).unwrap();
}

/**
 * Registers host commands that let plugins update global variables.
 *
 * @returns Disposer that unregisters the host global variable commands.
 */
export function registerHostGlobalsCommands(): () => void {
  const disposables = [
    registerCommand(HOST_PLUGIN_ID, 'updateGlobalVariables', async (variables) => {
      await updateGlobalVariables(variables as PluginVariableInput[]);
    }),
    registerCommand(HOST_PLUGIN_ID, 'setGlobalVariable', async (name, value) => {
      await setGlobalVariable(name as string, value as string);
    })
  ];

  return () => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  };
}
