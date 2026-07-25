import { faCircleCheck, faCopy, faXmark } from '@fortawesome/free-solid-svg-icons';
import { useState } from '@harborclient/sdk/react';
import type { JSX } from 'react';
import { Button } from '../Button/index.js';
import { FaIcon } from '../FaIcon/index.js';
import { Input } from '../forms/index.js';
import { cn } from '../utils.js';

interface Props {
  /**
   * Resolved variable value shown in the readonly field.
   */
  value: string;

  /**
   * Variable name from the hovered {{key}} token.
   */
  variableKey: string;

  /**
   * When true, styles the value as muted placeholder text.
   */
  muted?: boolean;

  /**
   * When provided, renders a close control to the right of the copy button.
   */
  onClose?: () => void;
}

/**
 * Readonly resolved-value field with copy and optional close controls for variable tooltips.
 */
export function VariableTooltipValue({ value, variableKey, muted, onClose }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);

  /**
   * Copies the resolved value to the clipboard and briefly confirms success in the icon.
   */
  const handleCopy = (): void => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="hc-variable-tooltip-value-row flex items-center gap-1.5">
      <Input
        readOnly
        value={value}
        aria-label={`Resolved value for ${variableKey}`}
        className={cn('min-w-0 flex-1', muted && 'text-muted')}
      />
      <Button
        type="button"
        variant="icon"
        aria-label={copied ? `Copied value for ${variableKey}` : `Copy value for ${variableKey}`}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onClick={handleCopy}
      >
        <FaIcon icon={copied ? faCircleCheck : faCopy} className="h-4 w-4" />
      </Button>
      {onClose && (
        <Button
          type="button"
          variant="icon"
          className="hc-variable-tooltip-close"
          aria-label={`Close tooltip for ${variableKey}`}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={onClose}
        >
          <FaIcon icon={faXmark} className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
