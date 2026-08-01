import type { LiveServerHostProviders } from '@harborclient/live-server';
import type { ScriptRunInput, ScriptRunResult } from '@harborclient/core/types';
import { getGeneralSettings } from '#/main/settings/generalSettings';
import { getLocalDatabase } from '#/main/storage/localDatabaseInstance';
import { runScriptInProcess } from '#/main/scripting/scriptRunnerHost';

/**
 * Builds a variable map from enabled global variables in general settings.
 *
 * @returns Key → value map for script sandbox seeding and runCommand substitution.
 */
export function guiLiveServerVariablesMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const variable of getGeneralSettings().globalVariables) {
    if (variable.enabled === false) {
      continue;
    }
    const key = variable.key.trim();
    if (key === '') {
      continue;
    }
    map[key] = variable.value;
  }
  return map;
}

/**
 * Runs a live-server script in the Electron SES utility process.
 *
 * @param input - Script run payload.
 * @returns Script evaluation result.
 */
async function guiRunScript(input: ScriptRunInput): Promise<ScriptRunResult> {
  return runScriptInProcess(input);
}

/**
 * Live-server host providers wired to the GUI registry DB and script runner.
 */
export const guiLiveServerProviders: LiveServerHostProviders = {
  listSnippets: () => getLocalDatabase().listSnippets(),
  getVariables: guiLiveServerVariablesMap,
  runScript: guiRunScript
};
