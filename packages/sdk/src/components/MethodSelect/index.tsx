import {
  type ComponentPropsWithoutRef,
  type JSX,
  useCallback,
  useId,
  useRef,
  useState
} from 'react';
import type { HttpMethod, RequestProtocol } from '../../types.js';
import { methodColorClass } from '../../ui/tokens.js';
import { cn } from '../utils.js';
import { MethodSelectMenu } from './MethodSelectMenu.js';

/** Select option value used when {@link Props.protocol} is `sse`. */
const SSE_OPTION = 'SSE';

interface Props extends Omit<
  ComponentPropsWithoutRef<'button'>,
  'value' | 'onChange' | 'children' | 'type'
> {
  /**
   * Currently selected HTTP method (ignored visually when protocol is `sse`).
   */
  value: HttpMethod;

  /**
   * Transport protocol; when `sse`, the control shows SSE instead of an HTTP method.
   */
  protocol?: RequestProtocol;

  /**
   * Called when the user picks a different HTTP method (also resets protocol to http).
   */
  onChange: (method: HttpMethod) => void;

  /**
   * Called when the user switches between HTTP methods and SSE.
   */
  onProtocolChange?: (protocol: RequestProtocol) => void;
}

/**
 * Dropdown for selecting an HTTP request method or the SSE protocol.
 *
 * Opens a custom listbox so the SSE row can sit below a full-bleed theme
 * separator (native `<option>` elements cannot draw one).
 *
 * @param props - Current method/protocol and change handlers.
 * @returns Accessible method/protocol combobox control.
 */
export function MethodSelect({
  value,
  protocol = 'http',
  onChange,
  onProtocolChange,
  className,
  ...props
}: Props): JSX.Element {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const selectValue = protocol === 'sse' ? SSE_OPTION : value;
  const colorKey = protocol === 'sse' ? 'sse' : value;

  /**
   * Applies a listbox selection, mapping SSE onto protocol updates.
   *
   * @param next - Chosen option id (`SSE` or an HTTP method).
   */
  const handleSelect = useCallback(
    (next: string): void => {
      setOpen(false);
      if (next === SSE_OPTION) {
        onProtocolChange?.('sse');
        return;
      }
      onProtocolChange?.('http');
      onChange(next as HttpMethod);
      triggerRef.current?.focus();
    },
    [onChange, onProtocolChange]
  );

  /**
   * Closes the listbox and returns focus to the trigger.
   */
  const handleClose = useCallback((): void => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  /**
   * Toggles the method listbox open or closed.
   */
  const toggleOpen = useCallback((): void => {
    setOpen((wasOpen) => !wasOpen);
  }, []);

  return (
    <>
      <button
        {...props}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label="Request method or protocol"
        className={cn(
          'hc-method-select w-[100px] shrink-0 cursor-pointer border-none bg-transparent px-2 py-1.5 text-left text-[14px] leading-none font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          methodColorClass(colorKey),
          className
        )}
        onClick={toggleOpen}
      >
        {selectValue}
      </button>
      {open ? (
        <MethodSelectMenu
          anchorRef={triggerRef}
          listboxId={listboxId}
          value={selectValue}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}
