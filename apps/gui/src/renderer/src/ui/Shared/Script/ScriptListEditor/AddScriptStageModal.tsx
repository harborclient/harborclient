import { Button, FormGroup, Modal, ModalFormLayout, Radio } from '@harborclient/sdk/components';
import { useId, useMemo, useState, type JSX } from 'react';
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

  /**
   * Stages the user may choose. Defaults to the full script-stage set.
   */
  stages?: ScriptStage[];
}

/**
 * Modal for choosing the stage before adding a blank inline script.
 */
export function AddScriptStageModal({ onCancel, onConfirm, stages }: Props): JSX.Element {
  /**
   * Filters the full stage option list down to the stages this modal may offer.
   */
  const stageOptions = useMemo(() => {
    if (!stages || stages.length === 0) {
      return SCRIPT_STAGE_OPTIONS;
    }
    const allowed = new Set(stages);
    return SCRIPT_STAGE_OPTIONS.filter((option) => allowed.has(option.value));
  }, [stages]);

  const initialStage = stageOptions[0]?.value ?? DEFAULT_SCRIPT_STAGE;
  const [stage, setStage] = useState<ScriptStage>(initialStage);
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
          {stageOptions.map((option) => (
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
