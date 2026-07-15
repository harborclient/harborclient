import {
  Button,
  FieldError,
  Input,
  Modal,
  ModalFormLayout,
  Select
} from '@harborclient/sdk/components';
import { useEffect, useRef, useState, type JSX } from 'react';
import type { ScriptStage } from '@harborclient/sdk';
import { SNIPPET_SCOPE_OPTIONS, type SnippetScope } from '#/shared/snippetScope';
import { SCRIPT_STAGE_OPTIONS } from '#/shared/scriptStage';

interface Props {
  /**
   * Default snippet name shown in the input.
   */
  defaultName: string;

  /**
   * Default script phase scope for the saved snippet.
   */
  defaultScope: SnippetScope;

  /**
   * Default stage for the saved snippet.
   */
  defaultStage: ScriptStage;

  /**
   * True while the save request is in flight.
   */
  saving: boolean;

  /**
   * Inline validation or IPC error message.
   */
  error: string | null;

  /**
   * Closes the modal without saving.
   */
  onCancel: () => void;

  /**
   * Persists the snippet under the entered name and scope.
   *
   * @param name - Trimmed snippet name from the modal input.
   * @param scope - Selected script phase scope.
   * @param stage - Selected script stage.
   */
  onSave: (name: string, scope: SnippetScope, stage: ScriptStage) => void;
}

/**
 * Name-only modal for saving script source to the snippet library.
 */
export function SaveSnippetNameModal({
  defaultName,
  defaultScope,
  defaultStage,
  saving,
  error,
  onCancel,
  onSave
}: Props): JSX.Element {
  const [name, setName] = useState(defaultName);
  const [scope, setScope] = useState<SnippetScope>(defaultScope);
  const [stage, setStage] = useState<ScriptStage>(defaultStage);
  const nameInputRef = useRef<HTMLInputElement>(null);

  /**
   * Focuses and selects the name input when the modal opens.
   */
  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  return (
    <Modal
      labelledBy="save-snippet-title"
      onClose={onCancel}
      title="Save snippet"
      description="Save this script to the reusable snippet library."
      closeDisabled={saving}
      disableEscape={saving}
    >
      <ModalFormLayout
        error={error ? <FieldError spacing="modal">{error}</FieldError> : undefined}
        actions={
          <Button type="button" disabled={saving} onClick={() => onSave(name, scope, stage)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="save-snippet-name">
              Name
            </label>
            <Input
              ref={nameInputRef}
              id="save-snippet-name"
              value={name}
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onSave(name, scope, stage);
                }
              }}
              placeholder="Snippet name"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="save-snippet-scope">
              Request stage
            </label>
            <Select
              id="save-snippet-scope"
              className="w-full"
              value={scope}
              disabled={saving}
              onChange={(event) => setScope(event.target.value as SnippetScope)}
            >
              {SNIPPET_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-medium text-text" htmlFor="save-snippet-stage">
              Stage
            </label>
            <Select
              id="save-snippet-stage"
              className="w-full"
              value={stage}
              disabled={saving}
              onChange={(event) => setStage(event.target.value as ScriptStage)}
            >
              {SCRIPT_STAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </ModalFormLayout>
    </Modal>
  );
}
