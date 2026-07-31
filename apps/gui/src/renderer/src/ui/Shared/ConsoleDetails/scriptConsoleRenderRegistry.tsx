import type { JSX } from 'react';
import type { ScriptConsoleComponent, ScriptLogEntry } from '@harborclient/core/types';
import { scriptConsoleComponentForMethod } from '@harborclient/core/scripting/scriptConsoleRegistry';
import { Log } from './Log';
import { Table } from './Table';
import { Trace } from './Trace';

/**
 * Renders the body of a script console log entry using the component mapped for its method.
 *
 * @param entry - Host-enriched console line.
 * @returns Message body JSX for {@link ScriptLogRow}.
 */
export function renderScriptConsoleEntryBody(entry: ScriptLogEntry): JSX.Element {
  const component: ScriptConsoleComponent = scriptConsoleComponentForMethod(entry.method);

  if (component === 'table' && entry.table != null) {
    return <Table table={entry.table} />;
  }

  if (component === 'trace') {
    return <Trace message={entry.message} />;
  }

  const logType =
    entry.method === 'debug'
      ? 'debug'
      : entry.level === 'error' || entry.level === 'warn'
        ? entry.level
        : 'log';

  return <Log type={logType} message={entry.message} />;
}
