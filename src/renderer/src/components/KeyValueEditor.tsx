import type { KeyValue } from '#/shared/types'
import { field, iconButtonDanger, toolbarButton } from '#/renderer/src/ui/classes'

interface Props {
  /**
   * Editable key-value rows.
   */
  rows: KeyValue[]

  /**
   * Called when rows are added, updated, or removed.
   *
   * @param rows - Updated row list.
   */
  onChange: (rows: KeyValue[]) => void

  /**
   * Placeholder text for the key column.
   */
  placeholderKey?: string

  /**
   * Placeholder text for the value column.
   */
  placeholderValue?: string
}

const rowGrid = 'grid grid-cols-[24px_1fr_1fr_28px] items-center gap-1.5'

/**
 * Editable table of key-value rows with enable toggles for headers and params.
 */
export function KeyValueEditor({
  rows,
  onChange,
  placeholderKey = 'Key',
  placeholderValue = 'Value'
}: Props) {
  /**
   * Updates a single row by index.
   *
   * @param index - Row index to update.
   * @param patch - Partial fields to merge into the row.
   */
  const updateRow = (index: number, patch: Partial<KeyValue>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onChange(next)
  }

  /** Appends a blank row to the table. */
  const addRow = () => {
    onChange([...rows, { key: '', value: '', enabled: true }])
  }

  /**
   * Removes a row, keeping at least one empty row.
   *
   * @param index - Row index to remove.
   */
  const removeRow = (index: number) => {
    if (rows.length === 1) {
      onChange([{ key: '', value: '', enabled: true }])
      return
    }
    onChange(rows.filter((_, i) => i !== index))
  }

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
          <input
            type="text"
            className={field}
            value={row.value}
            placeholder={placeholderValue}
            onChange={(e) => updateRow(index, { value: e.target.value })}
          />
          <button
            type="button"
            className={iconButtonDanger}
            onClick={() => removeRow(index)}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className={`${toolbarButton} self-start`} onClick={addRow}>
        + Add row
      </button>
    </div>
  )
}
