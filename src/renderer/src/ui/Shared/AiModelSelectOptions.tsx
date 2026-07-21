import type { JSX } from 'react';
import { groupAvailableModels, type AiModelOption } from '#/shared/ai/models';

interface Props {
  /**
   * Flat model list from {@link getAvailableModels}.
   */
  models: AiModelOption[];
}

/**
 * Renders grouped `<optgroup>` sections for an AI model `<Select>`.
 */
export function AiModelSelectOptions({ models }: Props): JSX.Element {
  const groups = groupAvailableModels(models);

  return (
    <>
      {groups.map((group) => (
        <optgroup key={group.key} label={group.label}>
          {group.models.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
