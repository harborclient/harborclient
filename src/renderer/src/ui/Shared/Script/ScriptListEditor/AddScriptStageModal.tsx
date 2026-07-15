import { Button, Modal, ModalFormLayout, Select } from '@harborclient/sdk/components';
import { useId, useState, type JSX } from 'react';
import type { ScriptStage } from '@harborclient/sdk';
import { DEFAULT_SCRIPT_STAGE, SCRIPT_STAGE_OPTIONS } from '#/shared/scriptStage';

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
  const stageSelectId = useId();

  return (
    <Modal
      labelledBy="add-script-stage-title"
      onClose={onCancel}
      title="Add script"
      description="Choose the script stage for this row within the current request stage."
    >
      <ModalFormLayout
        actions={
          <Button type="button" onClick={() => onConfirm(stage)}>
            Add script
          </Button>
        }
      >
        <div className="flex flex-col gap-1">
          <label className="text-[14px] font-medium text-text" htmlFor={stageSelectId}>
            Stage
          </label>
          <Select
            id={stageSelectId}
            className="w-full"
            value={stage}
            onChange={(event) => setStage(event.target.value as ScriptStage)}
          >
            {SCRIPT_STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </ModalFormLayout>
    </Modal>
  );
}
