import { remark } from 'remark';
import remarkGfm from 'remark-gfm';

/**
 * Normalizes markdown source through remark with GFM support.
 *
 * Parses the document into mdast and serializes it back to markdown so headings,
 * lists, tables, and fenced code blocks receive consistent spacing and structure.
 *
 * @param source - Raw markdown string from the editor.
 * @returns Reformatted markdown suitable for {@link MDXEditorMethods.setMarkdown}.
 */
export async function formatMarkdown(source: string): Promise<string> {
  const file = await remark().use(remarkGfm).process(source);
  return String(file);
}
