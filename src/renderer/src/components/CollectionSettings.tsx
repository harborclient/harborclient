import { useEffect, useState } from 'react'
import type { Collection, Variable } from '#/shared/types'
import {
  field,
  iconButtonDanger,
  primaryButton,
  secondaryButton,
  toolbarButton
} from '#/renderer/src/ui/classes'

interface Props {
  /**
   * Collection being configured.
   */
  collection: Collection

  /**
   * Persists collection name and variables.
   *
   * @param id - Collection ID to update.
   * @param name - New display name.
   * @param variables - Collection-scoped variables.
   */
  onSave: (id: number, name: string, variables: Variable[]) => Promise<void>

  /**
   * Closes the settings view without saving.
   */
  onClose: () => void
}

const rowGrid = 'grid grid-cols-[1fr_1fr_28px] items-center gap-1.5'

const emptyVariable = (): Variable => ({ key: '', value: '' })

/**
 * Full-area collection settings: rename and manage collection-scoped variables.
 */
export function CollectionSettings({ collection, onSave, onClose }: Props) {
  const [name, setName] = useState(collection.name)
  const [variables, setVariables] = useState<Variable[]>(
    collection.variables.length ? collection.variables : [emptyVariable()]
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(collection.name)
    setVariables(collection.variables.length ? collection.variables : [emptyVariable()])
  }, [collection])

  /**
   * Updates a single variable row by index.
   *
   * @param index - Row index to update.
   * @param patch - Partial fields to merge into the row.
   */
  const updateVariable = (index: number, patch: Partial<Variable>) => {
    setVariables((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    )
  }

  /** Appends a blank variable row. */
  const addVariable = () => {
    setVariables((prev) => [...prev, emptyVariable()])
  }

  /**
   * Removes a variable row, keeping at least one empty row.
   *
   * @param index - Row index to remove.
   */
  const removeVariable = (index: number) => {
    setVariables((prev) => {
      if (prev.length === 1) return [emptyVariable()]
      return prev.filter((_, i) => i !== index)
    })
  }

  /** Persists name and non-empty variable rows. */
  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    const cleanedVariables = variables.filter((v) => v.key.trim() || v.value.trim())
    setSaving(true)
    try {
      await onSave(collection.id, trimmedName, cleanedVariables)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="m-0 text-[15px] font-semibold text-text">Collection Settings</h1>
          <button className={secondaryButton} onClick={onClose}>
            Close
          </button>
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-[13px] text-muted">Name</label>
          <input
            className={`${field} w-full`}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave()
              if (e.key === 'Escape') onClose()
            }}
          />
        </div>

        <div className="mb-6">
          <h2 className="m-0 mb-1 text-[13px] font-medium text-text">Variables</h2>
          <p className="mb-3 text-[12px] text-muted">
            Use variables in request URLs with {'{{variable}}'} syntax.
          </p>

          <div className="flex flex-col gap-1.5">
            <div className={`${rowGrid} text-[11px] font-medium uppercase tracking-wide text-muted`}>
              <span>Key</span>
              <span>Value</span>
              <span />
            </div>
            {variables.map((variable, index) => (
              <div className={`${rowGrid} group`} key={index}>
                <input
                  type="text"
                  className={field}
                  value={variable.key}
                  placeholder="variable"
                  onChange={(e) => updateVariable(index, { key: e.target.value })}
                />
                <input
                  type="text"
                  className={field}
                  value={variable.value}
                  placeholder="value"
                  onChange={(e) => updateVariable(index, { value: e.target.value })}
                />
                <button
                  type="button"
                  className={iconButtonDanger}
                  onClick={() => removeVariable(index)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
            <button type="button" className={`${toolbarButton} self-start`} onClick={addVariable}>
              + Add variable
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button className={secondaryButton} onClick={onClose}>
            Cancel
          </button>
          <button
            className={primaryButton}
            onClick={() => void handleSave()}
            disabled={!name.trim() || saving}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
