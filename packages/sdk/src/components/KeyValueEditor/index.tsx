import { faXmark } from '@fortawesome/free-solid-svg-icons';
import type { JSX } from 'react';
import type { KeyValue, Variable } from '../../types.js';
import { AutocompleteInput } from '../Autocomplete/index.js';
import type { AutocompleteSource } from '../Autocomplete/types.js';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '../Table/index.js';
import { VariableInput } from '../VariableInput/index.js';
import { Checkbox, fieldFrame } from '../forms/index.js';

export interface Props {
  /**
   * Editable key-value rows.
   */
  rows: KeyValue[];

  /**
   * Called when rows are added, updated, or removed.
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
   * Opens settings to edit a hovered variable.
   *
   * @param key - Variable name from the hovered {{key}} token.
   */
  onEditVariable?: (key: string) => void;

  /**
   * Optional async source for key column autocomplete suggestions.
   */
  keySource?: AutocompleteSource;

  /**
   * Optional async source for value column autocomplete suggestions.
   */
  valueSource?: AutocompleteSource;
}

/**
 * Editable table of key-value rows with enable toggles for headers and params.
 */
export function KeyValueEditor({
  rows,
  onChange,
  placeholderKey = 'Key',
  placeholderValue = 'Value',
  variables,
  onEditVariable,
  keySource,
  valueSource
}: Props): JSX.Element {
  /**
   * Updates a single row by index.
   */
  const updateRow = (index: number, patch: Partial<KeyValue>): void => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    const isLast = index === rows.length - 1;
    if (isLast && next[index].key.trim() !== '') {
      next.push({ key: '', value: '', enabled: true });
    }
    onChange(next);
  };

  /**
   * Removes a row, keeping at least one empty row.
   */
  const removeRow = (index: number): void => {
    if (rows.length === 1) {
      onChange([{ key: '', value: '', enabled: true }]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  /**
   * Normalizes a key-value row so editors never receive undefined fields.
   */
  const normalizeRow = (row: KeyValue): KeyValue => ({
    key: row.key ?? '',
    value: row.value ?? '',
    enabled: row.enabled ?? true
  });

  return (
    <Table className="hc-key-value-editor">
      <TableHeader className="hc-key-value-editor-header">
        <tr>
          <TableHead className="w-6 p-0">
            <span className="sr-only">Enable</span>
          </TableHead>
          <TableHead>Key</TableHead>
          <TableHead>Value</TableHead>
          <TableHead className="w-7 p-0" />
        </tr>
      </TableHeader>
      <TableBody className="hc-key-value-editor-body">
        {rows.map((row, index) => {
          const normalizedRow = normalizeRow(row);
          return (
            <tr key={index}>
              <TableCell className="hc-key-value-editor-cell w-6 text-center">
                <Checkbox
                  className="app-no-drag"
                  checked={normalizedRow.enabled}
                  onChange={(e) => updateRow(index, { enabled: e.target.checked })}
                  aria-label={`Enable row ${index + 1}`}
                  title="Enable"
                />
              </TableCell>
              <TableCell className="hc-key-value-editor-cell">
                <AutocompleteInput
                  type="text"
                  className="w-full"
                  value={normalizedRow.key}
                  source={keySource}
                  placeholder={placeholderKey}
                  aria-label={`Key, row ${index + 1}`}
                  onChange={(key) => updateRow(index, { key })}
                />
              </TableCell>
              <TableCell className="hc-key-value-editor-cell">
                <VariableInput
                  wrapperClassName={`${fieldFrame} w-full`}
                  className="app-no-drag"
                  value={normalizedRow.value}
                  onChange={(value) => updateRow(index, { value })}
                  variables={variables}
                  source={valueSource}
                  placeholder={placeholderValue}
                  aria-label={`Value, row ${index + 1}`}
                  onEditVariable={onEditVariable}
                />
              </TableCell>
              <TableCell className="hc-key-value-editor-cell w-7 p-1 text-center">
                <Button
                  type="button"
                  variant="iconDanger"
                  onClick={() => removeRow(index)}
                  title="Remove"
                  aria-label={`Remove row ${index + 1}`}
                >
                  <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </tr>
          );
        })}
      </TableBody>
    </Table>
  );
}
