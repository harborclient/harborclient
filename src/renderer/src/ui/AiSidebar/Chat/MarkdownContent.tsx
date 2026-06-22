import type { JSX } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
      inlineCode: 'rounded bg-white/20 px-1 py-0.5 font-mono text-[13px]',
      blockCode: 'font-mono text-[13px]',
      pre: 'my-2 overflow-x-auto rounded-md border border-white/20 bg-black/20 p-2 last:mb-0',
      blockquote:
        'my-2 border-l-2 border-white/40 pl-3 text-white/90 last:mb-0 [&>p]:mb-1 [&>p:last-child]:mb-0',
      table: 'my-2 w-full border-collapse text-left text-[13px] last:mb-0',
      tableCell: 'border border-white/25 px-2 py-1 align-top',
      tableHeader: 'border border-white/25 bg-white/10 px-2 py-1 font-semibold align-top',
      hr: 'my-3 border-white/25'
    };
  }

  return {
    link: 'text-accent underline underline-offset-2 hover:opacity-90',
    inlineCode: 'rounded bg-selection px-1 py-0.5 font-mono text-[13px]',
    blockCode: 'font-mono text-[13px]',
    pre: 'my-2 overflow-x-auto rounded-md border border-separator bg-surface p-2 last:mb-0',
    blockquote:
      'my-2 border-l-2 border-separator pl-3 text-muted last:mb-0 [&>p]:mb-1 [&>p:last-child]:mb-0',
    table: 'my-2 w-full border-collapse text-left text-[13px] last:mb-0',
    tableCell: 'border border-separator px-2 py-1 align-top',
    tableHeader: 'border border-separator bg-sidebar px-2 py-1 font-semibold align-top',
    hr: 'my-3 border-separator'
  };
}

/**
 * Builds react-markdown component overrides for a chat bubble variant.
 */
function createMarkdownComponents(variant: Variant): Components {
  const styles = getVariantStyles(variant);

  return {
    p: ({ children }) => <p className="mb-2 break-words last:mb-0">{children}</p>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {children}
      </a>
    ),
    ul: ({ children }) => (
      <ul className="my-2 list-disc space-y-1 pl-5 last:mb-0 [&>li]:break-words">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 list-decimal space-y-1 pl-5 last:mb-0 [&>li]:break-words">{children}</ol>
    ),
    li: ({ children }) => <li className="break-words">{children}</li>,
    blockquote: ({ children }) => <blockquote className={styles.blockquote}>{children}</blockquote>,
    hr: () => <hr className={styles.hr} />,
    h1: ({ children }) => <h1 className="mb-2 text-[16px] font-semibold last:mb-0">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-2 text-[15px] font-semibold last:mb-0">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-2 text-[14px] font-semibold last:mb-0">{children}</h3>,
    h4: ({ children }) => <h4 className="mb-2 text-[14px] font-medium last:mb-0">{children}</h4>,
    h5: ({ children }) => <h5 className="mb-2 text-[13px] font-medium last:mb-0">{children}</h5>,
    h6: ({ children }) => <h6 className="mb-2 text-[13px] font-medium last:mb-0">{children}</h6>,
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
    th: ({ children }) => <th className={styles.tableHeader}>{children}</th>,
    td: ({ children }) => <td className={styles.tableCell}>{children}</td>,
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="opacity-80">{children}</del>
  };
}

/**
 * Renders chat message markdown with GFM support and bubble-aware styling.
 */
export function MarkdownContent({ content, variant }: Props): JSX.Element {
  const components = createMarkdownComponents(variant);

  return (
    <div className="break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
