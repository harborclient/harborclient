import type { ComponentPropsWithoutRef, JSX } from 'react';
import type { HttpMethod } from '../../types.js';
import { methodColorClass } from '../../ui/tokens.js';
import { Select } from '../forms/index.js';
import { cn } from '../utils.js';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

interface Props extends Omit<
  ComponentPropsWithoutRef<'select'>,
  'value' | 'onChange' | 'children'
> {
  /**
   * Currently selected HTTP method.
   */
  value: HttpMethod;

  /**
   * Called when the user picks a different method.
   */
  onChange: (method: HttpMethod) => void;
}

/**
 * Dropdown for selecting an HTTP request method.
 */
export function MethodSelect({ value, onChange, className, ...props }: Props): JSX.Element {
  return (
    <Select
      {...props}
      variant="plain"
      className={cn(
        'hc-method-select app-no-drag w-[100px] shrink-0 cursor-pointer appearance-none border-none bg-transparent px-2 py-1.5 text-[14px] leading-none font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        methodColorClass(value),
        className
      )}
      value={value}
      aria-label="HTTP method"
      onChange={(e) => onChange(e.target.value as HttpMethod)}
    >
      {METHODS.map((method) => (
        <option key={method} value={method} className={methodColorClass(method)}>
          {method}
        </option>
      ))}
    </Select>
  );
}
