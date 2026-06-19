import type { JSX } from 'react';
import type { KeyValue, Variable } from '#/shared/types';
import { FaIcon } from '#/renderer/src/components/FaIcon';
import { VariableInput } from '#/renderer/src/components/VariableInput';
import { faPlus, faXmark } from '#/renderer/src/fontawesome';
import { field, iconButtonDanger, toolbarButton } from '#/renderer/src/ui/classes';

interface Props {
  /**
   * Editable key-value rows.
   */
  rows: KeyValue[];

  /**
   * Called when rows are added, updated, or removed.
   *
   * @param rows - Updated row list.
   */
  onChange: (rows: KeyValue[]) => void;

  /**
   * Placeholder text for the key column.
   */
  placeholderKey?: string;

  /**
   * Placeholder text for the value column.
   */
  placeholderValue?: string;

  /**
   * Collection-scoped variables for value highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit a hovered variable.
   */
  onEditVariable?: () => void;
}

const rowGrid = 'grid grid-cols-[24px_1fr_1fr_28px] items-center gap-1.5';

/**
 * Editable table of key-value rows with enable toggles for headers and params.
 */
export function KeyValueEditor({
  rows,
  onChange,
  placeholderKey = 'Key',
  placeholderValue = 'Value',
  variables,
  onEditVariable
}: Props): JSX.Element {
  /**
   * Updates a single row by index.
   *
   * @param index - Row index to update.
   * @param patch - Partial fields to merge into the row.
   */
  const updateRow = (index: number, patch: Partial<KeyValue>): void => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    onChange(next);
  };

  /** Appends a blank row to the table. */
  const addRow = (): void => {
    onChange([...rows, { key: '', value: '', enabled: true }]);
  };

  /**
   * Removes a row, keeping at least one empty row.
   *
   * @param index - Row index to remove.
   */
  const removeRow = (index: number): void => {
    if (rows.length === 1) {
      onChange([{ key: '', value: '', enabled: true }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className={`${rowGrid} text-[11px] font-medium uppercase tracking-wide text-muted`}>
        <span />
        <span>Key</span>
        <span>Value</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div className={`${rowGrid} group`} key={index}>
          <input
            type="checkbox"
            className="app-no-drag"
            checked={row.enabled}
            onChange={(e) => updateRow(index, { enabled: e.target.checked })}
            title="Enable"
          />
          <input
            type="text"
            className={field}
            value={row.key}
            placeholder={placeholderKey}
            onChange={(e) => updateRow(index, { key: e.target.value })}
          />
          <div className="min-w-0 overflow-hidden rounded-md border border-separator bg-control shadow-[inset_0_0.5px_1px_rgba(0,0,0,0.06)]">
            <VariableInput
              className="app-no-drag"
              value={row.value}
              onChange={(value) => updateRow(index, { value })}
              variables={variables}
              placeholder={placeholderValue}
              onEditVariable={onEditVariable}
            />
          </div>
          <button
            type="button"
            className={iconButtonDanger}
            onClick={() => removeRow(index)}
            title="Remove"
          >
            <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`${toolbarButton} inline-flex items-center gap-1 self-start`}
        onClick={addRow}
      >
        <FaIcon icon={faPlus} className="h-3 w-3" />
        Add row
      </button>
    </div>
  );
}
