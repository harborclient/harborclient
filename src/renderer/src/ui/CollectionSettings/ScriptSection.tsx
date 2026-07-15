import type { JSX } from 'react';
import type { ScriptRef, Variable } from '#/shared/types';
import { FormSection } from '@harborclient/sdk/components';
import { ScriptListEditor } from '#/renderer/src/ui/Shared/Script/ScriptListEditor';
import { useAppSelector } from '#/renderer/src/store/hooks';
import { selectSnippets } from '#/renderer/src/store/selectors';

interface Props {
  /**
   * Script phase rendered by this section.
   */
  phase: 'pre' | 'post';

  /**
   * Helper text shown above the script list.
   */
  description: string;

  /**
   * Placeholder for new inline scripts.
   */
  placeholder: string;

  /**
   * Ordered script references for this phase.
   */
  scripts: ScriptRef[];

  /**
   * Called when the script list changes.
   */
  onChange: (scripts: ScriptRef[]) => void;

  /**
   * Collection-scoped variables for editor highlighting.
   */
  variables: Variable[];
}

/**
 * Collection pre/post script list editor for the PreRequest and PostRequest tabs.
 */
export function ScriptSection({
  phase,
  description,
  placeholder,
  scripts,
  onChange,
  variables
}: Props): JSX.Element {
  const snippets = useAppSelector(selectSnippets);

  const label = phase === 'pre' ? 'Pre-request stage' : 'Post-request stage';

  return (
    <FormSection title={label} description={description} fill>
      <ScriptListEditor
        phase={phase}
        scripts={scripts}
        onChange={onChange}
        variables={variables}
        snippets={snippets}
        placeholder={placeholder}
      />
    </FormSection>
  );
}
