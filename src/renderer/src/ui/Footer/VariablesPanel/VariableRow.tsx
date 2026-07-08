import type { JSX } from 'react';
import toast from 'react-hot-toast';

import type { ResolvedVariable } from './resolve';

interface Props {
  variable: ResolvedVariable;
}

/**
 * A single table row for a resolved variable with scope badge, override styling,
 * and a clickable name that copies `{{key}}` to the clipboard.
 */
export function VariableRow({ variable }: Props): JSX.Element {
  const { key, value, scope, overridden } = variable;
  const scopeLabel =
    scope === 'environment' ? 'Environment' : scope === 'collection' ? 'Collection' : 'Global';
  const scopeBadgeClass =
    scope === 'environment'
      ? 'bg-accent/15 text-accent'
      : scope === 'collection'
        ? 'bg-selection text-muted'
        : 'bg-control text-muted';
  const variableRef = `{{${key}}}`;

  /**
   * Copies the variable reference syntax to the clipboard and shows confirmation.
   */
  const handleCopyVariable = (): void => {
    void navigator.clipboard.writeText(variableRef).then(() => {
      toast.success('Copied to clipboard');
    });
  };

  return (
    <tr className={`border-b border-separator last:border-b-0 ${overridden ? 'opacity-60' : ''}`}>
      <td className="whitespace-nowrap px-3 py-2">
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent p-0 text-left font-mono text-[16px] hc-chat-composer-script-ref"
          aria-label={`Copy ${variableRef} to clipboard`}
          onClick={handleCopyVariable}
        >
          {variableRef}
        </button>
      </td>
      <td
        className={`max-w-0 px-3 py-2 font-mono text-[16px] ${
          overridden ? 'text-muted line-through' : 'text-text'
        }`}
      >
        <span className="block truncate">
          {value !== '' ? value : <span className="text-muted">(empty)</span>}
        </span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <span
          className={`rounded px-1.5 py-0.5 text-[14px] font-medium uppercase tracking-wide ${scopeBadgeClass}`}
        >
          {scopeLabel}
        </span>
      </td>
    </tr>
  );
}
