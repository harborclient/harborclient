import { Button, CodeEditor, FaIcon } from '@harborclient/sdk/components';
import { useState, type JSX, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { faCircleCheck, faCopy } from '#/renderer/src/fontawesome';
import { roundIconButtonClass } from '#/renderer/src/ui/shared/classes';
import {
  extractCodeBlockContent,
  mapFenceLanguageToCodeEditorLanguage,
  type PreElementNode
} from './markdownCodeBlockUtils';

interface Props {
  /**
   * `pre` hast node from react-markdown with the raw fenced source.
   */
  node?: PreElementNode;

  /**
   * Rendered code element from react-markdown.
   */
  children: ReactNode;
}

/**
 * Renders a fenced code block with themed syntax highlighting and copy support.
 */
export function MarkdownCodeBlock({ node, children }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);
  const { text, language } = extractCodeBlockContent(children, node);
  const editorLanguage = mapFenceLanguageToCodeEditorLanguage(language);

  /**
   * Copies the code block text to the clipboard and shows brief confirmation.
   */
  const handleCopy = async (): Promise<void> => {
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
    <div className="group/code relative my-2 last:mb-0">
      <Button
        type="button"
        variant="icon"
        className={`absolute right-1 top-1 z-10 text-muted opacity-0 transition-opacity group-hover/code:opacity-100 group-focus-within/code:opacity-100 focus-visible:opacity-100 ${roundIconButtonClass}`}
        aria-label={copyLabel}
        onClick={() => void handleCopy()}
      >
        <FaIcon icon={copied ? faCircleCheck : faCopy} />
      </Button>
      <CodeEditor
        readOnly
        value={text}
        language={editorLanguage}
        minHeight="0"
        lint={false}
        className="pt-7 pr-9"
        aria-label={language ? `Code block: ${language}` : 'Code block'}
      />
    </div>
  );
}
