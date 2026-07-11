import { Button, FaIcon } from '@harborclient/sdk/components';
import { useRef, useState, type JSX, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { faCircleCheck, faCopy } from '#/renderer/src/fontawesome';
import { roundIconButtonClass } from '#/renderer/src/ui/shared/classes';

interface Props {
  /**
   * Tailwind classes for the underlying pre element.
   */
  className: string;

  /**
   * Rendered code element from react-markdown.
   */
  children: ReactNode;
}

/**
 * Renders a fenced code block with a copy-to-clipboard control for assistant messages.
 */
export function MarkdownCodeBlock({ className, children }: Props): JSX.Element {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  /**
   * Copies the code block text to the clipboard and shows brief confirmation.
   */
  const handleCopy = async (): Promise<void> => {
    const text = preRef.current?.textContent ?? '';
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const copyLabel = copied ? 'Copied' : 'Copy code';

  return (
    <div className="group/code relative">
      <Button
        type="button"
        variant="icon"
        className={`absolute right-1 top-1 z-10 text-muted opacity-0 transition-opacity group-hover/code:opacity-100 group-focus-within/code:opacity-100 focus-visible:opacity-100 ${roundIconButtonClass}`}
        aria-label={copyLabel}
        onClick={() => void handleCopy()}
      >
        <FaIcon icon={copied ? faCircleCheck : faCopy} />
      </Button>
      <pre ref={preRef} className={`${className} pt-7 pr-9`}>
        {children}
      </pre>
    </div>
  );
}
