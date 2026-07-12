/**
 * Returns whether a plain-text clipboard payload should be imported as markdown
 * rather than pasted literally into the MDXEditor surface.
 *
 * Rich-text HTML pastes and plain snippets without block constructs are left to
 * the default Lexical handler so single lines and copied web content behave normally.
 *
 * @param text - Clipboard plain-text payload.
 * @returns True when the content contains markdown block constructs worth parsing.
 */
export function shouldParsePasteAsMarkdown(text: string): boolean {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (normalized.length === 0) {
    return false;
  }

  // Fenced code blocks are the most common failure mode for literal paste.
  if (/(^|\n)```[\w-]*(\n|$)/.test(normalized)) {
    return true;
  }

  if (/(^|\n)~~~[\w-]*(\n|$)/.test(normalized)) {
    return true;
  }

  // Multi-line documents with ATX headings (e.g. pasted README files).
  if (normalized.includes('\n') && /(^|\n)#{1,6}\s+\S/.test(normalized)) {
    return true;
  }

  return false;
}

/**
 * Returns whether a clipboard event carries non-empty HTML that should use the
 * default rich-text paste path instead of markdown import.
 *
 * @param clipboard - Clipboard from a paste event.
 * @returns True when HTML payload is present.
 */
export function clipboardHasRichHtml(clipboard: DataTransfer | null): boolean {
  if (!clipboard) {
    return false;
  }

  return clipboard.getData('text/html').trim().length > 0;
}
