import { FormGroup, Input } from '@harborclient/sdk/components';
import type { JSX } from 'react';

/** Element id for the request tags field on the Notes tab. */
export const REQUEST_TAGS_INPUT_ID = 'request-tags-input';

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
 * Comma-separated tags input shown above request notes on the Notes tab.
 */
export function RequestTagsInput({ value, onChange }: Props): JSX.Element {
  return (
    <FormGroup label="Tags" htmlFor={REQUEST_TAGS_INPUT_ID} className="shrink-0 mb-2">
      <p className="text-sm text-muted text-[16px]">
        Tags are used to categorize requests and make them easier to find.
      </p>
      <Input
        id={REQUEST_TAGS_INPUT_ID}
        type="text"
        placeholder="api, auth, staging"
        value={value}
        className="w-full"
        onChange={(event) => onChange(event.target.value)}
      />
    </FormGroup>
  );
}
