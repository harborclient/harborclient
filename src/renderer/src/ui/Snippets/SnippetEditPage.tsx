import { Button, FieldError, Page } from '@harborclient/sdk/components';
import { useEffect, useMemo, useState, type JSX } from 'react';
import toast from 'react-hot-toast';
import type { PageRef } from '#/renderer/src/store/drafts';
import { useAppDispatch, useAppSelector } from '#/renderer/src/store/hooks';
import { closeTab } from '#/renderer/src/store/slices/tabsSlice';
import { selectSnippets } from '#/renderer/src/store/selectors';
import { createSnippet, updateSnippet } from '#/renderer/src/store/thunks/snippets';
import { faCode } from '#/renderer/src/fontawesome';
import { SnippetEditFields } from '#/renderer/src/ui/shared/Snippet/SnippetEditFields';
import {
  createBlankSnippet,
  createImportedSnippetDraft,
  type SnippetEditDraft
} from '#/renderer/src/ui/shared/Snippet/snippetEditDraft';

interface Props {
  /**
   * Snippet create/edit tab identity.
   */
  page: Extract<PageRef, { type: 'snippet-edit' }>;

  /**
   * Tab id hosting this page.
   */
  tabId: string;
}

/**
 * Builds the initial draft for a snippet edit tab from its page reference.
 *
 * @param page - Snippet edit tab identity.
 * @param snippets - Current snippet rows from the store.
 * @returns Draft seeded for the requested mode, or null when the source snippet is missing.
 */
function buildInitialDraft(
  page: Extract<PageRef, { type: 'snippet-edit' }>,
  snippets: ReturnType<typeof selectSnippets>
): SnippetEditDraft | null {
  if (page.mode === 'new') {
    return createBlankSnippet();
  }

  if (page.mode === 'import') {
    return createImportedSnippetDraft(page.seedCode ?? '');
  }

  if (page.snippetId == null) {
    return null;
  }

  const snippet = snippets.find((entry) => entry.id === page.snippetId);
  if (!snippet) {
    return null;
  }

  if (page.mode === 'clone') {
    return {
      name: `${snippet.name} (clone)`,
      code: snippet.code,
      scope: snippet.scope,
      stage: snippet.stage,
      connectionId: snippet.connectionId
    };
  }

  return {
    id: snippet.id,
    name: snippet.name,
    code: snippet.code,
    scope: snippet.scope,
    stage: snippet.stage,
    connectionId: snippet.connectionId
  };
}

/**
 * Renders snippet create, edit, clone, or import flows inside a page tab.
 */
export function SnippetEditPage({ page, tabId }: Props): JSX.Element {
  const dispatch = useAppDispatch();
  const snippets = useAppSelector(selectSnippets);
  const computedDraft = useMemo(() => buildInitialDraft(page, snippets), [page, snippets]);
  const [editedDraft, setEditedDraft] = useState<SnippetEditDraft | null>(null);
  const draft = editedDraft ?? computedDraft;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Closes the tab when an edit/clone tab cannot resolve its source snippet.
   */
  useEffect(() => {
    if (page.mode === 'new' || page.mode === 'import') {
      return;
    }
    if (page.snippetId == null) {
      dispatch(closeTab(tabId));
      return;
    }
    if (!snippets.some((entry) => entry.id === page.snippetId)) {
      dispatch(closeTab(tabId));
    }
  }, [page.mode, page.snippetId, snippets, dispatch, tabId]);

  const isNew = page.mode === 'new' || page.mode === 'clone' || page.mode === 'import';
  const readOnly = page.readOnly === true;
  const snippetUuid =
    page.mode === 'edit' && page.snippetId != null
      ? snippets.find((entry) => entry.id === page.snippetId)?.uuid
      : undefined;
  const description = readOnly
    ? 'Read-only preview of a marketplace snippet. Clone it to make an editable copy.'
    : 'Reusable JavaScript used in the pre-request and post-request stages.';

  /**
   * Persists the snippet draft through create or update IPC.
   */
  const handleSave = async (): Promise<void> => {
    if (!draft || readOnly) {
      return;
    }

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      setError('Snippet name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isNew || draft.id == null) {
        await dispatch(
          createSnippet({
            name: trimmedName,
            code: draft.code,
            scope: draft.scope,
            stage: draft.stage,
            connectionId: draft.connectionId
          })
        ).unwrap();
        toast.success('Snippet created');
      } else {
        await dispatch(
          updateSnippet({
            id: draft.id,
            name: trimmedName,
            code: draft.code,
            scope: draft.scope,
            stage: draft.stage,
            connectionId: draft.connectionId
          })
        ).unwrap();
        toast.success('Snippet saved');
      }
      dispatch(closeTab(tabId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save snippet');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page
      embedded
      title={page.label}
      description={description}
      icon={faCode}
      className="flex min-h-0 flex-1 flex-col overflow-hidden p-6 pt-0!"
      actions={
        readOnly ? (
          <Button type="button" onClick={() => dispatch(closeTab(tabId))}>
            Close
          </Button>
        ) : (
          <Button
            type="button"
            disabled={saving || draft == null}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )
      }
    >
      {error ? (
        <div className="pt-4">
          <FieldError spacing="modal">{error}</FieldError>
        </div>
      ) : null}
      {draft ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SnippetEditFields
            draft={draft}
            isNew={isNew}
            saving={saving}
            readOnly={readOnly}
            fillHeight
            snippetUuid={snippetUuid}
            onChange={setEditedDraft}
          />
        </div>
      ) : (
        <p className="m-0 text-muted" role="status">
          Loading snippet…
        </p>
      )}
    </Page>
  );
}
