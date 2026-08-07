import type { JSX } from 'react';
import type { Variable } from '@harborclient/core/types';
import type { RequestDraft } from '#/renderer/src/store/tabs';
import { CommentEditor } from '#/renderer/src/ui/Main/RequestEditor/Editor/CommentEditor';
import { RequestTagsInput } from '#/renderer/src/ui/Main/RequestEditor/Editor/RequestTagsInput';

interface Props {
  /**
   * Current request draft whose `comment` field backs legacy notes.
   */
  draft: RequestDraft;

  /**
   * Merges a partial update into the current draft.
   */
  update: (patch: Partial<RequestDraft>) => void;

  /**
   * Collection-scoped variables for comment highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: (key: string) => void;

  /**
   * Optional markdown reference metadata for copy-to-chat actions.
   */
  markdownReference?: {
    uuid: string;
    label: string;
  };
}

/**
 * Legacy single-field notes UI backed by `request.comment` and request tags.
 */
export function LegacyNotesPanel({
  draft,
  update,
  variables,
  onEditVariables,
  markdownReference
}: Props): JSX.Element {
  return (
    <>
      <RequestTagsInput value={draft.tags} onChange={(tags) => update({ tags })} />
      <CommentEditor
        value={draft.comment}
        onChange={(comment) => update({ comment })}
        variables={variables}
        onEditVariables={onEditVariables}
        markdownReference={markdownReference}
      />
    </>
  );
}
