import { Button, FormGroup, Modal, ModalFormLayout, Radio } from '@harborclient/sdk/components';
import { useId, useState, type JSX } from 'react';
import type { ScriptStage } from '@harborclient/sdk';
import { DEFAULT_SCRIPT_STAGE, SCRIPT_STAGE_OPTIONS } from '@harborclient/core/scriptStage';

interface Props {
  /**
   * Closes the modal without adding a script.
   */
  onCancel: () => void;

  /**
   * Creates a blank inline script with the selected stage.
   *
   * @param stage - Selected script stage.
   */
  onConfirm: (stage: ScriptStage) => void;
}

/**
 * Modal for choosing the stage before adding a blank inline script.
 */
export function AddScriptStageModal({ onCancel, onConfirm }: Props): JSX.Element {
  const [stage, setStage] = useState<ScriptStage>(DEFAULT_SCRIPT_STAGE);
  const radioGroupName = useId();

  return (
    <Modal
      labelledBy="add-script-stage-title"
      onClose={onCancel}
      title="Add script"
      className="w-120"
    >
      <ModalFormLayout
        actions={
          <Button type="button" onClick={() => onConfirm(stage)}>
            Add script
          </Button>
        }
      >
        <fieldset className="m-0 flex flex-col gap-2 border-none p-0">
          <legend className="mb-1 font-medium text-text">Stage</legend>
          {SCRIPT_STAGE_OPTIONS.map((option) => (
            <FormGroup
              key={option.value}
              label={option.label}
              description={option.description}
              layout="checkbox"
              bordered={false}
            >
              <Radio
                name={radioGroupName}
                checked={stage === option.value}
                onChange={() => setStage(option.value)}
              />
            </FormGroup>
          ))}
        </fieldset>
      </ModalFormLayout>
    </Modal>
  );
}
