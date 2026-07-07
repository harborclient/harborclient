/**
 * Minimal draft fields needed to decide whether a rename save prompt is required.
 */
export interface RenamedThemeSaveDraft {
  /** Existing filename stem when editing a saved theme. */
  id?: string;

  /** Human-readable theme title in the Creator form. */
  title: string;
}

/**
 * Returns whether saving should ask the user to rename in place or save as a new theme.
 *
 * @param persisted - Last loaded or saved draft snapshot.
 * @param draft - Current Creator draft about to be saved.
 * @returns True when editing an existing theme whose title changed.
 */
export function shouldPromptRenamedThemeSave(
  persisted: RenamedThemeSaveDraft,
  draft: RenamedThemeSaveDraft
): boolean {
  if (!persisted.id) {
    return false;
  }
  return persisted.title.trim() !== draft.title.trim();
}
