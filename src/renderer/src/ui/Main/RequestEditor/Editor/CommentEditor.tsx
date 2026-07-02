import {
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  MDXEditor,
  type MDXEditorMethods,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  codeBlockPlugin,
  codeMirrorPlugin
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { useCallback, useEffect, useMemo, useRef, type JSX } from 'react';

/** Languages offered in fenced code blocks inside request comments. */
const CODE_BLOCK_LANGUAGES: Record<string, string> = {
  js: 'JavaScript',
  json: 'JSON',
  ts: 'TypeScript',
  bash: 'Bash',
  css: 'CSS',
  html: 'HTML'
};

interface Props {
  /**
   * Current markdown comment stored on the request draft.
   */
  value: string;

  /**
   * Called when the user edits the comment markdown.
   *
   * @param comment - Updated markdown string.
   */
  onChange: (comment: string) => void;

  /**
   * Placeholder shown when the editor is empty.
   */
  placeholder?: string;
}

/**
 * Markdown comment editor for request notes using MDXEditor.
 */
export function CommentEditor({
  value,
  onChange,
  placeholder = 'Notes for this request'
}: Props): JSX.Element {
  const editorRef = useRef<MDXEditorMethods>(null);
  const lastEmittedRef = useRef(value);

  /**
   * Static MDXEditor plugin set for extended markdown notes (headings through tables).
   */
  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      codeBlockPlugin({ defaultCodeBlockLanguage: 'json' }),
      codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
      tablePlugin(),
      markdownShortcutPlugin()
    ],
    []
  );

  /**
   * Pushes user edits into the draft without rebinding the `markdown` prop (avoids lag).
   */
  const handleChange = useCallback(
    (markdown: string, initialMarkdownNormalize: boolean): void => {
      if (initialMarkdownNormalize) {
        return;
      }

      lastEmittedRef.current = markdown;
      onChange(markdown);
    },
    [onChange]
  );

  /**
   * Syncs AI or tab-switch draft updates into the editor via ref when value changes externally.
   */
  useEffect(() => {
    if (value === lastEmittedRef.current) {
      return;
    }

    editorRef.current?.setMarkdown(value);
    lastEmittedRef.current = value;
  }, [value]);

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col border border-separator p-4"
      role="group"
      aria-label={placeholder}
    >
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={handleChange}
        plugins={plugins}
        placeholder={placeholder}
        className="request-comment-editor app-no-drag min-h-0 flex-1 h-full bg-field"
        contentEditableClassName="request-comment-editor-content bg-field"
      />
    </div>
  );
}
