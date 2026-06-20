import type { JSX } from 'react';
import type { ResolvedVariable } from './resolve';

interface Props {
  variable: ResolvedVariable;
}

/**
 * A single variable row with scope badge and override styling.
 */
export function VariableRow({ variable }: Props): JSX.Element {
  const { key, value, scope, overridden } = variable;
  const scopeLabel = scope === 'environment' ? 'Environment' : 'Collection';
  const scopeBadgeClass =
    scope === 'environment'
      ? 'bg-accent/15 text-accent'
      : 'bg-selection text-muted';

  return (
    <div
      className={`flex items-center gap-3 border-b border-separator px-3 py-2 text-[13px] last:border-b-0 ${
        overridden ? 'opacity-60' : ''
      }`}
    >
      <span className="min-w-[120px] shrink-0 font-mono text-[12px] text-text">{key}</span>
      <span
        className={`min-w-0 flex-1 truncate font-mono text-[12px] ${
          overridden ? 'text-muted line-through' : 'text-text'
        }`}
      >
        {value !== '' ? value : <span className="text-muted">(empty)</span>}
      </span>
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${scopeBadgeClass}`}
      >
        {scopeLabel}
      </span>
      {overridden && (
        <span className="shrink-0 text-[11px] text-muted">overridden</span>
      )}
    </div>
  );
}
