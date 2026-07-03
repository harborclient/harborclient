import { useMemo, type JSX, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AiScriptReferenceValidationContext } from '#/shared/aiScriptReferences';
import { processMarkdownChildren } from './renderScriptReferenceText';
import { useAiScriptReferenceValidationContext } from './useAiScriptReferenceValidationContext';

type Variant = 'user' | 'assistant';

interface Props {
  /**
   * Raw markdown string to render.
   */
  content: string;

  /**
   * Bubble styling variant for user (accent) or assistant (control) messages.
   */
  variant: Variant;
}

interface VariantStyles {
  link: string;
  inlineCode: string;
  blockCode: string;
  pre: string;
  blockquote: string;
  table: string;
  tableCell: string;
  tableHeader: string;
  hr: string;
}

/**
 * Returns Tailwind classes tuned for markdown inside a chat bubble variant.
 */
function getVariantStyles(variant: Variant): VariantStyles {
  if (variant === 'user') {
    return {
      link: 'text-white/90 underline underline-offset-2 hover:text-white',
      inlineCode: 'rounded bg-white/20 px-1 py-0.5 font-mono text-[14px]',
      blockCode: 'font-mono text-[14px]',
      pre: 'my-2 overflow-x-auto rounded-md border border-white/20 bg-black/20 p-2 last:mb-0',
      blockquote:
        'my-2 border-l-2 border-white/40 pl-3 text-white/90 last:mb-0 [&>p]:mb-1 [&>p:last-child]:mb-0',
      table: 'my-2 w-full border-collapse text-left text-[14px] last:mb-0',
      tableCell: 'border border-white/25 px-2 py-1 align-top',
      tableHeader: 'border border-white/25 bg-white/10 px-2 py-1 font-semibold align-top',
      hr: 'my-3 border-white/25'
    };
  }

  return {
    link: 'text-accent underline underline-offset-2 hover:opacity-90',
    inlineCode: 'rounded bg-selection px-1 py-0.5 font-mono text-[14px]',
    blockCode: 'font-mono text-[14px]',
    pre: 'my-2 overflow-x-auto rounded-md border border-separator bg-surface p-2 last:mb-0',
    blockquote:
      'my-2 border-l-2 border-separator pl-3 text-muted last:mb-0 [&>p]:mb-1 [&>p:last-child]:mb-0',
    table: 'my-2 w-full border-collapse text-left text-[14px] last:mb-0',
    tableCell: 'border border-separator px-2 py-1 align-top',
    tableHeader: 'border border-separator bg-sidebar px-2 py-1 font-semibold align-top',
    hr: 'my-3 border-separator'
  };
}

/**
 * Applies `@` script reference highlighting to markdown children in prose elements.
 *
 * @param children - Rendered markdown children.
 * @param context - Active tab state for semantic validation.
 */
function withScriptRefs(
  children: ReactNode,
  context: AiScriptReferenceValidationContext
): ReactNode {
  return processMarkdownChildren(children, context);
}

/**
 * Builds react-markdown component overrides for a chat bubble variant.
 *
 * @param variant - User or assistant bubble styling.
 * @param context - Active tab state for `@` reference highlighting.
 */
function createMarkdownComponents(
  variant: Variant,
  context: AiScriptReferenceValidationContext
): Components {
  const styles = getVariantStyles(variant);

  return {
    p: ({ children }) => (
      <p className="mb-2 break-words last:mb-0">{withScriptRefs(children, context)}</p>
    ),
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {withScriptRefs(children, context)}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="my-2 list-disc space-y-1 pl-5 last:mb-0 [&>li]:break-words">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 list-decimal space-y-1 pl-5 last:mb-0 [&>li]:break-words">{children}</ol>
    ),
    li: ({ children }) => <li className="break-words">{withScriptRefs(children, context)}</li>,
    blockquote: ({ children }) => (
      <blockquote className={styles.blockquote}>{withScriptRefs(children, context)}</blockquote>
    ),
    hr: () => <hr className={styles.hr} />,
    h1: ({ children }) => (
      <h1 className="mb-2 text-[16px] font-semibold last:mb-0">
        {withScriptRefs(children, context)}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-2 text-[15px] font-semibold last:mb-0">
        {withScriptRefs(children, context)}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-2 text-[14px] font-semibold last:mb-0">
        {withScriptRefs(children, context)}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="mb-2 text-[14px] font-medium last:mb-0">
        {withScriptRefs(children, context)}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="mb-2 text-[14px] font-medium last:mb-0">
        {withScriptRefs(children, context)}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="mb-2 text-[14px] font-medium last:mb-0">
        {withScriptRefs(children, context)}
      </h6>
    ),
    pre: ({ children }) => <pre className={styles.pre}>{children}</pre>,
    code: ({ className, children }) => {
      const isBlock = typeof className === 'string' && className.includes('language-');

      if (isBlock) {
        return <code className={`${styles.blockCode} ${className ?? ''}`.trim()}>{children}</code>;
      }

      return <code className={styles.inlineCode}>{children}</code>;
    },
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto last:mb-0">
        <table className={styles.table}>{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className={styles.tableHeader}>{withScriptRefs(children, context)}</th>
    ),
    td: ({ children }) => <td className={styles.tableCell}>{withScriptRefs(children, context)}</td>,
    strong: ({ children }) => (
      <strong className="font-semibold">{withScriptRefs(children, context)}</strong>
    ),
    em: ({ children }) => <em className="italic">{withScriptRefs(children, context)}</em>,
    del: ({ children }) => <del className="opacity-80">{withScriptRefs(children, context)}</del>
  };
}

/**
 * Renders chat message markdown with GFM support and bubble-aware styling.
 */
export function MarkdownContent({ content, variant }: Props): JSX.Element {
  const validationContext = useAiScriptReferenceValidationContext();

  /**
   * Memoizes markdown component overrides for the bubble variant and active tab state.
   */
  const components = useMemo(
    () => createMarkdownComponents(variant, validationContext),
    [variant, validationContext]
  );

  return (
    <div className="break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
