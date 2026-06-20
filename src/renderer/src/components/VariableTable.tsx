import type { JSX } from 'react';
import type { Variable } from '#/shared/types';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { faPlus, faXmark } from '#/renderer/src/fontawesome';
import { field, iconButtonDanger, toolbarButton } from '#/renderer/src/ui/classes';

const emptyVariable = (): Variable => ({ key: '', value: '', defaultValue: '', share: false });

const thClass = 'pb-1 text-left text-[11px] font-medium uppercase tracking-wide text-muted';

interface Props {
  /**
   * Variable rows to display.
   */
  variables: Variable[];

  /**
   * Called when variable rows change.
   */
  onChange: (variables: Variable[]) => void;

  /**
   * Optional helper text above the table.
   */
  description?: string;
}

/**
 * Editable table for key/value/default/share variable rows.
 */
export function VariableTable({ variables, onChange, description }: Props): JSX.Element {
  /**
   * Updates a single variable row by index.
   *
   * @param index - Row index to update.
   * @param patch - Partial fields to merge into the row.
   */
  const updateVariable = (index: number, patch: Partial<Variable>): void => {
    onChange(variables.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  /** Appends a blank variable row. */
  const addVariable = (): void => {
    onChange([...variables, emptyVariable()]);
  };

  /**
   * Removes a variable row, keeping at least one empty row.
   *
   * @param index - Row index to remove.
   */
  const removeVariable = (index: number): void => {
    if (variables.length === 1) {
      onChange([emptyVariable()]);
      return;
    }
    onChange(variables.filter((_, i) => i !== index));
  };

  return (
    <div>
      {description && <p className="mb-3 text-[12px] text-muted">{description}</p>}

      <div className="flex flex-col gap-1.5">
        <table className="w-full border-separate border-spacing-x-1.5 border-spacing-y-1.5">
          <thead>
            <tr>
              <th className={thClass}>Key</th>
              <th className={thClass}>Value</th>
              <th className={thClass}>Default</th>
              <th className={`${thClass} w-14 text-center`}>Share</th>
              <th className={`${thClass} w-7 p-0 text-center`} />
            </tr>
          </thead>
          <tbody>
            {variables.map((variable, index) => (
              <tr className="group" key={index}>
                <td>
                  <input
                    type="text"
                    className={`${field} w-full`}
                    value={variable.key}
                    placeholder="variable"
                    onChange={(e) => updateVariable(index, { key: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className={`${field} w-full`}
                    value={variable.value}
                    placeholder="value"
                    onChange={(e) => updateVariable(index, { value: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className={`${field} w-full`}
                    value={variable.defaultValue}
                    placeholder="default"
                    onChange={(e) => updateVariable(index, { defaultValue: e.target.value })}
                  />
                </td>
                <td className="w-14 text-center">
                  <input
                    type="checkbox"
                    checked={variable.share}
                    onChange={(e) => updateVariable(index, { share: e.target.checked })}
                    title="Include value in export"
                  />
                </td>
                <td className="w-7 p-0 text-center">
                  <button
                    type="button"
                    className={iconButtonDanger}
                    onClick={() => removeVariable(index)}
                    title="Remove"
                  >
                    <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className={`${toolbarButton} inline-flex items-center gap-1 self-start`}
          onClick={addVariable}
        >
          <FaIcon icon={faPlus} className="h-3 w-3" />
          Add variable
        </button>
      </div>
    </div>
  );
}
