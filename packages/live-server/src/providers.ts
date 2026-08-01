import type { ScriptRunInput, ScriptRunResult, Snippet } from '@harborclient/core/types';

/**
 * Host-injected dependencies for starting a live server outside of Electron.
 *
 * The GUI supplies the registry DB, Settings globals, and SES utility-process
 * runner. The CLI supplies SQLite snippets, CliSettingsProvider globals, and
 * {@link NodeScriptRunner}.
 */
export interface LiveServerHostProviders {
  /**
   * Returns snippets used to resolve `kind: 'snippet'` script rows.
   */
  listSnippets: () => Snippet[];

  /**
   * Returns the current global-variable map for script seeding and
   * `runCommand` `{{variable}}` substitution.
   */
  getVariables: () => Record<string, string>;

  /**
   * Executes a pre/post request script (SES sandbox or Node adapter).
   *
   * @param input - Script run payload.
   * @returns Script evaluation result.
   */
  runScript: (input: ScriptRunInput) => Promise<ScriptRunResult>;
}
