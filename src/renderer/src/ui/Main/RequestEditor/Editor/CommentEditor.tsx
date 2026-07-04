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
import type { Variable } from '#/shared/types';
import { useCallback, useEffect, useMemo, useRef, type JSX } from 'react';
import { FormGroup } from '@harborclient/sdk/components';

import {
  createVariableCodeMirrorExtensions,
  variableHighlightPlugin
} from './variableHighlightPlugin';

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
   * Collection-scoped variables for highlighting and tooltips.
   */
  variables: Variable[];

  /**
   * Opens collection settings to edit variables.
   */
  onEditVariables?: () => void;
}

/**
 * Markdown comment editor for request notes using MDXEditor.
 */
export function CommentEditor({ value, onChange, variables, onEditVariables }: Props): JSX.Element {
  const editorRef = useRef<MDXEditorMethods>(null);
  const lastEmittedRef = useRef(value);

  /**
   * MDXEditor plugins including variable highlighting for rich text and code blocks.
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
      codeMirrorPlugin({
        codeBlockLanguages: CODE_BLOCK_LANGUAGES,
        codeMirrorExtensions: createVariableCodeMirrorExtensions(variables, onEditVariables)
      }),
      tablePlugin(),
      markdownShortcutPlugin(),
      variableHighlightPlugin({ variables, onEditVariable: onEditVariables })
    ],
    [variables, onEditVariables]
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
      aria-label="Comment"
    >
      <FormGroup label="Comment" className="border-none! p-0! mb-2">
        <p className="text-sm text-muted text-[16px]">
          Leave a comment to describe the request. Markdown is supported.
        </p>
      </FormGroup>
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={handleChange}
        plugins={plugins}
        className="request-comment-editor app-no-drag min-h-0 flex-1 h-full bg-field rounded-lg! border border-separator focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-accent"
        contentEditableClassName="request-comment-editor-content bg-field outline-none"
      />
    </div>
  );
}
