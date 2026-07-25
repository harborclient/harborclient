import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { useMemo } from '@harborclient/sdk/react';
import type { JSX } from 'react';
import type { FormDataPart, FormDataPartType, Variable } from '../../types.js';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { Table, TableBody, TableCell, TableHead, TableHeader } from '../Table/index.js';
import { VariableInput } from '../VariableInput/index.js';
import { Checkbox, Input, Select, fieldFrame } from '../forms/index.js';
import { emptyFormPart, fileBasename, withTrailingRow } from './utils.js';

export interface Props {
  /**
   * Editable multipart form rows.
   */
  parts: FormDataPart[];

  /**
   * Called when rows are added, updated, or removed.
   */
  onChange: (parts: FormDataPart[]) => void;

  /**
   * Collection-scoped variables for value highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens the host file picker and returns selected absolute paths.
   */
  onSelectFiles: () => Promise<string[]>;

  /**
   * Opens settings to edit a hovered variable.
   *
   * @param key - Variable name from the hovered {{key}} token.
   */
  onEditVariable?: (key: string) => void;
}

/**
 * Editable table of multipart form parts with text and file field types.
 */
export function FormDataEditor({
  parts,
  onChange,
  variables,
  onSelectFiles,
  onEditVariable
}: Props): JSX.Element {
  /**
   * Ensures at least one row exists for rendering, including a trailing blank row.
   */
  const rows = useMemo(() => withTrailingRow(parts), [parts]);

  /**
   * Updates a single row by index, auto-appending a blank row when the last key is filled.
   */
  const updateRow = (index: number, patch: Partial<FormDataPart>): void => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    const isLast = index === rows.length - 1;
    if (isLast && next[index].key.trim() !== '') {
      next.push(emptyFormPart());
    }
    onChange(next);
  };

  /**
   * Removes a row, keeping at least one empty row.
   */
  const removeRow = (index: number): void => {
    if (rows.length === 1) {
      onChange([emptyFormPart()]);
      return;
    }
    onChange(rows.filter((_, i) => i !== index));
  };

  /**
   * Opens the host file picker and merges selected paths into a file row.
   */
  const chooseFiles = async (index: number): Promise<void> => {
    const selected = await onSelectFiles();
    if (selected.length === 0) {
      return;
    }

    const currentFiles = rows[index]?.files ?? [];
    const merged = [...currentFiles];
    for (const filePath of selected) {
      if (!merged.includes(filePath)) {
        merged.push(filePath);
      }
    }
    updateRow(index, { type: 'file', files: merged, value: '' });
  };

  /**
   * Removes one file path from a file row.
   */
  const removeFile = (index: number, filePath: string): void => {
    const currentFiles = rows[index]?.files ?? [];
    updateRow(index, { files: currentFiles.filter((file) => file !== filePath) });
  };

  return (
    <Table className="hc-form-data-editor">
      <TableHeader className="hc-form-data-editor-header">
        <tr>
          <TableHead className="w-6 p-0">
            <span className="sr-only">Enable</span>
          </TableHead>
          <TableHead>Key</TableHead>
          <TableHead className="w-24">Type</TableHead>
          <TableHead>Value</TableHead>
          <TableHead className="w-7 p-0" />
        </tr>
      </TableHeader>
      <TableBody className="hc-form-data-editor-body">
        {rows.map((row, index) => (
          <tr key={index}>
            <TableCell className="hc-form-data-editor-cell w-6 p-1 text-center">
              <Checkbox
                className="app-no-drag"
                checked={row.enabled}
                onChange={(e) => updateRow(index, { enabled: e.target.checked })}
                aria-label={`Enable row ${index + 1}`}
                title="Enable"
              />
            </TableCell>
            <TableCell className="hc-form-data-editor-cell">
              <Input
                type="text"
                className="w-full"
                value={row.key}
                placeholder="field"
                aria-label={`Key, row ${index + 1}`}
                onChange={(e) => updateRow(index, { key: e.target.value })}
              />
            </TableCell>
            <TableCell className="hc-form-data-editor-cell">
              <Select
                className="w-full"
                value={row.type}
                aria-label={`Type, row ${index + 1}`}
                onChange={(e) => {
                  const type = e.target.value as FormDataPartType;
                  updateRow(index, {
                    type,
                    value: type === 'text' ? row.value : '',
                    files: type === 'file' ? row.files : []
                  });
                }}
              >
                <option value="text">Text</option>
                <option value="file">File</option>
              </Select>
            </TableCell>
            <TableCell className="hc-form-data-editor-cell">
              {row.type === 'text' ? (
                <VariableInput
                  wrapperClassName={`${fieldFrame} w-full`}
                  className="app-no-drag"
                  value={row.value}
                  onChange={(value) => updateRow(index, { value })}
                  variables={variables}
                  placeholder="value"
                  aria-label={`Value, row ${index + 1}`}
                  onEditVariable={onEditVariable}
                />
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0 px-2 py-0.5 text-[14px]"
                    onClick={() => void chooseFiles(index)}
                  >
                    Choose files
                  </Button>
                  {row.files.map((filePath) => (
                    <span
                      key={filePath}
                      className="inline-flex max-w-full items-center gap-1 rounded-md border border-separator bg-control px-1.5 py-0.5 text-[14px] text-text"
                      title={filePath}
                      aria-label={filePath}
                    >
                      <span className="truncate">{fileBasename(filePath)}</span>
                      <button
                        type="button"
                        className="app-no-drag inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-selection hover:text-text"
                        onClick={() => removeFile(index, filePath)}
                        title={`Remove file ${fileBasename(filePath)}`}
                        aria-label={`Remove file ${fileBasename(filePath)}`}
                      >
                        <FaIcon icon={faXmark} className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </TableCell>
            <TableCell className="hc-form-data-editor-cell w-7 p-1 text-center">
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
        ))}
      </TableBody>
    </Table>
  );
}
