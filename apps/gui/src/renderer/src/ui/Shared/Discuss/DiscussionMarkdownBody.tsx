import { useMemo, type JSX } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarkdownCodeBlock } from '#/renderer/src/ui/Sidebars/AiSidebar/Chat/MarkdownCodeBlock';
import type { PreElementNode } from '#/renderer/src/ui/Sidebars/AiSidebar/Chat/markdownCodeBlockUtils';

interface Props {
  /**
   * Raw markdown string to render.
   */
  content: string;

  /**
   * Extra classes applied to the outer wrapper (e.g. muted italic for tombstones).
   */
  className?: string;
}

/**
 * Builds react-markdown component overrides for discussion comment bodies.
 *
 * @returns Component map for {@link ReactMarkdown}.
 */
function createDiscussionMarkdownComponents(): Components {
  return {
    p: ({ children }) => <p className="mb-2 break-words last:mb-0">{children}</p>,
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline underline-offset-2 hover:opacity-90"
      >
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
    blockquote: ({ children }) => (
      <blockquote className="my-2 border-l-2 border-separator pl-3 text-muted last:mb-0 [&>p]:mb-1 [&>p:last-child]:mb-0">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-separator" />,
    h1: ({ children }) => <h1 className="mb-2 font-semibold last:mb-0">{children}</h1>,
    h2: ({ children }) => <h2 className="mb-2 text-[15px] font-semibold last:mb-0">{children}</h2>,
    h3: ({ children }) => <h3 className="mb-2 text-[14px] font-semibold last:mb-0">{children}</h3>,
    h4: ({ children }) => <h4 className="mb-2 text-[14px] font-medium last:mb-0">{children}</h4>,
    h5: ({ children }) => <h5 className="mb-2 text-[14px] font-medium last:mb-0">{children}</h5>,
    h6: ({ children }) => <h6 className="mb-2 text-[14px] font-medium last:mb-0">{children}</h6>,
    pre: ({ node, children }) => (
      <MarkdownCodeBlock node={node as PreElementNode | undefined}>{children}</MarkdownCodeBlock>
    ),
    code: ({ className, children }) => {
      const isBlock = typeof className === 'string' && className.includes('language-');

      if (isBlock) {
        return (
          <code className={`font-mono text-[14px] ${className ?? ''}`.trim()}>{children}</code>
        );
      }

      return (
        <code className="rounded border border-separator bg-accent/15 px-1 py-0.5 font-mono text-[14px] text-text">
          {children}
        </code>
      );
    },
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto last:mb-0">
        <table className="my-2 w-full border-collapse text-left text-[14px] last:mb-0">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className="border border-separator bg-sidebar px-2 py-1 align-top font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-separator px-2 py-1 align-top">{children}</td>
    ),
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="opacity-80">{children}</del>
  };
}

/**
 * Renders a discussion comment body as GFM markdown without AI chat script-reference chrome.
 */
export function DiscussionMarkdownBody({ content, className }: Props): JSX.Element {
  /**
   * Memoizes markdown component overrides so ReactMarkdown does not rebuild them each render.
   */
  const components = useMemo(() => createDiscussionMarkdownComponents(), []);

  return (
    <div
      className={`break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 ${className ?? ''}`.trim()}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
