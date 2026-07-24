import type { PluginVariableInput } from '@harborclient/sdk';
import type { Variable } from '#/shared/types';
import { store } from '#/renderer/src/store/redux';
import { selectEnvironments } from '#/renderer/src/store/selectors';
import { createEnvironment, updateEnvironment } from '#/renderer/src/store/thunks/environments';
import { registerCommand } from './createPluginContext';

const HOST_PLUGIN_ID = 'harborclient';

/**
 * Validates plugin-provided variable rows before persisting them.
 *
 * @param variables - Variable rows from a plugin host command.
 * @returns Normalized HarborClient variable rows.
 */
export function pluginVariablesToVariables(variables: PluginVariableInput[]): Variable[] {
  if (!Array.isArray(variables)) {
    throw new Error('Environment variables must be an array.');
  }

  const rows: Variable[] = [];
  for (const variable of variables) {
    if (!variable || typeof variable !== 'object') {
      throw new Error('Each environment variable must be an object.');
    }
    const key = typeof variable.key === 'string' ? variable.key.trim() : '';
    if (!key) {
      throw new Error('Environment variable keys must be non-empty strings.');
    }
    rows.push({
      key,
      value: typeof variable.value === 'string' ? variable.value : '',
      defaultValue: typeof variable.defaultValue === 'string' ? variable.defaultValue : '',
      share: variable.share === true
    });
  }
  return rows;
}

/**
 * Creates a new environment populated with plugin-provided variables.
 *
 * @param name - Display name for the new environment.
 * @param variables - Initial variable rows.
 * @returns Created environment id and trimmed name.
 */
export async function createEnvironmentWithVariables(
  name: string,
  variables: PluginVariableInput[]
): Promise<{ id: number; name: string }> {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    throw new Error('Environment name is required.');
  }

  const normalizedVariables = pluginVariablesToVariables(variables);
  const created = await store.dispatch(createEnvironment(trimmedName)).unwrap();
  await store
    .dispatch(
      updateEnvironment({
        id: created.id,
        name: trimmedName,
        variables: normalizedVariables
      })
    )
    .unwrap();

  return { id: created.id, name: trimmedName };
}

/**
 * Replaces all variables on an existing environment with plugin-provided rows.
 *
 * @param environmentId - Target environment database id.
 * @param variables - Variable rows that fully replace the current list.
 */
export async function updateEnvironmentVariables(
  environmentId: number,
  variables: PluginVariableInput[]
): Promise<void> {
  if (typeof environmentId !== 'number') {
    throw new Error('Environment id must be a number.');
  }

  const state = store.getState();
  const environment = selectEnvironments(state).find((entry) => entry.id === environmentId);
  if (!environment) {
    throw new Error(`Environment ${environmentId} is not available.`);
  }

  const normalizedVariables = pluginVariablesToVariables(variables);
  await store
    .dispatch(
      updateEnvironment({
        id: environmentId,
        name: environment.name,
        variables: normalizedVariables
      })
    )
    .unwrap();
}

/**
 * Registers host commands that let plugins create and update environments.
 *
 * @returns Disposer that unregisters the host environment commands.
 */
export function registerHostEnvironmentCommands(): () => void {
  const disposables = [
    registerCommand(HOST_PLUGIN_ID, 'createEnvironmentWithVariables', async (name, variables) => {
      if (typeof name !== 'string') {
        throw new Error('harborclient.createEnvironmentWithVariables requires a name string.');
      }
      await createEnvironmentWithVariables(name, variables as PluginVariableInput[]);
    }),
    registerCommand(
      HOST_PLUGIN_ID,
      'updateEnvironmentVariables',
      async (environmentId, variables) => {
        if (typeof environmentId !== 'number') {
          throw new Error(
            'harborclient.updateEnvironmentVariables requires a numeric environment id.'
          );
        }
        await updateEnvironmentVariables(environmentId, variables as PluginVariableInput[]);
      }
    )
  ];

  return () => {
    for (const disposable of disposables) {
      disposable.dispose();
    }
  };
}
