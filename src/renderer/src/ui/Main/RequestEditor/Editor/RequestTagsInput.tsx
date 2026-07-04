import { FaIcon, FormGroup } from '@harborclient/sdk/components';
import { useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { faXmark } from '#/renderer/src/fontawesome';
import { formatRequestTags, parseRequestTags } from '#/shared/requestTags';

/** Element id for the request tags field on the Notes tab. */
export const REQUEST_TAGS_INPUT_ID = 'request-tags-input';

/** Id for the helper text linked from the tags input via `aria-describedby`. */
const REQUEST_TAGS_DESCRIPTION_ID = 'request-tags-description';

interface Props {
  /**
   * Comma-separated tags stored on the request draft.
   */
  value: string;

  /**
   * Called when the user edits the tags field.
   *
   * @param tags - Updated comma-separated tags text.
   */
  onChange: (tags: string) => void;
}

/**
 * Chip-style tags input shown above request notes on the Notes tab.
 *
 * Committed tags render as removable badges; new tags are typed into the inline field
 * and committed with Enter, comma, or blur.
 */
export function RequestTagsInput({ value, onChange }: Props): JSX.Element {
  const tags = parseRequestTags(value);
  const [draft, setDraft] = useState('');
  const [previousValue, setPreviousValue] = useState(value);
  const draftRef = useRef(draft);
  const tagsRef = useRef(tags);
  const onChangeRef = useRef(onChange);

  /**
   * Keeps unmount cleanup refs aligned with the latest draft, tags, and callback.
   */
  useEffect(() => {
    draftRef.current = draft;
    tagsRef.current = tags;
    onChangeRef.current = onChange;
  }, [draft, onChange, tags]);

  /**
   * Clears in-progress draft text when the controlled value changes externally,
   * such as when the user switches to another request tab.
   */
  if (previousValue !== value) {
    setPreviousValue(value);
    setDraft('');
  }

  /**
   * Commits any in-progress draft tag when the Notes panel unmounts, such as when
   * the user switches to another request editor section before blurring the input.
   */
  useEffect(() => {
    return () => {
      const trimmed = draftRef.current.trim();
      if (trimmed === '') {
        return;
      }

      onChangeRef.current(formatRequestTags([...tagsRef.current, trimmed]));
    };
  }, []);

  /**
   * Commits the current draft text as a new tag when it contains non-whitespace.
   */
  const commitDraft = (): void => {
    const trimmed = draft.trim();
    draftRef.current = '';
    if (trimmed === '') {
      setDraft('');
      return;
    }

    onChange(formatRequestTags([...tags, trimmed]));
    setDraft('');
  };

  /**
   * Removes one committed tag by index and updates the stored comma-separated value.
   *
   * @param index - Zero-based index of the tag to remove.
   */
  const removeTag = (index: number): void => {
    onChange(formatRequestTags(tags.filter((_, tagIndex) => tagIndex !== index)));
  };

  /**
   * Removes the last committed tag when the draft input is empty.
   */
  const removeLastTag = (): void => {
    if (tags.length === 0) {
      return;
    }

    onChange(formatRequestTags(tags.slice(0, -1)));
  };

  /**
   * Commits draft text on Enter or comma, and deletes the last tag on Backspace
   * when the draft field is empty.
   *
   * @param event - Keyboard event from the inline tag input.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === 'Backspace' && draft === '') {
      event.preventDefault();
      removeLastTag();
    }
  };

  return (
    <FormGroup label="Tags" htmlFor={REQUEST_TAGS_INPUT_ID} className="mb-2 shrink-0">
      <p id={REQUEST_TAGS_DESCRIPTION_ID} className="text-sm text-[16px] text-muted">
        Tags are used to categorize requests and make them easier to find.
      </p>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-separator bg-field px-2 py-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-accent">
        {tags.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap items-center gap-1.5 p-0" role="list">
            {tags.map((tag, index) => (
              <li key={`${tag}-${index}`} className="inline-flex">
                <span className="inline-flex items-center gap-1 rounded bg-selection px-1.5 py-0.5 text-[14px] text-text">
                  <span>{tag}</span>
                  <button
                    type="button"
                    className="rounded-sm text-muted hover:text-text focus-visible:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => removeTag(index)}
                  >
                    <FaIcon icon={faXmark} className="h-3 w-3" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          id={REQUEST_TAGS_INPUT_ID}
          type="text"
          value={draft}
          placeholder={tags.length === 0 ? 'Add tag…' : undefined}
          aria-describedby={REQUEST_TAGS_DESCRIPTION_ID}
          className="min-w-[6ch] flex-1 border-0 bg-transparent px-0 py-0.5 text-[14px] text-text outline-none placeholder:text-muted focus-visible:shadow-none focus-visible:outline-none"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
        />
      </div>
    </FormGroup>
  );
}
