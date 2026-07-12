import {
  Children,
  isValidElement,
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type JSX,
  type MouseEvent,
  type ReactNode
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  checkedItemKey,
  readCheckedKeys,
  setChecked
} from '#/renderer/src/getting-started/checkedState';
import {
  GETTING_STARTED_DEFAULT_DOC,
  getGettingStartedDocContent,
  isExternalGettingStartedHref,
  resolveGettingStartedImageSrc,
  resolveGettingStartedRelativePath
} from '#/renderer/src/getting-started/content';

interface Props {
  /**
   * Optional initial document path within the getting-started directory.
   */
  initialDocPath?: string;
}

interface MarkdownComponentOptions {
  /** Active markdown path used to resolve relative links and checkbox keys. */
  currentDocPath: string;
  /** Called when the user follows a relative `.md` link. */
  onNavigateDoc: (docPath: string) => void;
  /** Returns the next zero-based checkbox index for the current render pass. */
  getNextCheckboxIndex: () => number;
  /** Persisted checked task-list keys for the current session. */
  checkedKeys: ReadonlySet<string>;
  /** Called when the user toggles a task-list checkbox. */
  onToggleCheckbox: (itemKey: string, checked: boolean) => void;
}

/**
 * Splits GFM task-list children into the checkbox input and remaining content.
 * react-markdown emits the checkbox and inline nodes as sibling children; wrapping
 * non-checkbox content avoids flex treating each inline node as its own column.
 *
 * @param children - React nodes rendered inside a task-list `<li>`.
 * @returns Checkbox element (if any) and all other content nodes.
 */
function splitTaskListItemChildren(children: ReactNode): {
  checkbox: ReactNode | null;
  content: ReactNode[];
} {
  const items = Children.toArray(children);
  const checkbox =
    items.find(
      (child) => isValidElement(child) && (child.props as { type?: string }).type === 'checkbox'
    ) ?? null;
  const content = items.filter((child) => child !== checkbox);

  return { checkbox, content };
}

/**
 * Builds react-markdown overrides for Getting Started docs, including relative
 * image resolution, in-tab navigation between sibling markdown files, and
 * interactive persisted task-list checkboxes.
 *
 * @param options - Render context for links, images, and checkbox state.
 * @returns Component map for {@link ReactMarkdown}.
 */
function createGettingStartedMarkdownComponents(options: MarkdownComponentOptions): Components {
  const { currentDocPath, onNavigateDoc, getNextCheckboxIndex, checkedKeys, onToggleCheckbox } =
    options;

  /**
   * Opens a sibling markdown document when the href is a relative `.md` link.
   *
   * @param event - Click event from the markdown anchor.
   * @param href - Link target from markdown.
   */
  const handleDocLinkClick = (event: MouseEvent<HTMLAnchorElement>, href: string): void => {
    if (isExternalGettingStartedHref(href)) {
      return;
    }

    const resolved = resolveGettingStartedRelativePath(currentDocPath, href);
    if (!resolved.endsWith('.md')) {
      return;
    }

    event.preventDefault();
    onNavigateDoc(resolved);
  };

  return {
    p: ({ children }) => <p className="mb-4 break-words last:mb-0">{children}</p>,
    a: ({ href, children }) => {
      const target = href ?? '';
      const isExternal = isExternalGettingStartedHref(target);

      return (
        <a
          href={target}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          onClick={isExternal ? undefined : (event) => handleDocLinkClick(event, target)}
          className="text-accent underline underline-offset-2 hover:opacity-90"
        >
          {children}
        </a>
      );
    },
    ul: ({ children, className }) => {
      const isTaskList = className?.includes('contains-task-list');

      return (
        <ul
          className={`my-4 last:mb-0 [&>li]:break-words ${
            isTaskList
              ? 'grid list-none grid-cols-1 gap-4 pl-0 xl:grid-cols-2'
              : 'list-disc space-y-2 pl-6'
          } ${className ?? ''}`.trim()}
        >
          {children}
        </ul>
      );
    },
    ol: ({ children }) => (
      <ol className="my-4 list-decimal space-y-2 pl-6 last:mb-0 [&>li]:break-words">{children}</ol>
    ),
    li: ({ children, className }) => {
      const isTaskItem = className?.includes('task-list-item');

      if (!isTaskItem) {
        return (
          <li className={`break-words [&>p]:mb-2 [&>p:last-child]:mb-0 ${className ?? ''}`.trim()}>
            {children}
          </li>
        );
      }

      const { checkbox, content } = splitTaskListItemChildren(children);

      return (
        <li className={`flex list-none items-start gap-2 break-words ${className ?? ''}`.trim()}>
          {checkbox}
          <div className="min-w-0 flex-1 [&>p]:mb-0 [&>p:last-child]:mb-0">{content}</div>
        </li>
      );
    },
    input: ({ type, checked: markdownChecked, disabled, ...rest }) => {
      if (type !== 'checkbox') {
        return <input type={type} checked={markdownChecked} disabled={disabled} {...rest} />;
      }

      const index = getNextCheckboxIndex();
      const itemKey = checkedItemKey(currentDocPath, index);
      const isChecked = checkedKeys.has(itemKey);

      /**
       * Persists checkbox state and updates the page when the user toggles a task item.
       *
       * @param event - Native checkbox change event.
       */
      const handleCheckboxChange = (event: ChangeEvent<HTMLInputElement>): void => {
        onToggleCheckbox(itemKey, event.target.checked);
      };

      return (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={handleCheckboxChange}
          className="mt-1 mr-2 h-4 w-4 shrink-0 accent-accent"
          {...rest}
        />
      );
    },
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
    img: ({ src, alt }) => {
      const resolvedSrc = resolveGettingStartedImageSrc(currentDocPath, src);

      if (resolvedSrc == null) {
        return (
          <p className="my-4 text-danger" role="alert">
            Missing image: {src ?? '(empty src)'}
          </p>
        );
      }

      return (
        <img
          src={resolvedSrc}
          alt={alt ?? ''}
          className="mx-auto my-4 block max-w-full rounded-md border border-separator"
        />
      );
    },
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="opacity-80">{children}</del>
  };
}

/**
 * Renders editable Getting Started markdown from the bundled source directory.
 */
export function GettingStartedPage({
  initialDocPath = GETTING_STARTED_DEFAULT_DOC
}: Props): JSX.Element {
  const [currentDocPath, setCurrentDocPath] = useState(initialDocPath);
  const [checkedKeys, setCheckedKeys] = useState(() => readCheckedKeys());

  /**
   * Switches the active markdown document within the getting-started bundle.
   */
  const handleNavigateDoc = useCallback((docPath: string): void => {
    setCurrentDocPath(docPath);
  }, []);

  /**
   * Persists one task-list checkbox toggle and updates local render state.
   */
  const handleToggleCheckbox = useCallback((itemKey: string, checked: boolean): void => {
    setChecked(itemKey, checked);
    setCheckedKeys((previous) => {
      const next = new Set(previous);
      if (checked) {
        next.add(itemKey);
      } else {
        next.delete(itemKey);
      }
      return next;
    });
  }, []);

  const content = useMemo(() => getGettingStartedDocContent(currentDocPath), [currentDocPath]);

  const checkboxCounter = { index: 0 };

  /**
   * Returns the next task-list checkbox index for the current markdown render pass.
   */
  const getNextCheckboxIndex = (): number => {
    const index = checkboxCounter.index;
    checkboxCounter.index += 1;
    return index;
  };

  const components = createGettingStartedMarkdownComponents({
    currentDocPath,
    onNavigateDoc: handleNavigateDoc,
    getNextCheckboxIndex,
    checkedKeys,
    onToggleCheckbox: handleToggleCheckbox
  });

  return (
    <main
      aria-labelledby="getting-started-heading"
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="w-full">
          <h2 id="getting-started-heading" className="sr-only">
            Getting Started
          </h2>
          {content == null ? (
            <p className="text-danger" role="alert">
              Document not found: {currentDocPath}
            </p>
          ) : (
            <div className="break-words leading-relaxed text-text [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
