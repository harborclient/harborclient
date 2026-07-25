import {
  getAiModelOptionGroupLabel,
  groupAvailableModels,
  type AiModelOption
} from '@harborclient/core/ai/models';

/**
 * Reports whether source/section headings should be shown in the model picker.
 *
 * When every available model comes from a single place (only personal API keys,
 * only GitHub Models, or a single Team Hub), `groupAvailableModels` collapses the
 * list into one group and the heading is redundant, so it is hidden. Headings are
 * only meaningful when there is more than one source to disambiguate between.
 *
 * @param models - Models available for selection.
 * @returns True when two or more sources are present.
 */
export function shouldShowAiModelSourceLabels(models: AiModelOption[]): boolean {
  return groupAvailableModels(models).length > 1;
}

/**
 * Builds the accessible name for the model picker trigger and listbox.
 *
 * Mirrors {@link shouldShowAiModelSourceLabels}: the source is appended only when
 * multiple sources exist, so single-source setups do not announce a redundant
 * "Personal" or Team Hub name.
 *
 * @param models - Models available for selection.
 * @param selected - Currently selected model option, if any.
 * @returns The aria-label describing the current selection.
 */
export function getAiModelSelectAriaLabel(
  models: AiModelOption[],
  selected: AiModelOption | null | undefined
): string {
  if (selected == null) {
    return 'AI model';
  }

  if (!shouldShowAiModelSourceLabels(models)) {
    return `AI model, ${selected.label}`;
  }

  return `AI model, ${selected.label}, ${getAiModelOptionGroupLabel(selected)}`;
}
