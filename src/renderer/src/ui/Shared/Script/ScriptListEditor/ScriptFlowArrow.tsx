import { FaIcon } from '@harborclient/sdk/components';
import type { JSX } from 'react';
import { faCaretDown } from '#/renderer/src/fontawesome';

/**
 * Decorative caret between script rows indicating top-to-bottom execution order.
 */
export function ScriptFlowArrow(): JSX.Element {
  return (
    <li className="flex list-none justify-center py-1" aria-hidden="true">
      <FaIcon icon={faCaretDown} className="h-4 w-4 text-muted" aria-hidden />
    </li>
  );
}
