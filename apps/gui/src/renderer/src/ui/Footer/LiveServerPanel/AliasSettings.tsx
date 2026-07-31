import type { JSX } from 'react';
import { FormSection } from '@harborclient/sdk/components';
import type { LiveServerAlias } from '@harborclient/core/types';
import { AliasList } from './AliasList';

interface Props {
  /**
   * Path aliases from the editor draft.
   */
  aliases: LiveServerAlias[];

  /**
   * When true, disables the list (save/start in flight).
   */
  disabled: boolean;

  /**
   * Called with the full replacement alias list after any edit.
   *
   * @param next - Updated alias rows (may include incomplete draft rows).
   */
  onChange: (next: LiveServerAlias[]) => void;
}

/**
 * Aliases tab: URL path → filesystem target mappings mounted before the document root.
 *
 * @param props - Alias rows, disabled flag, and change handler.
 */
export function AliasSettings({ aliases, disabled, onChange }: Props): JSX.Element {
  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 border-0 p-0">
      <FormSection
        title="Path aliases"
        description={
          <>
            Map a URL path such as <code>/assets</code> to a folder like <code>build/assets</code>.
            Aliases are checked before the document root when resolving static files.
          </>
        }
      >
        <AliasList aliases={aliases} disabled={disabled} onChange={onChange} />
      </FormSection>
    </fieldset>
  );
}
