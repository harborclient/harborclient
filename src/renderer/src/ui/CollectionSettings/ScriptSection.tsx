import type { JSX } from 'react';
import type { ScriptRef, Variable } from '#/shared/types';
import { ScriptListEditor } from '#/renderer/src/ui/shared/ScriptListEditor';
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

  return (
    <div className="mb-6 flex min-h-0 flex-1 flex-col">
      <p className="mb-3 shrink-0 text-[14px] text-muted">{description}</p>
      <ScriptListEditor
        phase={phase}
        scripts={scripts}
        onChange={onChange}
        variables={variables}
        snippets={snippets}
        placeholder={placeholder}
      />
    </div>
  );
}
