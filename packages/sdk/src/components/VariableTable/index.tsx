import { faPlus, faXmark } from '@fortawesome/free-solid-svg-icons';
import { type ComponentPropsWithoutRef, type JSX, useEffect, useRef } from 'react';
import type { Variable } from '../../types.js';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '../Table/index.js';
import { Checkbox, Input } from '../forms/index.js';
import { cn } from '../utils.js';

/**
 * Returns a blank variable row for new table entries.
 */
const emptyVariable = (): Variable => ({ key: '', value: '', defaultValue: '', share: false });

interface Props extends Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'onChange'> {
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

  /**
   * When set, scrolls to and focuses the Value input for the matching variable key.
   */
  focusKey?: string;
}

/**
 * Editable table for key/value/default/share variable rows.
 */
export function VariableTable({
  variables,
  onChange,
  description,
  focusKey,
  className,
  ...props
}: Props): JSX.Element {
  const valueInputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const lastFocusedKeyRef = useRef<string | undefined>(undefined);

  /**
   * Updates a single variable row by index.
   */
  const updateVariable = (index: number, patch: Partial<Variable>): void => {
    onChange(variables.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  /**
   * Appends a blank variable row.
   */
  const addVariable = (): void => {
    onChange([...variables, emptyVariable()]);
  };

  /**
   * Removes a variable row, keeping at least one empty row.
   */
  const removeVariable = (index: number): void => {
    if (variables.length === 1) {
      onChange([emptyVariable()]);
      return;
    }
    onChange(variables.filter((_, i) => i !== index));
  };

  /**
   * Scrolls to and focuses the Value input for the row matching `focusKey`.
   * Runs once per distinct `focusKey` so subsequent edits do not steal focus.
   */
  useEffect(() => {
    const trimmedFocusKey = focusKey?.trim();
    if (!trimmedFocusKey || trimmedFocusKey === lastFocusedKeyRef.current) {
      return;
    }

    const rowIndex = variables.findIndex((variable) => variable.key.trim() === trimmedFocusKey);
    if (rowIndex < 0) {
      return;
    }

    lastFocusedKeyRef.current = trimmedFocusKey;

    /**
     * Waits two animation frames so the table row can mount after tab navigation.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const input = valueInputRefs.current.get(rowIndex);
        if (
          input == null ||
          typeof input.focus !== 'function' ||
          typeof input.select !== 'function'
        ) {
          return;
        }

        input.scrollIntoView({ block: 'nearest' });
        input.focus();
        input.select();
      });
    });
  }, [focusKey, variables]);

  return (
    <div {...props} className={cn('hc-variable-table', className)}>
      {description && (
        <p className="hc-variable-table-description mb-3 text-[14px] text-muted">{description}</p>
      )}

      <div className="hc-variable-table-content flex flex-col gap-1.5">
        <Table>
          <TableHeader>
            <tr>
              <TableHead>Key</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Default</TableHead>
              <TableHead className="w-14 text-center">Share</TableHead>
              <TableHead className="w-7 p-0 text-center" />
            </tr>
          </TableHeader>
          <TableBody>
            {variables.map((variable, index) => (
              <tr key={index}>
                <TableCell>
                  <Input
                    type="text"
                    className="w-full"
                    value={variable.key}
                    placeholder="variable"
                    aria-label={`Key, row ${index + 1}`}
                    onChange={(e) => updateVariable(index, { key: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    ref={(element) => {
                      if (element) valueInputRefs.current.set(index, element);
                      else valueInputRefs.current.delete(index);
                    }}
                    type="text"
                    className="w-full"
                    value={variable.value}
                    placeholder="value"
                    aria-label={`Value, row ${index + 1}`}
                    onChange={(e) => updateVariable(index, { value: e.target.value })}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="text"
                    className="w-full"
                    value={variable.defaultValue}
                    placeholder="default"
                    aria-label={`Default, row ${index + 1}`}
                    onChange={(e) => updateVariable(index, { defaultValue: e.target.value })}
                  />
                </TableCell>
                <TableCell className="w-14 text-center">
                  <Checkbox
                    checked={variable.share}
                    onChange={(e) => updateVariable(index, { share: e.target.checked })}
                    aria-label={`Include value in export, row ${index + 1}`}
                    title="Include value in export"
                  />
                </TableCell>
                <TableCell className="w-7 text-center">
                  <Button
                    type="button"
                    variant="iconDanger"
                    onClick={() => removeVariable(index)}
                    title="Remove"
                    aria-label={`Remove row ${index + 1}`}
                  >
                    <FaIcon icon={faXmark} className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
        <Button
          type="button"
          variant="toolbar"
          className="hc-variable-table-add inline-flex items-center gap-1 self-start"
          onClick={addVariable}
        >
          <FaIcon icon={faPlus} className="h-3 w-3" />
          Add variable
        </Button>
      </div>
    </div>
  );
}
