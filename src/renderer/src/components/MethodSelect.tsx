import type { JSX } from 'react';
import type { HttpMethod } from '#/shared/types';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

interface Props {
  /**
   * Currently selected HTTP method.
   */
  value: HttpMethod;

  /**
   * Called when the user picks a different method.
   *
   * @param method - Newly selected HTTP method.
   */
  onChange: (method: HttpMethod) => void;
}

/**
 * Dropdown for selecting an HTTP request method.
 */
export function MethodSelect({ value, onChange }: Props): JSX.Element {
  return (
    <select
      className="w-[88px] shrink-0 cursor-pointer appearance-none border-none bg-transparent px-2 py-1 text-[13px] font-semibold app-no-drag"
      value={value}
      onChange={(e) => onChange(e.target.value as HttpMethod)}
    >
      {METHODS.map((method) => (
        <option key={method} value={method}>
          {method}
        </option>
      ))}
    </select>
  );
}
