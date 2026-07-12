import type { JSX } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  /**
   * Raw markdown string from a plugin README or description file.
   */
  content: string;
}

/**
 * Builds react-markdown component overrides styled like a GitHub README.
 *
 * Uses explicit element classes instead of Tailwind Typography so spacing and
 * font sizes stay predictable within HarborClient theme tokens.
 *
 * @returns Component map for {@link ReactMarkdown}.
 */
function createReadmeMarkdownComponents(): Components {
  return {
    p: ({ children }) => <p className="mb-4 break-words last:mb-0">{children}</p>,
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
      <ul className="my-4 list-disc space-y-2 pl-6 last:mb-0 [&>li]:break-words">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-4 list-decimal space-y-2 pl-6 last:mb-0 [&>li]:break-words">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="break-words [&>p]:mb-2 [&>p:last-child]:mb-0">{children}</li>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-4 border-separator pl-4 text-muted [&>p:last-child]:mb-0">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-6 border-separator" />,
    h1: ({ children }) => (
      <h1 className="mt-6 mb-4 border-b border-separator pb-2 text-[20px] font-semibold first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-6 mb-3 border-b border-separator pb-2 text-[18px] font-semibold first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => <h3 className="mt-5 mb-3 font-semibold first:mt-0">{children}</h3>,
    h4: ({ children }) => (
      <h4 className="mt-4 mb-2 text-[14px] font-semibold first:mt-0">{children}</h4>
    ),
    h5: ({ children }) => (
      <h5 className="mt-4 mb-2 text-[14px] font-semibold first:mt-0">{children}</h5>
    ),
    h6: ({ children }) => (
      <h6 className="mt-4 mb-2 text-[14px] font-semibold first:mt-0">{children}</h6>
    ),
    pre: ({ children }) => (
      <pre className="my-4 overflow-x-auto rounded-md border border-separator bg-sidebar p-4 font-mono text-[14px]">
        {children}
      </pre>
    ),
    code: ({ className, children }) => {
      const isBlock = typeof className === 'string' && className.includes('language-');

      if (isBlock) {
        return (
          <code className={`font-mono text-[14px] ${className ?? ''}`.trim()}>{children}</code>
        );
      }

      return (
        <code className="rounded bg-sidebar px-1.5 py-0.5 font-mono text-[14px]">{children}</code>
      );
    },
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto last:mb-0">
        <table className="w-full border-collapse text-left text-[14px]">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead>{children}</thead>,
    tbody: ({ children }) => <tbody>{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className="border border-separator bg-sidebar/40 px-2 py-1 align-top font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-separator px-2 py-1 align-top">{children}</td>
    ),
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt ?? ''}
        className="my-4 max-w-full rounded-md border border-separator"
      />
    ),
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="opacity-80">{children}</del>
  };
}

/**
 * Renders plugin README markdown with GFM support and GitHub-like spacing.
 */
export function PluginReadmeMarkdown({ content }: Props): JSX.Element {
  const components = createReadmeMarkdownComponents();

  return (
    <div className="break-words leading-relaxed text-text [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
